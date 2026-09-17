package cn.mathsea.backend.growth;

import cn.mathsea.backend.admin.service.AuditLogService;
import cn.mathsea.backend.common.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GrowthService {
  public record Rules(
      String version,
      List<Long> thresholds,
      int dailyStudy,
      int firstProblem,
      int problemDailyCap,
      int acceptedUpload,
      int uploadDailyCap,
      int acceptedFeedback,
      int feedbackDailyCap) {}

  public record Summary(
      int level,
      long experience,
      long levelStart,
      Long nextThreshold,
      long remaining,
      Rules rules) {}

  private final JdbcTemplate db;
  private final AuditLogService audit;
  private final Rules rules;

  public GrowthService(JdbcTemplate db, ObjectMapper json, AuditLogService audit) throws Exception {
    this.db = db;
    this.audit = audit;
    try (var stream = new ClassPathResource("growth-rules.json").getInputStream()) {
      rules = json.readValue(stream, Rules.class);
    }
    if (rules.thresholds() == null
        || rules.thresholds().size() != 7
        || rules.thresholds().getFirst() != 0
        || rules.version() == null
        || rules.version().length() > 40)
      throw new IllegalArgumentException("Invalid growth rules");
    for (int i = 1; i < rules.thresholds().size(); i++)
      if (rules.thresholds().get(i) <= rules.thresholds().get(i - 1))
        throw new IllegalArgumentException("Non-increasing growth thresholds");
    for (int value :
        new int[] {
          rules.dailyStudy(),
          rules.firstProblem(),
          rules.problemDailyCap(),
          rules.acceptedUpload(),
          rules.uploadDailyCap(),
          rules.acceptedFeedback(),
          rules.feedbackDailyCap()
        })
      if (value < 0 || value > 10000) throw new IllegalArgumentException("Invalid growth reward");
  }

  public void lockAccount(Long user) {
    if (db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", user).isEmpty())
      throw BusinessException.notFound("USER_NOT_FOUND", "用户不存在");
  }

  private boolean seen(Long user, String key) {
    return db.queryForObject(
            "SELECT count(*) FROM user_growth_events WHERE user_id=? AND event_key=?",
            Long.class,
            user,
            key)
        > 0;
  }

  private String day() {
    return db.queryForObject(
        "SELECT (now() AT TIME ZONE 'Asia/Shanghai')::date::text", String.class);
  }

  private void award(Long user, String key, String kind, int points, int cap, String description) {
    if (seen(user, key)) return;
    long used =
        db.queryForObject(
            "SELECT COALESCE(sum(points),0) FROM user_growth_events WHERE user_id=? AND"
                + " earned_on=(now() AT TIME ZONE 'Asia/Shanghai')::date AND kind=? AND points>0",
            Long.class,
            user,
            kind);
    int awarded = (int) Math.max(0, Math.min(points, cap - used));
    db.update(
        "INSERT INTO user_growth_events(user_id,event_key,kind,points,description,rule_version)"
            + " VALUES (?,?,?,?,?,?)",
        user,
        key,
        kind,
        awarded,
        description + (awarded == 0 ? "（今日额度已用完，不重复补发）" : ""),
        rules.version());
  }

  @Transactional
  public void completed(Long user, Long problem) {
    lockAccount(user);
    String key = "problem:" + problem;
    if (seen(user, key)) return;
    String number =
        db.queryForObject("SELECT problem_number FROM problems WHERE id=?", String.class, problem);
    award(
        user,
        key,
        "PROBLEM",
        rules.firstProblem(),
        rules.problemDailyCap(),
        "首次标记 " + number + " 已做");
    award(user, "study:" + day(), "STUDY", rules.dailyStudy(), rules.dailyStudy(), "今日首次有效学习");
  }

  @Transactional
  public void uploadAccepted(Long user, Long reviewer, String fingerprint) {
    if (user == null || user.equals(reviewer)) return;
    lockAccount(user);
    award(
        user,
        "upload:" + fingerprint,
        "UPLOAD",
        rules.acceptedUpload(),
        rules.uploadDailyCap(),
        "投稿题目通过审核");
  }

  @Transactional
  public void feedbackAccepted(Long feedbackId, Long reviewer) {
    var rows =
        db.queryForList(
            "SELECT user_id,problem_id FROM problem_feedback WHERE id=? AND status='RESOLVED'",
            feedbackId);
    if (rows.isEmpty()) return;
    var row = rows.getFirst();
    Long user = (Long) row.get("user_id");
    if (user == null || user.equals(reviewer)) return;
    lockAccount(user);
    award(
        user,
        "feedback:" + row.get("problem_id"),
        "FEEDBACK",
        rules.acceptedFeedback(),
        rules.feedbackDailyCap(),
        "题目纠错被采纳");
  }

  public Summary summary(Long user) {
    long xp =
        db.queryForObject(
            "SELECT GREATEST(COALESCE(sum(points),0),0) FROM user_growth_events WHERE user_id=?",
            Long.class,
            user);
    int level = 0;
    while (level + 1 < rules.thresholds().size() && xp >= rules.thresholds().get(level + 1))
      level++;
    Long next = level + 1 < rules.thresholds().size() ? rules.thresholds().get(level + 1) : null;
    return new Summary(
        level, xp, rules.thresholds().get(level), next, next == null ? 0 : next - xp, rules);
  }

  public Object history(Long user, int page) {
    long total =
        db.queryForObject(
            "SELECT count(*) FROM user_growth_events WHERE user_id=? AND kind<>'BASELINE'",
            Long.class,
            user);
    int current = Math.max(1, Math.min(page, (int) Math.max(1, (total + 19) / 20)));
    return Map.of(
        "summary",
        summary(user),
        "total",
        total,
        "page",
        current,
        "items",
        db.queryForList(
            "SELECT id,kind,points,description,rule_version,created_at FROM user_growth_events"
                + " WHERE user_id=? AND kind<>'BASELINE' ORDER BY id DESC LIMIT 20 OFFSET ?",
            user,
            (current - 1) * 20));
  }

  private void requireManager(Long actor) {
    if (db.queryForObject(
            "SELECT count(*) FROM users u LEFT JOIN editorial_permissions p ON p.user_id=u.id WHERE"
                + " u.id=? AND u.role='ADMIN' AND COALESCE(p.permission,CASE WHEN u.id=(SELECT"
                + " min(id) FROM users) THEN 'MANAGER' ELSE 'EDITOR' END)='MANAGER'",
            Long.class,
            actor)
        == 0) throw BusinessException.forbidden("GROWTH_PERMISSION", "仅负责人可以撤回经验");
  }

  public Object adminHistory(Long actor, Long user, int page) {
    requireManager(actor);
    var rows = db.queryForList("SELECT id,username FROM users WHERE id=?", user);
    if (rows.isEmpty()) throw BusinessException.notFound("USER_NOT_FOUND", "?????");
    return Map.of("user", rows.getFirst(), "history", history(user, page));
  }

  @Transactional
  public void revoke(Long actor, long eventId, String reason) {
    requireManager(actor);
    String note = Objects.toString(reason, "").trim();
    if (note.isEmpty() || note.length() > 300)
      throw BusinessException.badRequest("GROWTH_REASON", "请填写300字以内的撤回原因");
    var rows = db.queryForList("SELECT user_id,points FROM user_growth_events WHERE id=?", eventId);
    if (rows.isEmpty()) throw BusinessException.notFound("GROWTH_EVENT", "经验记录不存在");
    var row = rows.getFirst();
    Long user = (Long) row.get("user_id");
    lockAccount(user);
    int points = ((Number) row.get("points")).intValue();
    if (points <= 0) throw BusinessException.badRequest("GROWTH_REVOKE", "只能撤回正向经验记录");
    if (seen(user, "revoke:" + eventId)) return;
    db.update(
        "INSERT INTO"
            + " user_growth_events(user_id,event_key,kind,points,description,rule_version,reverses_id)"
            + " VALUES (?,?,'REVOKE',?,?,?,?)",
        user,
        "revoke:" + eventId,
        -points,
        "经验撤回：" + note,
        rules.version(),
        eventId);
    audit.log(actor, "GROWTH_REVOKE", "GROWTH_EVENT", Long.toString(eventId), note);
  }
}
