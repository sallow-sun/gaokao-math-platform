package cn.mathsea.backend.admin.editorial;

import cn.mathsea.backend.admin.dto.AdminProblemRequest;
import cn.mathsea.backend.admin.service.AdminProblemService;
import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.common.storage.LocalFileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class EditorialService {
  private final JdbcTemplate db;
  private final ObjectMapper json;
  private final MarkdownQuestionParser parser;
  private final AdminProblemService problems;
  private final LocalFileStorageService storage;
  private final cn.mathsea.backend.curriculum.CurriculumService curriculum;
  private final cn.mathsea.backend.problem.service.TagTaxonomy taxonomy;

  private EditorialDocument canonicalTags(EditorialDocument d) {
    if (d == null || d.tags() == null) return d;
    var metadata = new LinkedHashMap<>(d.originalMetadata() == null ? Map.<String,String>of() : d.originalMetadata());
    var unknown = d.tags().stream().filter(t -> t != null && taxonomy.normalize(List.of(t)).isEmpty()).toList();
    if (!unknown.isEmpty()) metadata.put("unmapped_tags", String.join(",",unknown));
    return new EditorialDocument(d.title(), d.year(), d.source(), d.type(), d.level(),
        taxonomy.normalize(d.tags()),
        d.content(), d.answer(), d.solution(), d.assets(), d.imageReferences(), metadata, d.warnings(), d.curriculum());
  }

  public record Save(long version, EditorialDocument document, String note) {}

  public record Action(long version, String action, String note, Long historyId) {}

  public record Target(UUID id, long version) {}

  public record Bulk(List<Target> items, String field, String value, String note) {}

  public String permission(Long actor) {
    return db
        .query(
            "SELECT COALESCE(p.permission,CASE WHEN u.id=(SELECT min(id) FROM users) THEN 'MANAGER'"
                + " ELSE 'EDITOR' END) FROM users u LEFT JOIN editorial_permissions p ON"
                + " p.user_id=u.id WHERE u.id=? AND u.role='ADMIN'",
            (rs, n) -> rs.getString(1),
            actor)
        .stream()
        .findFirst()
        .orElse("EDITOR");
  }

  private void reviewer(Long actor) {
    if (permission(actor).equals("EDITOR"))
      throw BusinessException.forbidden("REVIEW_REQUIRED", "需要复核或负责人权限");
  }

  public void manager(Long actor) {
    if (!permission(actor).equals("MANAGER"))
      throw BusinessException.forbidden("MANAGER_REQUIRED", "需要负责人权限");
  }

  public List<Map<String, Object>> members(Long actor) {
    manager(actor);
    return db.queryForList(
        "SELECT u.id,u.username,u.uid,COALESCE(p.permission,'EDITOR') permission FROM users u LEFT"
            + " JOIN editorial_permissions p ON p.user_id=u.id WHERE u.role='ADMIN' ORDER BY u.id");
  }

  @Transactional
  public void setPermission(Long actor, Long user, String value) {
    manager(actor);
    if (!List.of("EDITOR", "REVIEWER", "MANAGER").contains(value))
      throw BusinessException.badRequest("PERMISSION", "权限不合法");
    if (actor.equals(user)) throw BusinessException.badRequest("OWN_PERMISSION", "不能在此修改自己的权限");
    if (!value.equals("MANAGER")
        && Objects.equals(user, db.queryForObject("SELECT min(id) FROM users", Long.class)))
      throw BusinessException.badRequest("PERMANENT_MANAGER", "首位管理员保留负责人权限");
    if (db.queryForObject(
            "SELECT count(*) FROM users WHERE id=? AND role='ADMIN'", Long.class, user)
        == 0) throw BusinessException.badRequest("ADMIN_REQUIRED", "请先将用户设置为管理员");
    db.update(
        "INSERT INTO editorial_permissions VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET"
            + " permission=excluded.permission",
        user,
        value);
    db.update(
        "INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES"
            + " (?,'EDITORIAL_PERMISSION','USER',?,?)",
        actor,
        user.toString(),
        value);
  }

  public List<Map<String, Object>> papers() {
    return db.queryForList("SELECT * FROM editorial_papers ORDER BY title,id");
  }

  @Transactional
  public Map<String, Object> paper(Long actor, String title) {
    title = clean(title, 255, "试卷名称");
    String key = title.replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    db.update(
        "INSERT INTO editorial_papers(id,identity_key,title,created_by) VALUES (?,?,?,?) ON"
            + " CONFLICT(identity_key) DO NOTHING",
        UUID.randomUUID(),
        key,
        title,
        actor);
    return db.queryForMap("SELECT * FROM editorial_papers WHERE identity_key=?", key);
  }

  public Map<String, Object> batch(Long actor, String title) {
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO editorial_batches(id,title,actor_id) VALUES (?,?,?)",
        id,
        clean(title, 255, "批次名称"),
        actor);
    return db.queryForMap("SELECT * FROM editorial_batches WHERE id=?", id);
  }

  public List<Map<String, Object>> batches() {
    return db.queryForList(
        "SELECT b.*,u.username,(SELECT count(*) FROM editorial_import_entries e WHERE"
            + " e.batch_id=b.id) processed FROM editorial_batches b LEFT JOIN users u ON"
            + " u.id=b.actor_id ORDER BY b.created_at DESC LIMIT 100");
  }

  public List<Map<String, Object>> entries(UUID batch) {
    return db.queryForList(
        "SELECT * FROM editorial_import_entries WHERE batch_id=? ORDER BY path", batch);
  }

  public Map<String, Object> queue(String status, UUID paper, String keyword, int page) {
    return queue(status, paper, keyword, page, "");
  }

  public Map<String, Object> queue(
      String status, UUID paper, String keyword, int page, String chapterStatus) {
    return queue(status, paper, keyword, page, chapterStatus, "");
  }

  public Map<String, Object> queue(
      String status, UUID paper, String keyword, int page, String chapterStatus, String issue) {
    String where =
        " WHERE (?='' OR i.status=? OR (?='PENDING' AND i.status IN ('DRAFT','REVIEW'))) AND (?::uuid IS NULL OR i.paper_id=?::uuid) AND (i.original_id"
            + " ILIKE ? OR COALESCE(i.problem_number,'') ILIKE ? OR i.payload->>'title' ILIKE ? OR"
            + " p.title ILIKE ?)";
    where +=
        switch (Objects.toString(chapterStatus, "")) {
          case "" -> "";
          case "confirmed" -> " AND i.payload->'curriculum'->>'confirmed'='true'";
          case "pending" ->
              " AND coalesce(i.payload->'curriculum'->>'confirmed','false')<>'true' AND"
                  + " jsonb_array_length(coalesce(i.payload->'curriculum'->'chapters','[]'))>0";
          case "missing" ->
              " AND jsonb_array_length(coalesce(i.payload->'curriculum'->'chapters','[]'))=0";
          default -> throw BusinessException.badRequest("CHAPTER_STATUS", "未知章节标注状态");
        };
      String q = "%" + Objects.toString(keyword, "").trim() + "%";
      if (issue != null && !issue.isBlank()) {
        if (!List.of("答案", "解析", "图片", "排版", "标签", "其他").contains(issue))
          throw BusinessException.badRequest("ISSUE", "未知问题类型");
        where += " AND i.issue_type='" + issue + "'";
      }
    String s = Objects.toString(status, "");
      Object[] args = {s, s, s, paper, paper, q, q, q, q};
    long total =
        db.queryForObject(
            "SELECT count(*) FROM editorial_items i LEFT JOIN editorial_papers p ON p.id=i.paper_id"
                + where,
            Long.class,
            args);
    List<Object> paged = new ArrayList<>(Arrays.asList(args));
    paged.add((Math.max(1, page) - 1) * 40);
    var items =
        db.queryForList(
            "SELECT i.id,i.paper_id,p.title"
                + " paper_title,i.original_id,i.original_number,i.problem_number,i.status,i.version,i.payload->>'title'"
                + " title,i.payload->>'level' level,i.issue_type,i.claimed_by,u.username"
                + " claimed_name,i.updated_at FROM editorial_items i LEFT JOIN editorial_papers p"
                + " ON p.id=i.paper_id LEFT JOIN users u ON u.id=i.claimed_by"
                + where
                + " ORDER BY p.title,CASE WHEN i.original_number ~ '^\\d{1,8}$' THEN"
                + " i.original_number::int ELSE 999999999 END,i.original_number,i.id LIMIT 40"
                + " OFFSET ?",
            paged.toArray());
    return Map.of("items", items, "total", total, "page", Math.max(1, page), "pageSize", 40);
  }

  public Map<String, Object> detail(UUID id) {
    Map<String, Object> row = row(id, false);
    if ("TRASH".equals(row.get("status"))) throw BusinessException.conflict("PROBLEM_DELETED", "题目已移入回收站");
    row.put("document", decode(row.remove("payload")));
    row.put(
        "history",
        db.queryForList(
            "SELECT h.id,h.version,h.action,h.note,h.created_at,u.username FROM editorial_history h"
                + " LEFT JOIN users u ON u.id=h.actor_id WHERE item_id=? ORDER BY h.id DESC LIMIT"
                + " 100",
            id));
    row.put(
        "availableAssets",
        db.queryForList(
            "SELECT id,filename,url,mime_type FROM editorial_assets WHERE item_id=? ORDER BY"
                + " created_at",
            id));
    row.put(
        "curriculumSuggestions",
        curriculum.suggest(((EditorialDocument) row.get("document")).tags()));
    return row;
  }

  @Transactional
  public Map<String, Object> acquire(Long actor, UUID id) {
    permission(actor);
    var row = row(id, true);
    if ("TRASH".equals(row.get("status"))) throw BusinessException.conflict("PROBLEM_DELETED", "题目已移入回收站");
    Object owner = row.get("claimed_by");
    boolean expired = db.queryForObject("SELECT claimed_at IS NULL OR claimed_at < now()-interval '20 minutes' FROM editorial_items WHERE id=?", Boolean.class, id);
    if (owner != null && ((Number) owner).longValue() != actor && !expired)
      throw BusinessException.conflict("CLAIMED", "另一位管理员正在处理此题，请选择其他题目");
    db.update("UPDATE editorial_items SET claimed_by=?,claimed_at=now() WHERE id=?", actor, id);
    return detail(id);
  }

  @Transactional
  public void releaseLease(Long actor, UUID id) {
    db.update("UPDATE editorial_items SET claimed_by=NULL,claimed_at=NULL WHERE id=? AND claimed_by=?", id, actor);
  }

  public EditorialDocument history(UUID id, Long historyId) {
    var rows =
        db.queryForList(
            "SELECT payload FROM editorial_history WHERE item_id=? AND id=?", id, historyId);
    if (rows.isEmpty()) throw BusinessException.notFound("HISTORY", "历史版本不存在");
    return decode(rows.getFirst().get("payload"));
  }

  private Map<String, Object> row(UUID id, boolean lock) {
    var rows =
        db.queryForList(
            "SELECT * FROM editorial_items WHERE id=?" + (lock ? " FOR UPDATE" : ""), id);
    if (rows.isEmpty()) throw BusinessException.notFound("WORK_ITEM", "草稿不存在");
    return rows.getFirst();
  }

  private Map<String, Object> editable(Long actor, UUID id, long version) {
    var row = row(id, true);
    if ("TRASH".equals(row.get("status"))) throw BusinessException.conflict("PROBLEM_DELETED", "题目已移入回收站");
    if (((Number) row.get("version")).longValue() != version)
      throw BusinessException.conflict("EDIT_CONFLICT", "其他管理员已更新此题，请保留本地修改并读取最新版本进行比较");
    Object owner = row.get("claimed_by");
    if (owner != null
        && ((Number) owner).longValue() != actor
        && !permission(actor).equals("MANAGER"))
      throw BusinessException.conflict("CLAIMED", "此题已由其他管理员领取");
    return row;
  }

  private void event(
      Long actor, UUID id, long version, String action, String note, EditorialDocument doc) {
    db.update(
        "INSERT INTO editorial_history(item_id,version,action,actor_id,note,payload) VALUES"
            + " (?,?,?,?,?,?::jsonb)",
        id,
        version,
        action,
        actor,
        Objects.toString(note, ""),
        encode(doc));
  }

  private void change(
      Long actor,
      UUID id,
      Map<String, Object> row,
      String action,
      String note,
      String status,
      EditorialDocument doc) {
    long next = ((Number) row.get("version")).longValue() + 1;
    db.update(
        "UPDATE editorial_items SET"
            + " payload=?::jsonb,version=?,status=?,updated_by=?,updated_at=now() WHERE id=?",
        encode(doc),
        next,
        status,
        actor,
        id);
    event(actor, id, next, action, note, doc);
  }

  @Transactional
  public Map<String, Object> save(Long actor, UUID id, Save request) {
    var row = editable(actor, id, request.version());
    EditorialDocument doc = canonicalTags(request.document());
    validate(id, doc, false);
    change(actor, id, row, "SAVE", request.note(), row.get("status").equals("CHANGES") ? "CHANGES" : "DRAFT", doc);
    return detail(id);
  }

  @Transactional
  public void bulk(Long actor, Bulk request) {
    if (request.items() == null
        || request.items().isEmpty()
        || request.items().size() > 100
        || !List.of("year", "source", "level", "chapters", "CLAIM", "RELEASE")
            .contains(Objects.toString(request.field(), "")))
      throw BusinessException.badRequest("BULK", "请选择1～100题及允许的修改字段");
    // Lock in a stable order to avoid deadlocks between overlapping batches.
    var targets =
        request.items().stream().sorted(Comparator.comparing(t -> t.id().toString())).toList();
    if (targets.stream().map(Target::id).distinct().count() != targets.size())
      throw BusinessException.badRequest("BULK", "批量列表存在重复题目");
    for (var target : targets) {
      var row = editable(actor, target.id(), target.version());
      var d = decode(row.get("payload"));
      if (request.field().equals("CLAIM") || request.field().equals("RELEASE")) {
        db.update(
            "UPDATE editorial_items SET claimed_by=?,claimed_at=now() WHERE id=?",
            request.field().equals("CLAIM") ? actor : null,
            target.id());
        change(
            actor,
            target.id(),
            row,
            request.field(),
            request.note(),
            row.get("status").toString(),
            d);
        continue;
      }
      Integer year = d.year();
      if (request.field().equals("year")) {
        try {
          year = Integer.valueOf(request.value());
        } catch (Exception e) {
          throw BusinessException.badRequest("YEAR", "年份应为数字");
        }
        if (year < 0 || year > 9999) throw BusinessException.badRequest("YEAR", "年份范围为0000～9999");
      }
      String level = request.field().equals("level") ? request.value() : d.level();
      if (request.field().equals("level") && !MarkdownQuestionParser.LEVELS.contains(level))
        throw BusinessException.badRequest("LEVEL", "请选择 D1～D7");
      var next =
          new EditorialDocument(
              d.title(),
              year,
              request.field().equals("source") ? request.value() : d.source(),
              d.type(),
              level,
              d.tags(),
              d.content(),
              d.answer(),
              d.solution(),
              d.assets(),
              d.imageReferences(),
              d.originalMetadata(),
              d.warnings(),
              request.field().equals("chapters")
                  ? new cn.mathsea.backend.curriculum.CurriculumAnnotation(
                      cn.mathsea.backend.curriculum.CurriculumAnnotation.VERSION,
                      curriculum.validateCodes(
                          Arrays.stream(Objects.toString(request.value(), "").split("[,，]"))
                              .map(String::trim)
                              .filter(s -> !s.isBlank())
                              .toList()),
                      false)
                  : d.curriculum());
      validate(target.id(), next, false);
      change(actor, target.id(), row, "BULK", request.note(), row.get("status").equals("CHANGES") ? "CHANGES" : "DRAFT", next);
    }
  }

  @Transactional
  public Map<String, Object> manual(Long actor) {
    UUID id = UUID.randomUUID();
    var doc =
        new EditorialDocument(
            "",
            null,
            "",
            "single-choice",
            "red",
            List.of(),
            "",
            "",
            "",
            List.of(),
            List.of(),
            Map.of(),
            List.of());
    db.update(
        "INSERT INTO editorial_items(id,original_number,payload,created_by,updated_by,claimed_by)"
            + " VALUES (?,'0',?::jsonb,?,?,?)",
        id,
        encode(doc),
        actor,
        actor,
        actor);
    event(actor, id, 1, "CREATE", "手动录题", doc);
    return detail(id);
  }

  @Transactional
  public Map<String, Object> fromPublished(Long actor, String number) {
    number = problems.detail(number).problemNumber();
    // Serialize the initial copy so concurrent editors share one work item.
    db.queryForList("SELECT id FROM problems WHERE problem_number=? FOR UPDATE", number);
    var existing = db.queryForList("SELECT id,status,purged_at,version FROM editorial_items WHERE problem_number=? FOR UPDATE", number);
    boolean renew = !existing.isEmpty() && existing.getFirst().get("purged_at") != null;
    if (!existing.isEmpty() && !renew) {
      if ("TRASH".equals(existing.getFirst().get("status")))
        throw BusinessException.conflict("DRAFT_TRASHED","此题的修订草稿已在回收站，请负责人恢复草稿后继续修改；公开版本未改变");
      return detail((UUID) existing.getFirst().get("id"));
    }
    var p = problems.detail(number);
    UUID id = renew ? (UUID) existing.getFirst().get("id") : UUID.randomUUID();
    var assets =
        p.assets().stream()
            .map(
                a ->
                    new EditorialDocument.Asset(
                        UUID.randomUUID().toString(),
                        a.url(),
                        a.mimeType(),
                        a.altText(),
                        "content"))
            .toList();
    var doc =
        new EditorialDocument(
            p.title(),
            p.year(),
            p.sourceLabel(),
            p.type(),
            p.level(),
            p.tags(),
            p.content(),
            p.answer(),
            p.solution(),
            assets,
            List.of(),
            Map.of("source_category", number.substring(0, 1)),
            List.of(),
            curriculum.forProblem(
                db.queryForObject(
                    "SELECT id FROM problems WHERE problem_number=?", Long.class, number)));
    if(renew) {
      db.update("UPDATE editorial_items SET status='PUBLISHED',payload=?::jsonb,purged_at=NULL,trash_scope=NULL,trashed_at=NULL,trash_previous_status=NULL,version=version+1,updated_by=?,updated_at=now() WHERE id=?",encode(doc),actor,id);
    } else db.update(
        "INSERT INTO"
            + " editorial_items(id,original_number,original_id,problem_number,status,payload,created_by,updated_by)"
            + " VALUES (?,'0',?,?,'PUBLISHED',?::jsonb,?,?)",
        id,
        number,
        number,
        encode(doc),
        actor,
        actor);
    for (var a : assets)
      db.update(
          "INSERT INTO editorial_assets(id,item_id,filename,checksum,url,mime_type) VALUES"
              + " (?,?,?,'legacy',?,?)",
          UUID.fromString(a.id()),
          id,
          a.id(),
          a.url(),
          a.mimeType());
    event(actor, id, renew ? ((Number)existing.getFirst().get("version")).longValue()+1 : 1, "BASELINE", "已发布内容快照", doc);
    return detail(id);
  }

  @Transactional
  public Map<String, Object> action(Long actor, UUID id, Action request) {
    var row = editable(actor, id, request.version());
      var doc = canonicalTags(decode(row.get("payload")));
    String status = row.get("status").toString();
    switch (request.action()) {
      case "CLAIM" -> db.update("UPDATE editorial_items SET claimed_by=?,claimed_at=now() WHERE id=?", actor, id);
      case "RELEASE" -> db.update("UPDATE editorial_items SET claimed_by=NULL WHERE id=?", id);
      case "SUBMIT" -> {
        validate(id, doc, true);
        status = "REVIEW";
        db.update("UPDATE editorial_items SET claimed_by=NULL WHERE id=?", id);
      }
      case "RETURN" -> {
        reviewer(actor);
        if (Objects.toString(request.note(), "").isBlank())
          throw BusinessException.badRequest("NOTE_REQUIRED", "请填写退回原因");
        status = "CHANGES";
        String issue = Objects.toString(request.note(), "").split("：", 2)[0];
        if (!List.of("答案", "解析", "图片", "排版", "标签", "其他").contains(issue)) issue = "其他";
        db.update("UPDATE editorial_items SET issue_type=?,claimed_by=NULL,claimed_at=NULL WHERE id=?", issue, id);
      }
      case "RESTORE" -> {
        doc = history(id, request.historyId());
        status = "DRAFT";
      }
      case "PUBLISH" -> {
        reviewer(actor);
        if (!List.of("REVIEW", "DRAFT").contains(status))
          throw BusinessException.conflict("REVIEW_FIRST", "请先提交复核，再发布");
        validate(id, doc, true);
        publish(actor, id, row, doc);
        status = "PUBLISHED";
        db.update("UPDATE editorial_items SET claimed_by=NULL WHERE id=?", id);
      }
      default -> throw BusinessException.badRequest("ACTION", "未知操作");
    }
    change(actor, id, row, request.action(), request.note(), status, doc);
    return detail(id);
  }

  private void publish(Long actor, UUID id, Map<String, Object> row, EditorialDocument doc) {
    String source = null;
    if (!Objects.toString(doc.source(), "").isBlank()) {
      var found =
          db.queryForList(
              "SELECT code FROM problem_sources WHERE (code=? OR label=?) AND active=true ORDER BY"
                  + " code LIMIT 1",
              doc.source(),
              doc.source());
      if (found.isEmpty()) {
        source = "s-" + sha(doc.source().getBytes(StandardCharsets.UTF_8)).substring(0, 24);
        db.update(
            "INSERT INTO problem_sources(code,label) VALUES (?,?) ON CONFLICT(code) DO NOTHING",
            source,
            doc.source());
      } else source = found.getFirst().get("code").toString();
    }
    String number = (String) row.get("problem_number");
    boolean fresh = number == null;
    String category = doc.originalMetadata().get("source_category");
    if (category == null || category.isBlank()) {
      category =
          fresh
              ? db.queryForObject(
                  "SELECT question_source_category(?)",
                  String.class,
                  doc.title() + " " + doc.source())
              : number.substring(0, 1);
    }
    if (!List.of("G", "E", "T", "N").contains(category))
      throw BusinessException.badRequest("SOURCE_CATEGORY", "来源类别请选择 G、E、T 或 N");
    String previousNumber = number;
    if (fresh) {
      // The row lock serializes all prefixes and rolls back with a failed publication.
      Integer allocated =
          db.queryForObject(
              "SELECT last_number FROM question_number_counter WHERE singleton FOR UPDATE",
              Integer.class);
      if (allocated == null || allocated >= 999999)
        throw BusinessException.conflict("NUMBER_CAPACITY", "六位题号已用完，请联系负责人扩容");
      number =
          db.queryForObject(
              "SELECT allocate_question_number(?,?)", String.class, category, doc.type());
    } else {
      number =
          category
              + db.queryForObject("SELECT question_type_letter(?)", String.class, doc.type())
              + number.substring(2);
    }
    String content = resolveImages(doc.content(), doc, "content"),
        answer = resolveImages(doc.answer(), doc, "answer"),
        solution = resolveImages(doc.solution(), doc, "solution");
    var request =
        new AdminProblemRequest(
            number,
            doc.title(),
            doc.year(),
            null,
            source,
            doc.type(),
            doc.level(),
            doc.tags(),
            content,
            answer,
            solution,
            "markdown-latex-v1");
    if (fresh) problems.create(actor, request);
    else {
      if (!number.equals(previousNumber)) {
        db.update(
            "INSERT INTO problem_number_aliases(old_number,problem_id) SELECT ?,id FROM problems"
                + " WHERE problem_number=? ON CONFLICT(old_number) DO NOTHING",
            previousNumber,
            previousNumber);
      }
      problems.update(actor, previousNumber, request);
    }
    Long problemId =
        db.queryForObject("SELECT id FROM problems WHERE problem_number=?", Long.class, number);
    curriculum.publish(problemId, doc.curriculum());
    db.update("UPDATE problems SET tag_mapping_blocked=? WHERE id=?", !Objects.toString(doc.originalMetadata().get("unmapped_tags"),"").isBlank(),problemId);
    // Physical files remain referenced by history; only the public attachment list is replaced.
    db.update("DELETE FROM problem_assets WHERE problem_id=?", problemId);
    int order = 0;
    for (var a : doc.assets())
      if (a.section().equals("content") && !content.contains("](" + a.url() + ")"))
        db.update(
            "INSERT INTO problem_assets(problem_id,url,mime_type,alt_text,sort_order) VALUES"
                + " (?,?,?,?,?)",
            problemId,
            a.url(),
            a.mimeType(),
            a.altText(),
            order++);
    db.update("UPDATE editorial_items SET problem_number=? WHERE id=?", number, id);
  }

  private String resolveImages(String text, EditorialDocument doc, String section) {
    String result = Objects.toString(text, "");
    for (var a : doc.assets()) {
      result = result.replace("](" + a.altText() + ")", "](" + a.url() + ")");
      if (a.section().equals(section)
          && !section.equals("content")
          && !result.contains("](" + a.url() + ")")) result += "\n\n![](" + a.url() + ")";
    }
    return result;
  }

  @Transactional
  public Map<String, Object> upload(
      Long actor, UUID id, long version, MultipartFile file, String section) {
    var row = editable(actor, id, version);
    var doc = decode(row.get("payload"));
    var asset = store(id, file, section);
    var assets = new ArrayList<>(doc.assets());
    if (assets.stream().noneMatch(a -> a.id().equals(asset.id()))) assets.add(asset);
    var next =
        new EditorialDocument(
            doc.title(),
            doc.year(),
            doc.source(),
            doc.type(),
            doc.level(),
            doc.tags(),
            doc.content(),
            doc.answer(),
            doc.solution(),
            assets,
            doc.imageReferences(),
            doc.originalMetadata(),
            doc.warnings(),
            doc.curriculum());
    change(actor, id, row, "IMAGE", "上传图片 " + file.getOriginalFilename(), row.get("status").equals("CHANGES") ? "CHANGES" : "DRAFT", next);
    return detail(id);
  }

  private EditorialDocument.Asset store(UUID id, MultipartFile file, String section) {
    String name = clean(Objects.toString(file.getOriginalFilename(), "image"), 255, "图片名称");
    String hash;
    try {
      hash = sha(file.getBytes());
    } catch (Exception e) {
      throw BusinessException.badRequest("FILE_READ", "无法读取图片");
    }
    var prior =
        db.queryForList(
            "SELECT * FROM editorial_assets WHERE item_id=? AND filename=? AND checksum=?",
            id,
            name,
            hash);
    UUID assetId;
    String url, mime;
    if (!prior.isEmpty()) {
      var a = prior.getFirst();
      assetId = (UUID) a.get("id");
      url = a.get("url").toString();
      mime = a.get("mime_type").toString();
    } else {
      var stored = storage.saveProblemImage(file, "draft-" + id);
      assetId = UUID.randomUUID();
      url = stored.url();
      mime = stored.mimeType();
      final String cleanupUrl = url;
      org.springframework.transaction.support.TransactionSynchronizationManager
          .registerSynchronization(
              new org.springframework.transaction.support.TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                  if (status != STATUS_COMMITTED) storage.deleteUrl(cleanupUrl);
                }
              });
      db.update(
          "INSERT INTO editorial_assets(id,item_id,filename,checksum,url,mime_type) VALUES"
              + " (?,?,?,?,?,?)",
          assetId,
          id,
          name,
          hash,
          url,
          mime);
    }
    return new EditorialDocument.Asset(
        assetId.toString(),
        url,
        mime,
        name,
        List.of("content", "answer", "solution").contains(Objects.toString(section, ""))
            ? section
            : "content");
  }

  @Transactional
  public Map<String, Object> importFile(
      Long actor,
      UUID batch,
      UUID paper,
      String path,
      MultipartFile file,
      List<MultipartFile> images) {
    if (file.isEmpty()
        || file.getSize() > 2 * 1024 * 1024
        || !Objects.toString(file.getOriginalFilename(), "")
            .toLowerCase(Locale.ROOT)
            .endsWith(".md"))
      throw BusinessException.badRequest("MARKDOWN_FILE", "请选择不超过2MB的 MD 文件");
    if (db.queryForObject(
            "SELECT count(*) FROM editorial_batches WHERE id=? AND actor_id=?",
            Long.class,
            batch,
            actor)
        == 0) throw BusinessException.forbidden("BATCH_OWNER", "只能向自己创建的批次上传");
    path = clean(path, 1000, "文件路径");
    String raw;
    try {
      raw =
          StandardCharsets.UTF_8
              .newDecoder()
              .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
              .decode(java.nio.ByteBuffer.wrap(file.getBytes()))
              .toString();
    } catch (Exception e) {
      throw BusinessException.badRequest("FILE_READ", "无法读取 MD，请保存为 UTF-8 编码");
    }
    var parsed = parser.parse(raw, file.getOriginalFilename());
    clean(parsed.originalId(), 255, "原始 ID");
    clean(parsed.number(), 80, "原卷题号");
    // Paper lock serializes duplicate detection without relying on filenames or hashes for
    // identity.
    if (db.queryForList("SELECT id FROM editorial_papers WHERE id=? FOR UPDATE", paper).isEmpty())
      throw BusinessException.badRequest("PAPER_REQUIRED", "请先确认试卷归属");
    String checksum = importChecksum(raw, images);
    var previous =
        db.queryForList(
            "SELECT item_id,checksum,result FROM editorial_import_entries WHERE batch_id=? AND"
                + " path=?",
            batch,
            path);
    if (!previous.isEmpty()
        && checksum.equals(previous.getFirst().get("checksum"))
        && "IMPORTED".equals(previous.getFirst().get("result")))
      return Map.of(
          "result",
          "SKIPPED",
          "itemId",
          previous.getFirst().get("item_id"),
          "message",
          "此批次已导入，可在复核页补充图片");
    String number =
        parsed.number().equals("0")
            ? "0-" + sha(parsed.originalId().getBytes(StandardCharsets.UTF_8)).substring(0, 24)
            : parsed.number();
    var prior =
        db.queryForList(
            "SELECT id FROM editorial_items WHERE paper_id=? AND original_number=?", paper, number);
    if (!prior.isEmpty()) {
      UUID existing = (UUID) prior.getFirst().get("id");
      var hashes =
          db.queryForList(
              "SELECT checksum FROM editorial_import_fingerprints WHERE item_id=?", existing);
      boolean same = hashes.stream().anyMatch(h -> checksum.equals(h.get("checksum")));
      String result = same ? "SKIPPED" : "CONFLICT";
      String message = same ? "相同原文件已导入；补图请打开草稿" : "此试卷题号已有内容，请打开现有草稿比较修改；未覆盖";
      record(batch, path, checksum, existing, result, message);
      return Map.of("result", result, "itemId", existing, "message", message);
    }
    UUID id = UUID.randomUUID();
    var doc = canonicalTags(parsed.document());
    validate(null, doc, false);
    db.update(
        "INSERT INTO"
            + " editorial_items(id,paper_id,original_number,original_id,payload,raw_markdown,created_by,updated_by)"
            + " VALUES (?,?,?,?,?::jsonb,?,?,?)",
        id,
        paper,
        number,
        parsed.originalId(),
        encode(doc),
        raw,
        actor,
        actor);
    List<EditorialDocument.Asset> assets = new ArrayList<>();
    for (var image : images) assets.add(store(id, image, "content"));
    doc =
        new EditorialDocument(
            doc.title(),
            doc.year(),
            doc.source(),
            doc.type(),
            doc.level(),
            doc.tags(),
            doc.content(),
            doc.answer(),
            doc.solution(),
            assets,
            doc.imageReferences(),
            doc.originalMetadata(),
            doc.warnings(),
            doc.curriculum());
    db.update("UPDATE editorial_items SET payload=?::jsonb WHERE id=?", encode(doc), id);
    event(actor, id, 1, "IMPORT", "规则1.2；" + path, doc);
    record(batch, path, checksum, id, "IMPORTED", "已保存草稿，等待复核");
    db.update("INSERT INTO editorial_import_fingerprints VALUES (?,?)", id, checksum);
    return Map.of("result", "IMPORTED", "itemId", id, "message", "已保存草稿，等待复核");
  }

  private String importChecksum(String raw, List<MultipartFile> images) {
    try {
      var digest = MessageDigest.getInstance("SHA-256");
      digest.update(raw.getBytes(StandardCharsets.UTF_8));
      for (var image :
          images.stream()
              .sorted(Comparator.comparing(i -> Objects.toString(i.getOriginalFilename(), "")))
              .toList()) {
        digest.update((byte) 0);
        digest.update(
            Objects.toString(image.getOriginalFilename(), "").getBytes(StandardCharsets.UTF_8));
        digest.update((byte) 0);
        digest.update(image.getBytes());
      }
      return HexFormat.of().formatHex(digest.digest());
    } catch (Exception e) {
      throw BusinessException.badRequest("FILE_READ", "无法读取上传文件");
    }
  }

  public void failure(Long actor, UUID batch, String path, String message) {
    if (db.queryForObject(
            "SELECT count(*) FROM editorial_batches WHERE id=? AND actor_id=?",
            Long.class,
            batch,
            actor)
        > 0) record(batch, clean(path, 1000, "文件路径"), "", null, "FAILED", message);
  }

  private void record(
      UUID batch, String path, String checksum, UUID item, String result, String message) {
    db.update(
        "INSERT INTO editorial_import_entries(batch_id,path,checksum,item_id,result,message) VALUES"
            + " (?,?,?,?,?,?) ON CONFLICT(batch_id,path) DO UPDATE SET"
            + " checksum=excluded.checksum,item_id=excluded.item_id,result=excluded.result,message=excluded.message,created_at=now()",
        batch,
        path,
        checksum,
        item,
        result,
        message);
  }

  private void validate(UUID id, EditorialDocument d, boolean complete) {
    if (d == null
        || d.tags() == null
        || d.assets() == null
        || d.imageReferences() == null
        || d.originalMetadata() == null
        || d.warnings() == null) throw BusinessException.badRequest("DOCUMENT", "草稿字段不完整");
    if (Objects.toString(d.title(), "").length() > 255
        || Objects.toString(d.source(), "").length() > 100
        || d.tags().size() > 50
        || d.assets().size() > 50
        || encode(d).length() > 2 * 1024 * 1024)
      throw BusinessException.badRequest("DOCUMENT_SIZE", "草稿字段或附件超过限制");
    curriculum.validate(d.curriculum());
    for (var a : d.assets()) {
      if (id == null
          || a == null
          || !List.of("content", "answer", "solution").contains(a.section())
          || Objects.toString(a.altText(), "").length() > 255)
        throw BusinessException.badRequest("ASSET", "图片关联不合法");
      if (db.queryForObject(
              "SELECT count(*) FROM editorial_assets WHERE id::text=? AND item_id=? AND url=? AND"
                  + " mime_type=?",
              Long.class,
              a.id(),
              id,
              a.url(),
              a.mimeType())
          == 0) throw BusinessException.badRequest("ASSET", "不能引用其他题目的图片");
    }
    if (complete) {
      if (Objects.toString(d.content(), "").isBlank() || Objects.toString(d.title(), "").isBlank())
        throw BusinessException.badRequest("CONTENT", "请填写标题和题干");
      if (!List.of("single-choice", "multiple-choice", "fill-blank", "solution")
              .contains(Objects.toString(d.type(), ""))
          || !MarkdownQuestionParser.LEVELS.contains(d.level()))
        throw BusinessException.badRequest("CLASSIFICATION", "请选择题型和 D1～D7 难度");
      if (d.year() != null && (d.year() < 0 || d.year() > 9999))
        throw BusinessException.badRequest("YEAR", "年份应为0000～9999");
      for (String tag : d.tags())
        if (tag == null
            || db.queryForObject(
                    "SELECT count(*) FROM tags WHERE name=? AND active=true", Long.class, tag)
                == 0) throw BusinessException.badRequest("TAG", "未知或停用标签：" + tag + "。请先在标签管理中维护");
      for (String ref : d.imageReferences())
        if (d.assets().stream().noneMatch(a -> Objects.equals(a.altText(), ref)))
          throw BusinessException.badRequest("MISSING_IMAGE", "尚未关联图片：" + ref + "；请补图或确认不需要后移除引用");
      for (String text :
          List.of(
              Objects.toString(d.content(), ""),
              Objects.toString(d.answer(), ""),
              Objects.toString(d.solution(), ""))) {
        var references =
            java.util.regex.Pattern.compile("!\\[[^]\\n]*]\\(([^)\\n]+)\\)").matcher(text);
        while (references.find()) {
          String ref = references.group(1);
          if (d.assets().stream()
              .noneMatch(a -> Objects.equals(a.url(), ref) || Objects.equals(a.altText(), ref)))
            throw BusinessException.badRequest("MISSING_IMAGE", "正文引用的图片尚未关联：" + ref);
        }
      }
    }
  }

  private String clean(String value, int max, String label) {
    if (value == null || value.isBlank() || value.length() > max)
      throw BusinessException.badRequest("FIELD", label + "为空或过长");
    return value.trim();
  }

  private String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private EditorialDocument decode(Object value) {
    try {
      return json.readValue(value.toString(), EditorialDocument.class);
    } catch (Exception e) {
      throw new IllegalStateException("无法读取草稿", e);
    }
  }

  private String sha(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
