package cn.mathsea.backend.paper;

import cn.mathsea.backend.admin.editorial.EditorialService;
import cn.mathsea.backend.common.exception.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SharedPaperService {
  private final JdbcTemplate db;
  private final ObjectMapper json;
  private final PaperObjectStorage storage;
  private final EditorialService editorial;

  public record Publication(
      String title,
      String description,
      String source,
      Integer year,
      String examMode,
      boolean hasAnswers,
      JsonNode snapshot) {}

  public record Rating(int difficulty, int alignment) {}

  public record Check(boolean checked, String note) {}

  private String text(String value, int max) {
    String s = Objects.toString(value, "").trim();
    if (s.length() > max) throw BusinessException.badRequest("PAPER_INPUT", "填写内容过长");
    return s;
  }

  private void userQuota(Long actor) {
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", actor);
    if (db.queryForObject(
            "SELECT count(*) FROM shared_papers WHERE owner_id=? AND created_at>now()-interval '1"
                + " day'",
            Long.class,
            actor)
        >= 20) throw BusinessException.badRequest("PAPER_LIMIT", "每天最多发布20份试卷");
  }

  private UUID insert(Long actor, Publication input, String kind, JsonNode snapshot) {
    userQuota(actor);
    String title = text(input.title(), 160);
    if (title.isBlank()) throw BusinessException.badRequest("PAPER_TITLE", "请填写试卷名称");
    if (input.year() != null && (input.year() < 1900 || input.year() > 2100))
      throw BusinessException.badRequest("PAPER_YEAR", "年份应在1900至2100之间");
    UUID id = UUID.randomUUID();
    int count = snapshot == null ? 0 : snapshot.path("items").size();
    double total = 0;
    if (snapshot != null)
      for (JsonNode item : snapshot.path("items")) total += item.path("score").asDouble();
    db.update(
        "INSERT INTO"
            + " shared_papers(id,owner_id,title,description,source,year,exam_mode,kind,snapshot,question_count,total_score,has_answers,published)"
            + " VALUES (?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?)",
        id,
        actor,
        title,
        text(input.description(), 2000),
        text(input.source(), 160),
        input.year(),
        text(input.examMode(), 80),
        kind,
        snapshot == null ? null : snapshot.toString(),
        snapshot == null ? null : count,
        snapshot == null ? null : total,
        "PDF".equals(kind) && input.hasAnswers(),
        snapshot != null);
    return id;
  }

  private ObjectNode cleanSnapshot(JsonNode raw, String title) {
    if (raw == null
        || raw.path("version").asInt() != 1
        || !raw.path("items").isArray()
        || raw.path("items").isEmpty()
        || raw.path("items").size() > 100
        || raw.toString().length() > 2_000_000)
      throw BusinessException.badRequest("PAPER_SNAPSHOT", "请选择包含1至100题的组卷");
    ObjectNode result = json.createObjectNode();
    result.put("version", 1);
    result.put("title", text(title, 100));
    result.put(
        "size",
        List.of("a4", "16k").contains(raw.path("size").asText())
            ? raw.path("size").asText()
            : "a4");
    result.put("targetScore", Math.max(0, Math.min(1000, raw.path("targetScore").asDouble(150))));
    ArrayNode items = result.putArray("items");
    Set<String> seen = new HashSet<>();
    for (JsonNode entry : raw.path("items")) {
      JsonNode source = entry.path("problem");
      String id = text(source.path("id").asText(), 80),
          content = text(source.path("content").asText(), 50000);
      if (id.isBlank() || content.isBlank() || !seen.add(id))
        throw BusinessException.badRequest("PAPER_SNAPSHOT", "题目内容为空或重复");
      ObjectNode item = items.addObject(), problem = item.putObject("problem");
      problem.put("id", id);
      problem.put("content", content);
      problem.put("type", text(source.path("type").asText(), 40));
      problem.put("typeLabel", text(source.path("typeLabel").asText(), 40));
      ArrayNode assets = problem.putArray("assets");
      if (source.path("assets").isArray())
        for (JsonNode asset : source.path("assets")) {
          String url = asset.path("url").asText();
          if (url.matches("/uploads/[A-Za-z0-9_./-]+")
              && !Arrays.asList(url.split("/")).contains("..")
              && assets.size() < 20) {
            ObjectNode target = assets.addObject();
            target.put("url", url);
            target.put("altText", text(asset.path("altText").asText(), 200));
          }
        }
      double score = entry.path("score").asDouble(5);
      if (!Double.isFinite(score) || score < 0 || score > 100)
        throw BusinessException.badRequest("PAPER_SCORE", "题目分数应在0至100之间");
      item.put("score", Math.round(score * 2) / 2.0);
      item.put(
          "space",
          List.of(0, 20, 40, 60).contains(entry.path("space").asInt())
              ? entry.path("space").asInt()
              : 0);
      item.put("breakBefore", entry.path("breakBefore").asBoolean());
    }
    return result;
  }

  @Transactional
  public Object share(Long actor, Publication input) {
    return Map.of(
        "id", insert(actor, input, "BUILDER", cleanSnapshot(input.snapshot(), input.title())));
  }

  @Transactional
  public Object beginUpload(Long actor, Publication input) {
    if (!storage.available())
      throw BusinessException.badRequest("PDF_UNAVAILABLE", "PDF 上传暂未开放，可先分享站内组卷");
    UUID id = insert(actor, input, "PDF", null);
    return Map.of("id", id, "upload", storage.upload(id));
  }

  @Transactional
  public Object finishUpload(Long actor, UUID id) {
    var row = locked(id);
    if (!actor.equals(row.get("owner_id")))
      throw BusinessException.forbidden("PAPER_OWNER", "只能发布自己的试卷");
    if (!"PDF".equals(row.get("kind")) || Boolean.TRUE.equals(row.get("deleted")))
      throw BusinessException.badRequest("PAPER_STATE", "试卷状态已改变");
    if (!Boolean.TRUE.equals(row.get("published"))) {
      var file = storage.complete(id);
      db.update(
          "UPDATE shared_papers SET object_key=?,file_bytes=?,published=true WHERE id=?",
          file.key(),
          file.bytes(),
          id);
    }
    return Map.of("id", id);
  }

  private Map<String, Object> locked(UUID id) {
    var rows = db.queryForList("SELECT * FROM shared_papers WHERE id=? FOR UPDATE", id);
    if (rows.isEmpty()) throw BusinessException.notFound("PAPER_NOT_FOUND", "试卷不存在");
    return rows.getFirst();
  }

  private final String base =
      "SELECT p.id,p.owner_id,u.username AS"
          + " author,p.title,p.description,p.source,p.year,p.exam_mode,p.kind,p.question_count,p.total_score,p.has_answers,p.file_bytes,p.created_at,p.checked_at,p.check_note,cu.username"
          + " AS checked_by_name,(SELECT count(*) FROM shared_paper_ratings r WHERE"
          + " r.paper_id=p.id) AS rating_count,(SELECT round(avg(r.difficulty),1) FROM"
          + " shared_paper_ratings r WHERE r.paper_id=p.id) AS difficulty,(SELECT"
          + " round(avg(r.alignment),1) FROM shared_paper_ratings r WHERE r.paper_id=p.id) AS"
          + " alignment,(SELECT count(*) FROM shared_paper_favorites f WHERE f.paper_id=p.id) AS"
          + " favorite_count,((SELECT count(DISTINCT v.user_id) FROM shared_paper_uses v WHERE"
          + " v.paper_id=p.id AND v.user_id<>p.owner_id AND v.day>=CURRENT_DATE-6)>=10) AS hot FROM"
          + " shared_papers p JOIN users u ON u.id=p.owner_id LEFT JOIN users cu ON"
          + " cu.id=p.checked_by ";

  public Object list(
      Long actor,
      String q,
      String kind,
      String scope,
      String sort,
      Integer year,
      String examMode,
      boolean checked,
      int page) {
    String where = " WHERE p.published AND NOT p.deleted";
    List<Object> args = new ArrayList<>();
    if (!Objects.toString(q, "").isBlank()) {
      where += " AND (p.title ILIKE ? OR p.source ILIKE ?)";
      args.add("%" + text(q, 160) + "%");
      args.add("%" + text(q, 160) + "%");
    }
    if (List.of("PDF", "BUILDER").contains(kind)) {
      where += " AND p.kind=?";
      args.add(kind);
    }
    if ("mine".equals(scope) || "favorites".equals(scope)) {
      if (actor == null) throw BusinessException.forbidden("LOGIN_REQUIRED", "请先登录");
      if ("mine".equals(scope)) {
        where += " AND p.owner_id=?";
        args.add(actor);
      } else {
        where +=
            " AND EXISTS(SELECT 1 FROM shared_paper_favorites f WHERE f.paper_id=p.id AND"
                + " f.user_id=?)";
        args.add(actor);
      }
    }
    if (year != null) {
      where += " AND p.year=?";
      args.add(year);
    }
    if (!Objects.toString(examMode, "").isBlank()) {
      where += " AND p.exam_mode=?";
      args.add(text(examMode, 80));
    }
    if (checked) where += " AND p.checked_at IS NOT NULL";
    long total =
        db.queryForObject(
            "SELECT count(*) FROM shared_papers p" + where, Long.class, args.toArray());
    int current = Math.max(1, Math.min(page, (int) Math.max(1, (total + 19) / 20)));
    args.add((current - 1) * 20);
    String order =
        "favorites".equals(sort)
            ? "favorite_count DESC,p.created_at DESC"
            : "hot".equals(sort) ? "hot DESC,p.created_at DESC" : "p.created_at DESC";
    return Map.of(
        "items",
        db.queryForList(
            base + where + " ORDER BY " + order + ",p.id LIMIT 20 OFFSET ?", args.toArray()),
        "total",
        total,
        "page",
        current,
        "pdfAvailable",
        storage.available());
  }

  public Map<String, Object> detail(UUID id, Long actor) {
    var rows = db.queryForList(base + " WHERE p.id=? AND p.published AND NOT p.deleted", id);
    if (rows.isEmpty()) throw BusinessException.notFound("PAPER_NOT_FOUND", "试卷不存在或已下架");
    var row = rows.getFirst();
    row.put("canEdit", actor != null && actor.equals(row.get("owner_id")));
    row.put("canCheck", actor != null && isReviewer(actor));
    row.put(
        "favorite",
        actor != null
            && db.queryForObject(
                    "SELECT count(*) FROM shared_paper_favorites WHERE paper_id=? AND user_id=?",
                    Long.class,
                    id,
                    actor)
                > 0);
    row.put(
        "myRating",
        actor == null
            ? List.of()
            : db.queryForList(
                "SELECT difficulty,alignment FROM shared_paper_ratings WHERE paper_id=? AND"
                    + " user_id=?",
                id,
                actor));
    String snapshot =
        db.queryForObject("SELECT snapshot::text FROM shared_papers WHERE id=?", String.class, id);
    try {
      row.put("snapshot", snapshot == null ? null : json.readTree(snapshot));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
    return row;
  }

  private boolean isReviewer(Long actor) {
    return db.queryForObject(
                "SELECT count(*) FROM users WHERE id=? AND role='ADMIN'", Long.class, actor)
            > 0
        && !editorial.permission(actor).equals("EDITOR");
  }

  @Transactional
  public void rate(UUID id, Long actor, Rating rating) {
    var row = detail(id, actor);
    if (actor.equals(row.get("owner_id")))
      throw BusinessException.badRequest("PAPER_SELF_RATING", "不能评价自己发布的试卷");
    if (rating.difficulty() < 1
        || rating.difficulty() > 5
        || rating.alignment() < 1
        || rating.alignment() > 5) throw BusinessException.badRequest("PAPER_RATING", "请选择1至5分");
    db.update(
        "INSERT INTO shared_paper_ratings(paper_id,user_id,difficulty,alignment) VALUES (?,?,?,?)"
            + " ON CONFLICT(paper_id,user_id) DO UPDATE SET"
            + " difficulty=excluded.difficulty,alignment=excluded.alignment,updated_at=now()",
        id,
        actor,
        rating.difficulty(),
        rating.alignment());
  }

  @Transactional
  public void favorite(UUID id, Long actor, boolean value) {
    detail(id, actor);
    if (value)
      db.update(
          "INSERT INTO shared_paper_favorites VALUES (?,?,now()) ON CONFLICT DO NOTHING",
          id,
          actor);
    else db.update("DELETE FROM shared_paper_favorites WHERE paper_id=? AND user_id=?", id, actor);
  }

  @Transactional
  public void check(UUID id, Long actor, Check check) {
    if (!isReviewer(actor)) throw BusinessException.forbidden("PAPER_REVIEW", "需要审核权限");
    detail(id, actor);
    String note = text(check.note(), 500);
    if (check.checked() && note.isBlank())
      throw BusinessException.badRequest("PAPER_CHECK", "请填写校核范围，例如题干、答案和解析");
    db.update(
        "UPDATE shared_papers SET checked_by=?,checked_at=CASE WHEN ? THEN now() ELSE NULL"
            + " END,check_note=? WHERE id=?",
        check.checked() ? actor : null,
        check.checked(),
        check.checked() ? note : null,
        id);
  }

  @Transactional
  public void remove(UUID id, Long actor) {
    var row = locked(id);
    if (!actor.equals(row.get("owner_id")) && !isReviewer(actor))
      throw BusinessException.forbidden("PAPER_OWNER", "没有下架权限");
    db.update("UPDATE shared_papers SET deleted=true WHERE id=?", id);
  }

  @Transactional
  public Object access(UUID id, Long actor, boolean download) {
    detail(id, actor);
    if (db.queryForObject(
                "SELECT count(*) FROM shared_paper_uses WHERE user_id=? AND day=CURRENT_DATE",
                Long.class,
                actor)
            >= 100
        && db.queryForObject(
                "SELECT count(*) FROM shared_paper_uses WHERE paper_id=? AND user_id=? AND"
                    + " day=CURRENT_DATE",
                Long.class,
                id,
                actor)
            == 0) throw BusinessException.badRequest("PAPER_USE_LIMIT", "今日访问试卷较多，请明天再试");
    db.update(
        "INSERT INTO shared_paper_uses(paper_id,user_id) VALUES (?,?) ON CONFLICT DO NOTHING",
        id,
        actor);
    String key =
        db.queryForObject("SELECT object_key FROM shared_papers WHERE id=?", String.class, id);
    return key == null ? Map.of("ok", true) : Map.of("url", storage.read(key, download));
  }
}
