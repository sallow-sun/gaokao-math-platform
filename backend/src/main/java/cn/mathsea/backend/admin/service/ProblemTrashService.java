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
  private final PurgeAuthorizationService authorization;

  private void manager(Long actor) {
    if (db.queryForObject("SELECT count(*) FROM editorial_permissions ep JOIN users u ON u.id=ep.user_id WHERE ep.user_id=? AND ep.permission='MANAGER' AND u.role='ADMIN' AND u.status='ACTIVE'", Long.class, actor) == 0)
      throw BusinessException.forbidden("MANAGER_REQUIRED", "仅负责人可管理回收站");
  }
  public Object list(Long actor, String keyword, int page) {
    manager(actor);
    String q = "%" + Objects.toString(keyword, "").trim() + "%";
    String union = "(SELECT problem_number AS id,problem_number AS number,title,deleted_at,'published' AS kind,deleted_at::text AS generation FROM problems WHERE deleted AND purged_at IS NULL"
        + " UNION ALL SELECT id::text,problem_number,coalesce(payload->>'title',original_id),trashed_at,'draft',version::text FROM editorial_items WHERE status='TRASH' AND trash_scope='DRAFT' AND purged_at IS NULL) t";
    String where = " WHERE (id ILIKE ? OR title ILIKE ? OR coalesce(number,'') ILIKE ?)";
    var total = db.queryForObject("SELECT count(*) FROM " + union + where, Long.class,q,q,q);
    var items = db.queryForList("SELECT * FROM " + union + where + " ORDER BY deleted_at DESC,id LIMIT 40 OFFSET ?",q,q,q,(Math.max(1,page)-1)*40);
    return Map.of("items",items,"total",total,"page",Math.max(1,page));
  }
  private Map<String,Object> lock(String number) {
    db.queryForList("SELECT id FROM editorial_items WHERE problem_number=? ORDER BY id FOR UPDATE",number);
    var rows = db.queryForList("SELECT id,deleted,purged_at,deleted_at::text AS generation FROM problems WHERE problem_number=? FOR UPDATE",number);
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
      db.update("UPDATE editorial_items SET trash_previous_status=status,status='TRASH',trash_scope='PROBLEM',trashed_at=now(),claimed_by=NULL,claimed_at=NULL,version=version+1 WHERE problem_number=? AND status<>'TRASH'",number);
      audit.log(actor,"PROBLEM_TRASH","PROBLEM",number,"移入回收站");
    }
  }
  @Transactional
  public void restore(Long actor,String number) {
    manager(actor); var p=lock(number);
    if (!Boolean.TRUE.equals(p.get("deleted")) || p.get("purged_at")!=null) throw BusinessException.conflict("TRASH_STATE","此题不在可恢复的回收站中");
    db.update("UPDATE problems SET deleted=false,deleted_at=NULL WHERE id=?",p.get("id"));
    db.update("UPDATE editorial_items SET status=coalesce(trash_previous_status,'PUBLISHED'),trash_previous_status=NULL,trash_scope=NULL,trashed_at=NULL,version=version+1 WHERE problem_number=? AND status='TRASH' AND trash_scope='PROBLEM'",number);
    audit.log(actor,"PROBLEM_RESTORE","PROBLEM",number,"恢复公开题目及原审核状态");
  }
  public record DraftTarget(UUID id, long version) {}
  @Transactional
  public void deleteDrafts(Long actor, List<DraftTarget> items) {
    manager(actor);
    if (items == null || items.isEmpty() || items.size()>100 || items.stream().anyMatch(t -> t==null || t.id()==null)
        || items.stream().map(DraftTarget::id).distinct().count()!=items.size())
      throw BusinessException.badRequest("SELECTION","请选择1至100道不重复的题目");
    for (var target : items.stream().sorted(Comparator.comparing(DraftTarget::id)).toList()) {
      var rows = db.queryForList("SELECT *,claimed_by IS NOT NULL AND claimed_at>now()-interval '20 minutes' AS occupied FROM editorial_items WHERE id=? FOR UPDATE",target.id());
      if(rows.isEmpty()) throw BusinessException.notFound("WORK_ITEM","草稿不存在，请刷新列表");
      var row=rows.getFirst();
      if(((Number)row.get("version")).longValue()!=target.version()) throw BusinessException.conflict("EDIT_CONFLICT","所选题目已更新，请刷新列表后重新选择");
      if(!List.of("DRAFT","REVIEW").contains(row.get("status"))) throw BusinessException.conflict("TRASH_STATE","仅可删除初审中的题目，请刷新列表");
      if(Boolean.TRUE.equals(row.get("occupied")) && ((Number)row.get("claimed_by")).longValue()!=actor)
        throw BusinessException.conflict("CLAIMED","所选题目正在由其他管理员处理，请稍后重试");
      db.update("UPDATE editorial_items SET trash_previous_status=status,status='TRASH',trash_scope='DRAFT',trashed_at=now(),claimed_by=NULL,claimed_at=NULL,version=version+1,updated_at=now(),updated_by=? WHERE id=?",actor,target.id());
      audit.log(actor,"DRAFT_TRASH","EDITORIAL_ITEM",target.id().toString(),"初审草稿移入回收站；公开版本保持不变");
    }
  }
  @Transactional
  public void restoreDraft(Long actor, UUID id) {
    manager(actor);
    var rows=db.queryForList("SELECT * FROM editorial_items WHERE id=? FOR UPDATE",id);
    if(rows.isEmpty()) throw BusinessException.notFound("WORK_ITEM","草稿不存在");
    var row=rows.getFirst();
    if(!"TRASH".equals(row.get("status")) || !"DRAFT".equals(row.get("trash_scope")) || row.get("purged_at")!=null) throw BusinessException.conflict("TRASH_STATE","此草稿不在回收站中");
    if(db.queryForObject("SELECT count(*) FROM problems WHERE problem_number=? AND deleted",Long.class,row.get("problem_number"))>0)
      throw BusinessException.conflict("TRASH_STATE","请先恢复对应的已发布题目，再恢复修订草稿");
    db.update("UPDATE editorial_items SET status=coalesce(trash_previous_status,'DRAFT'),trash_previous_status=NULL,trash_scope=NULL,trashed_at=NULL,version=version+1,updated_at=now(),updated_by=? WHERE id=?",actor,id);
    audit.log(actor,"DRAFT_RESTORE","EDITORIAL_ITEM",id.toString(),"恢复到初审队列，不直接发布");
  }
  public record PurgeTarget(String kind, String id, String generation) {}
  public record PurgeRequest(List<PurgeTarget> items, String account, String password, String confirmation) {
    @Override public String toString() { return "PurgeRequest[credentials redacted]"; }
  }
  @Transactional
  public void purgeBatch(Long actor, PurgeRequest request) {
    manager(actor);
    var items=request.items();
    if(items==null || items.isEmpty() || items.size()>100 || items.stream().anyMatch(t -> t==null || t.id()==null || t.generation()==null || t.kind()==null || !List.of("draft","published").contains(t.kind()))
        || items.stream().map(t -> t.kind()+":"+t.id()).distinct().count()!=items.size())
      throw BusinessException.badRequest("SELECTION","请选择1至100道不重复的回收站题目");
    if(!"彻底删除".equals(request.confirmation())) throw BusinessException.badRequest("CONFIRMATION","请确认彻底删除且不可恢复");
    long approver=authorization.authenticate(actor,request.account(),request.password());
    var ordered=items.stream().sorted(Comparator.comparing(PurgeTarget::kind).thenComparing(PurgeTarget::id)).toList();
    var locked=new HashMap<PurgeTarget,Map<String,Object>>();
    // Validate every selected generation before changing any row. A restored/redeleted item needs fresh approval.
    for(var target:ordered) {
      Map<String,Object> row;
      if("draft".equals(target.kind())) {
        UUID id;
        try { id=UUID.fromString(target.id()); } catch(IllegalArgumentException e) { throw BusinessException.badRequest("SELECTION","草稿编号无效"); }
        var found=db.queryForList("SELECT *,version::text AS generation FROM editorial_items WHERE id=? FOR UPDATE",id);
        if(found.isEmpty()) throw BusinessException.conflict("TRASH_STATE","所选题目已变化，请刷新回收站");
        row=found.getFirst();
        if(!"TRASH".equals(row.get("status")) || !"DRAFT".equals(row.get("trash_scope"))) throw BusinessException.conflict("TRASH_STATE","所选草稿已不在回收站");
      } else {
        row=lock(target.id());
        if(!Boolean.TRUE.equals(row.get("deleted"))) throw BusinessException.conflict("TRASH_STATE","所选题目已不在回收站");
      }
      if(row.get("purged_at")!=null || !target.generation().equals(row.get("generation"))) throw BusinessException.conflict("TRASH_STATE","所选题目已变化，请刷新回收站后重新认证");
      locked.put(target,row);
    }
    var urls=new HashSet<String>();
    for(var target:ordered) {
      var row=locked.get(target);
      if("draft".equals(target.kind())) {
        urls.addAll(db.queryForList("SELECT url FROM editorial_assets WHERE item_id=?",String.class,row.get("id")));
        db.update("DELETE FROM editorial_assets WHERE item_id=?",row.get("id"));
        db.update("DELETE FROM editorial_history WHERE item_id=?",row.get("id"));
        db.update("UPDATE editorial_items SET payload='{}'::jsonb,raw_markdown=NULL,purged_at=now(),trash_previous_status=NULL,version=version+1 WHERE id=?",row.get("id"));
        audit.log(actor,"DRAFT_PURGE","EDITORIAL_ITEM",target.id(),"认证管理员="+approver+"；清除草稿内容，公开版本保持不变");
      } else {
        urls.addAll(purgePublished(target.id(),row));
        audit.log(actor,"PROBLEM_PURGE","PROBLEM",target.id(),"认证管理员="+approver+"；清除题目内容，保留题号占位及审计记录");
      }
    }
    var unused=urls.stream().filter(url -> db.queryForObject("SELECT (SELECT count(*) FROM problem_assets WHERE url=?)+(SELECT count(*) FROM editorial_assets WHERE url=?)",Long.class,url,url)==0).toList();
    org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization(){
      @Override public void afterCommit() { for(String url:unused) { try { storage.deleteUrl(url); } catch(RuntimeException ignored) { /* retained orphan can be cleaned later */ } } }
    });
  }
  private List<String> purgePublished(String number, Map<String,Object> p) {
    var urls=db.queryForList("SELECT url FROM problem_assets WHERE problem_id=? UNION SELECT a.url FROM editorial_assets a JOIN editorial_items i ON i.id=a.item_id WHERE i.problem_number=?",String.class,p.get("id"),number);
    db.update("DELETE FROM problem_assets WHERE problem_id=?",p.get("id"));
    db.update("DELETE FROM editorial_assets WHERE item_id IN (SELECT id FROM editorial_items WHERE problem_number=?)",number);
    db.update("DELETE FROM editorial_history WHERE item_id IN (SELECT id FROM editorial_items WHERE problem_number=?)",number);
    db.update("UPDATE editorial_items SET payload='{}'::jsonb,raw_markdown=NULL,trash_scope='PROBLEM',trash_previous_status=NULL,purged_at=now(),version=version+1 WHERE problem_number=?",number);
    db.update("UPDATE problems SET content='',answer='',solution='',title='题目已删除',purged_at=now() WHERE id=?",p.get("id"));
    return urls;
  }
}
