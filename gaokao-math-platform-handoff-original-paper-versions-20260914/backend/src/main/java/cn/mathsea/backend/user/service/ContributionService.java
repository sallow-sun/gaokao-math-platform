package cn.mathsea.backend.user.service;

import cn.mathsea.backend.common.exception.BusinessException;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ContributionService {
  private final JdbcTemplate db;
  private final com.fasterxml.jackson.databind.ObjectMapper json;

  public Object list(Long user, Long viewer, String kind, String status, int page) {
    if (db.queryForObject("SELECT count(*) FROM users WHERE id=?", Long.class, user) == 0)
      throw BusinessException.notFound("USER_NOT_FOUND", "用户不存在");
    boolean owner = user.equals(viewer);
    String uploads = "SELECT i.id::text AS id,'upload' AS kind,coalesce(p.title,i.payload->>'title',i.original_id) AS title,CASE WHEN p.deleted=false THEN p.problem_number END AS number,"
        + "CASE WHEN p.deleted=false THEN 'ACCEPTED' WHEN i.status='CHANGES' THEN 'CHANGES' WHEN i.status='TRASH' THEN 'REMOVED' ELSE 'PENDING' END AS status,"
        + "coalesce((SELECT min(h.created_at) FROM editorial_history h WHERE h.item_id=i.id),i.updated_at) AS created_at "
        + "FROM editorial_items i LEFT JOIN problems p ON p.problem_number=i.problem_number WHERE i.created_by=" + user
        + " AND i.purged_at IS NULL" + (owner ? "" : " AND p.deleted=false")
        + " UNION ALL SELECT p.id::text,'upload',p.title,p.problem_number,'ACCEPTED',p.created_at FROM problems p WHERE p.creator_user_id=" + user
        + " AND p.deleted=false AND NOT EXISTS(SELECT 1 FROM editorial_items i WHERE i.problem_number=p.problem_number)";
    String feedback = "SELECT f.id::text,'feedback',p.title,CASE WHEN p.deleted=false THEN p.problem_number END,"
        + "CASE WHEN f.status='RESOLVED' THEN 'RESOLVED' WHEN f.status='DISMISSED' THEN 'DISMISSED' ELSE 'PENDING' END,f.created_at "
        + "FROM problem_feedback f JOIN problems p ON p.id=f.problem_id WHERE f.user_id=" + user
        + (owner ? "" : " AND f.status='RESOLVED' AND p.deleted=false");
    String base = "(" + uploads + " UNION ALL " + feedback + ") contributions";
    var summary = db.queryForMap("SELECT count(*) FILTER(WHERE status='ACCEPTED') AS accepted,count(*) FILTER(WHERE status='RESOLVED') AS resolved,count(*) FILTER(WHERE status IN ('PENDING','CHANGES')) AS pending FROM " + base);
    List<Object> args = new ArrayList<>();
    String where = " WHERE true";
    if (List.of("upload", "feedback").contains(kind)) { where += " AND kind=?"; args.add(kind); }
    if (List.of("ACCEPTED", "RESOLVED", "PENDING", "CHANGES", "DISMISSED", "REMOVED").contains(status)) { where += " AND status=?"; args.add(status); }
    long total = db.queryForObject("SELECT count(*) FROM " + base + where, Long.class, args.toArray());
    int current = Math.max(1, Math.min(page, (int)Math.max(1, (total + 19) / 20)));
    args.add((current - 1) * 20);
    var rows = db.queryForList("SELECT * FROM " + base + where + " ORDER BY created_at DESC,kind,id LIMIT 20 OFFSET ?", args.toArray());
    return Map.of("items", rows, "total", total, "page", current, "summary", summary, "owner", owner);
  }

  public Object detail(Long actor, String kind, String id) {
    if ("feedback".equals(kind)) {
      long feedbackId;
      try { feedbackId = Long.parseLong(id); } catch (Exception e) { throw BusinessException.notFound("CONTRIBUTION", "记录不存在"); }
      var rows = db.queryForList("SELECT description,suggestion,response,status FROM problem_feedback WHERE id=? AND user_id=?", feedbackId, actor);
      if (rows.isEmpty()) throw BusinessException.notFound("CONTRIBUTION", "记录不存在");
      return rows.getFirst();
    }
    UUID itemId;
    try { itemId = UUID.fromString(id); } catch (Exception e) { throw BusinessException.notFound("CONTRIBUTION", "记录不存在"); }
    var rows = db.queryForList("SELECT payload::text AS document,status,(SELECT note FROM editorial_history h WHERE h.item_id=i.id AND h.action='RETURN' ORDER BY h.id DESC LIMIT 1) AS response FROM editorial_items i WHERE i.id=? AND i.created_by=? AND i.purged_at IS NULL", itemId, actor);
    if (rows.isEmpty()) throw BusinessException.notFound("CONTRIBUTION", "记录不存在");
    var row = rows.getFirst();
    try { row.put("document", json.readTree(row.get("document").toString())); }
    catch (Exception e) { throw BusinessException.badRequest("CONTRIBUTION", "题目内容读取失败"); }
    return row;
  }
}
