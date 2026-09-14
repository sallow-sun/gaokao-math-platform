package cn.mathsea.backend.paper;

import cn.mathsea.backend.admin.editorial.EditorialService;
import cn.mathsea.backend.common.exception.BusinessException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OriginalPaperService {
  private final JdbcTemplate db;
  private final ObjectMapper json;
  private final EditorialService editorial;
  private final SharedPaperService shared;
  private final cn.mathsea.backend.admin.service.AuditLogService audit;

  public record Edit(long version, JsonNode assembly) {}

  public record Publish(long version, String token, String note) {}

  public record Rename(long version, String title) {}

  private JsonNode parse(Object value) {
    try {
      return json.readTree(Objects.toString(value, "{}"));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private Map<String, Object> paper(UUID id, boolean lock) {
    var rows =
        db.queryForList(
            "SELECT * FROM editorial_papers WHERE id=?" + (lock ? " FOR UPDATE" : ""), id);
    if (rows.isEmpty()) throw BusinessException.notFound("ORIGINAL_NOT_FOUND", "原卷不存在");
    return rows.getFirst();
  }

  public Object list() {
    return db.queryForList(
        "SELECT p.id,p.title,p.assembly_version,(SELECT count(*) FROM editorial_items i WHERE"
            + " i.paper_id=p.id AND i.purged_at IS NULL AND i.status<>'TRASH') AS"
            + " question_count,(SELECT max(revision) FROM shared_papers s WHERE"
            + " s.original_paper_id=p.id) AS revision,(SELECT count(*) FROM editorial_items i WHERE"
            + " i.paper_id=p.id AND i.purged_at IS NULL AND i.status='PUBLISHED') AS"
            + " published_count FROM editorial_papers p ORDER BY p.created_at DESC,p.id");
  }

  @Transactional
  public Object rename(UUID id, Long actor, Rename request) {
    var row = paper(id, true);
    String title = Objects.toString(request.title(), "").trim();
    if (title.isBlank() || title.length() > 160)
      throw BusinessException.badRequest("ORIGINAL_TITLE", "请填写1至160字的试卷名称");
    if (((Number) row.get("assembly_version")).longValue() != request.version())
      throw BusinessException.conflict("ORIGINAL_VERSION", "原卷已被更新，请重新加载后修改名称");
    if (!title.equals(row.get("title"))) {
      String key =
          java.text.Normalizer.normalize(title, java.text.Normalizer.Form.NFKC)
                  .replaceAll("\\s+", "")
                  .toLowerCase(Locale.ROOT)
              + ":"
              + id;
      // Membership uses stable paper_id; every linked item's attribution changes with this row.
      // Published snapshots retain their original titles and remain immutable.
      db.update(
          "UPDATE editorial_papers SET title=?,identity_key=?,assembly_version=assembly_version+1"
              + " WHERE id=?",
          title,
          key,
          id);
      audit.log(
          actor,
          "ORIGINAL_RENAME",
          "ORIGINAL_PAPER",
          id.toString(),
          row.get("title") + " → " + title);
    }
    return detail(id);
  }

  private String hash(Object value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(value.toString().getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public Map<String, Object> detail(UUID id) {
    var row = paper(id, false);
    JsonNode assembly = parse(row.get("assembly"));
    var items =
        db.queryForList(
            "SELECT i.id,i.original_number,i.status,i.version,i.problem_number,i.payload::text AS"
                + " document FROM editorial_items i WHERE i.paper_id=? AND i.purged_at IS NULL AND"
                + " i.status<>'TRASH' ORDER BY CASE WHEN i.original_number ~ '^[0-9]{1,6}$' THEN"
                + " i.original_number::integer ELSE 999999 END,i.original_number,i.id",
            id);
    // Include referenced public content in the review token: a changed question invalidates an old
    // review.
    List<Object> tokenParts = new ArrayList<>();
    tokenParts.add(row.get("assembly_version"));
    tokenParts.add(assembly);
    for (var item : items) {
      JsonNode doc = parse(item.get("document"));
      item.put("document", doc);
      JsonNode choice = assembly.path("items").path(item.get("id").toString());
      String number = choice.path("reuse").asText("").trim();
      if (number.isBlank()) number = Objects.toString(item.get("problem_number"), "");
      var publicRows =
          db.queryForList(
              "SELECT id,problem_number,question_type,content FROM problems WHERE problem_number=?"
                  + " AND NOT deleted AND purged_at IS NULL",
              number);
      if (!publicRows.isEmpty()) {
        var p = publicRows.getFirst();
        p.put(
            "assets",
            db.queryForList(
                "SELECT url,alt_text AS \"altText\" FROM problem_assets WHERE problem_id=? ORDER BY"
                    + " sort_order,id",
                p.get("id")));
        item.put("problem", p);
      }
      tokenParts.add(new LinkedHashMap<>(item));
      // Conservative candidate matching ignores numeric values only for suggestions, never for
      // automatic reuse.
      String content = doc.path("content").asText();
      if (!content.isBlank())
        item.put(
            "duplicates",
            db.queryForList(
                "SELECT problem_number,title,content,question_type FROM problems WHERE NOT deleted"
                    + " AND purged_at IS NULL AND question_type=? AND problem_number<>? AND"
                    + " regexp_replace(content,'[[:space:]0-9]+','','g')=regexp_replace(?,'[[:space:]0-9]+','','g')"
                    + " ORDER BY id LIMIT 5",
                doc.path("type").asText(),
                Objects.toString(item.get("problem_number"), ""),
                content));
    }
    row.put("assembly", assembly);
    row.put("items", items);
    row.put("token", hash(tokenParts));
    row.put(
        "versions",
        db.queryForList(
            "SELECT id,revision,revision_note,checked_at,deleted,created_at FROM shared_papers"
                + " WHERE original_paper_id=? ORDER BY revision DESC",
            id));
    return row;
  }

  @Transactional
  public Object save(UUID id, Long actor, Edit edit) {
    paper(id, true);
    if (edit.assembly() == null
        || !edit.assembly().isObject()
        || edit.assembly().toString().length() > 100000)
      throw BusinessException.badRequest("ORIGINAL_INPUT", "原卷设置格式不正确");
    if (db.update(
            "UPDATE editorial_papers SET assembly=?::jsonb,assembly_version=assembly_version+1"
                + " WHERE id=? AND assembly_version=?",
            edit.assembly().toString(),
            id,
            edit.version())
        != 1) throw BusinessException.conflict("ORIGINAL_VERSION", "原卷已被更新，请重新加载后核对");
    audit.log(
        actor,
        "ORIGINAL_SAVE",
        "ORIGINAL_PAPER",
        id.toString(),
        "Assembly version " + (edit.version() + 1));
    return detail(id);
  }

  @Transactional
  public Object publish(UUID id, Long actor, Publish request) {
    if (editorial.permission(actor).equals("EDITOR"))
      throw BusinessException.forbidden("ORIGINAL_REVIEW", "需要复核或负责人权限");
    paper(id, true);
    var current = detail(id);
    if (((Number) current.get("assembly_version")).longValue() != request.version()
        || !Objects.equals(current.get("token"), request.token()))
      throw BusinessException.conflict("ORIGINAL_CHANGED", "题目或原卷设置已更新，请重新加载并核对");
    String note = Objects.toString(request.note(), "").trim();
    if (note.isBlank() || note.length() > 500)
      throw BusinessException.badRequest("ORIGINAL_NOTE", "请填写本次核验范围与版本说明（最多500字）");
    JsonNode a = (JsonNode) current.get("assembly");
    ObjectNode snapshot = json.createObjectNode();
    snapshot.put("version", 1);
    snapshot.put("size", "a4");
    snapshot.put("title", current.get("title").toString());
    snapshot.put("targetScore", a.path("targetScore").asDouble(150));
    ArrayNode entries = snapshot.putArray("items");
    Set<String> seen = new HashSet<>();
    @SuppressWarnings("unchecked")
    var items = (List<Map<String, Object>>) current.get("items");
    Map<Object, Integer> originalOrder = new HashMap<>();
    for (int n = 0; n < items.size(); n++) originalOrder.put(items.get(n).get("id"), n + 1);
    items.sort(
        Comparator.comparingInt(
            i ->
                a.path("items")
                    .path(i.get("id").toString())
                    .path("order")
                    .asInt(originalOrder.get(i.get("id")))));
    double total = 0;
    int previousType = -1;
    Set<Integer> orders = new HashSet<>();
    for (var item : items) {
      JsonNode choice = a.path("items").path(item.get("id").toString());
      if (choice.path("exclude").asBoolean()) continue;
      @SuppressWarnings("unchecked")
      var p = (Map<String, Object>) item.get("problem");
      if (p == null
          || (choice.path("reuse").asText().isBlank() && !"PUBLISHED".equals(item.get("status"))))
        throw BusinessException.badRequest("ORIGINAL_PENDING", "请先审核发布所有选中题目，或明确选择复用已有题目");
      String number = p.get("problem_number").toString();
      int order = choice.path("order").asInt(originalOrder.get(item.get("id")));
      if (order < 1 || order > 100 || !orders.add(order))
        throw BusinessException.badRequest("ORIGINAL_ORDER", "排序号应在1至100之间且不重复");
      int type =
          List.of("single-choice", "multiple-choice", "fill-blank", "solution")
              .indexOf(p.get("question_type").toString());
      if (type < previousType || type < 0)
        throw BusinessException.badRequest("ORIGINAL_TYPE_ORDER", "请按单选、多选、填空、解答顺序整理题目，以保持打印题序一致");
      previousType = type;
      if (!seen.add(number))
        throw BusinessException.badRequest("ORIGINAL_DUPLICATE", "同一题目在原卷中重复，请排除重复项");
      double score = choice.path("score").asDouble(-1);
      if (!Double.isFinite(score) || score <= 0 || score > 100 || score * 2 != Math.rint(score * 2))
        throw BusinessException.badRequest("ORIGINAL_SCORE", "请为每题填写有效分数（0.5至100，步长0.5）");
      total += score;
      ObjectNode entry = entries.addObject(), problem = entry.putObject("problem");
      problem.put("id", number);
      problem.put("content", p.get("content").toString());
      problem.put("type", p.get("question_type").toString());
      problem.put(
          "typeLabel",
          switch (p.get("question_type").toString()) {
            case "single-choice" -> "单选题";
            case "multiple-choice" -> "多选题";
            case "fill-blank" -> "填空题";
            default -> "解答题";
          });
      problem.set("assets", json.valueToTree(p.get("assets")));
      entry.put("score", score);
      entry.put("space", choice.path("space").asInt(0));
    }
    if (entries.isEmpty()
        || entries.size() != a.path("expectedCount").asInt()
        || Math.abs(total - a.path("targetScore").asDouble(-1)) > 0.001)
      throw BusinessException.badRequest("ORIGINAL_TOTAL", "所选题数、总分必须与核对后的预期题数和总分一致");
    var result =
        (Map<?, ?>)
            shared.share(
                actor,
                new SharedPaperService.Publication(
                    current.get("title").toString(),
                    note,
                    a.path("source").asText(),
                    a.hasNonNull("year") && !a.path("year").asText().isBlank()
                        ? a.path("year").asInt()
                        : null,
                    a.path("examMode").asText(),
                    false,
                    snapshot));
    int revision =
        db.queryForObject(
            "SELECT COALESCE(max(revision),0)+1 FROM shared_papers WHERE original_paper_id=?",
            Integer.class,
            id);
    db.update(
        "UPDATE shared_papers SET"
            + " original_paper_id=?,revision=?,revision_note=?,checked_by=?,checked_at=now(),check_note=?"
            + " WHERE id=?",
        id,
        revision,
        note,
        actor,
        note,
        result.get("id"));
    db.update("UPDATE editorial_papers SET assembly_version=assembly_version+1 WHERE id=?", id);
    audit.log(
        actor,
        "ORIGINAL_PUBLISH",
        "SHARED_PAPER",
        result.get("id").toString(),
        "v" + revision + ": " + note);
    return result;
  }
}
