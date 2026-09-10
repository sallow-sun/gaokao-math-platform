package cn.mathsea.backend.admin.service;

import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.common.storage.LocalFileStorageService;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProblemTrashService {
  private final JdbcTemplate db;
  private final AuditLogService audit;
  private final LocalFileStorageService storage;

  private void manager(Long actor) {
    if (db.queryForObject("SELECT count(*) FROM editorial_permissions ep JOIN users u ON u.id=ep.user_id WHERE ep.user_id=? AND ep.permission='MANAGER' AND u.role='ADMIN'", Long.class, actor) == 0)
      throw BusinessException.forbidden("MANAGER_REQUIRED", "仅负责人可管理回收站");
  }
  public Object list(Long actor, String keyword, int page) {
    manager(actor);
    String q = "%" + Objects.toString(keyword, "").trim() + "%";
    var total = db.queryForObject("SELECT count(*) FROM problems WHERE deleted AND purged_at IS NULL AND (problem_number ILIKE ? OR title ILIKE ?)", Long.class,q,q);
    var items = db.queryForList("SELECT problem_number AS id,title,deleted_at FROM problems WHERE deleted AND purged_at IS NULL AND (problem_number ILIKE ? OR title ILIKE ?) ORDER BY deleted_at DESC,id LIMIT 40 OFFSET ?",q,q,(Math.max(1,page)-1)*40);
    return Map.of("items",items,"total",total,"page",Math.max(1,page));
  }
  private Map<String,Object> lock(String number) {
    db.queryForList("SELECT id FROM editorial_items WHERE problem_number=? ORDER BY id FOR UPDATE",number);
    var rows = db.queryForList("SELECT id,deleted,purged_at FROM problems WHERE problem_number=? FOR UPDATE",number);
    if (rows.isEmpty()) throw BusinessException.notFound("PROBLEM_NOT_FOUND","题目不存在");
    return rows.getFirst();
  }
  @Transactional
  public void delete(Long actor, List<String> numbers) {
    manager(actor);
    if (numbers == null || numbers.isEmpty() || numbers.size()>100 || numbers.stream().anyMatch(Objects::isNull)) throw BusinessException.badRequest("SELECTION","请选择1至100题");
    for (String number : numbers.stream().distinct().sorted().toList()) {
      var p=lock(number);
      if (Boolean.TRUE.equals(p.get("deleted"))) continue;
      db.update("UPDATE problems SET deleted=true,deleted_at=now() WHERE id=?",p.get("id"));
      db.update("UPDATE editorial_items SET trash_previous_status=status,status='TRASH',claimed_by=NULL,claimed_at=NULL,version=version+1 WHERE problem_number=?",number);
      audit.log(actor,"PROBLEM_TRASH","PROBLEM",number,"移入回收站");
    }
  }
  @Transactional
  public void restore(Long actor,String number) {
    manager(actor); var p=lock(number);
    if (!Boolean.TRUE.equals(p.get("deleted")) || p.get("purged_at")!=null) throw BusinessException.conflict("TRASH_STATE","此题不在可恢复的回收站中");
    db.update("UPDATE problems SET deleted=false,deleted_at=NULL WHERE id=?",p.get("id"));
    db.update("UPDATE editorial_items SET status=coalesce(trash_previous_status,'PUBLISHED'),trash_previous_status=NULL,version=version+1 WHERE problem_number=? AND status='TRASH'",number);
    audit.log(actor,"PROBLEM_RESTORE","PROBLEM",number,"恢复公开题目及原审核状态");
  }
  @Transactional
  public void purge(Long actor,String number,String confirmation) {
    manager(actor);
    if (!number.equals(confirmation)) throw BusinessException.badRequest("CONFIRMATION","请准确输入题号确认彻底删除");
    var p=lock(number);
    if (!Boolean.TRUE.equals(p.get("deleted")) || p.get("purged_at")!=null) throw BusinessException.conflict("TRASH_STATE","请先将题目移入回收站");
    var urls=db.queryForList("SELECT url FROM problem_assets WHERE problem_id=? UNION SELECT a.url FROM editorial_assets a JOIN editorial_items i ON i.id=a.item_id WHERE i.problem_number=?",String.class,p.get("id"),number);
    db.update("DELETE FROM problem_assets WHERE problem_id=?",p.get("id"));
    db.update("DELETE FROM editorial_assets WHERE item_id IN (SELECT id FROM editorial_items WHERE problem_number=?)",number);
    db.update("DELETE FROM editorial_history WHERE item_id IN (SELECT id FROM editorial_items WHERE problem_number=?)",number);
    db.update("UPDATE editorial_items SET payload='{}'::jsonb,raw_markdown=NULL,version=version+1 WHERE problem_number=?",number);
    db.update("UPDATE problems SET content='',answer='',solution='',title='题目已删除',purged_at=now() WHERE id=?",p.get("id"));
    // Keep the number and user/list references as tombstones. Only delete unshared files after commit.
    var unused=urls.stream().filter(url -> db.queryForObject("SELECT (SELECT count(*) FROM problem_assets WHERE url=?)+(SELECT count(*) FROM editorial_assets WHERE url=?)",Long.class,url,url)==0).toList();
    org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization(){
      @Override public void afterCommit() { for(String url:unused) { try { storage.deleteUrl(url); } catch(RuntimeException ignored) { /* retained orphan can be cleaned later */ } } }
    });
    audit.log(actor,"PROBLEM_PURGE","PROBLEM",number,"清除题目内容，保留题号占位及审计记录");
  }
}
