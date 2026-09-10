package cn.mathsea.backend.feedback;

import cn.mathsea.backend.admin.editorial.EditorialService;
import cn.mathsea.backend.admin.service.AuditLogService;
import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.common.storage.LocalFileStorageService;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class FeedbackService {
  private final JdbcTemplate db;
  private final EditorialService editorial;
  private final AuditLogService audit;
  private final LocalFileStorageService storage;
  public record Target(long id,int version) {}
  public record Resolution(List<Target> items,String status,String response) {}
  public record Publication(UUID item,long version,List<Target> feedback) {}
  @Transactional
  public Object publish(Long actor,Publication request) {
    reviewer(actor);
    var document=editorial.detail(request.item());
    String number=Objects.toString(document.get("problem_number"),"");
    if(request.feedback()==null || request.feedback().isEmpty()) throw BusinessException.badRequest("FEEDBACK_SELECTION","请选择反馈");
    for(var target:request.feedback()) {
      if(target==null || db.queryForObject("SELECT count(*) FROM problem_feedback f JOIN problems p ON p.id=f.problem_id WHERE f.id=? AND p.problem_number=?",Long.class,target.id(),number)==0)
        throw BusinessException.badRequest("FEEDBACK_PROBLEM","反馈与题目不一致");
    }
    resolve(actor,new Resolution(request.feedback(),"RESOLVED","已核对并更新题目内容"));
    long version=request.version();
    if("CHANGES".equals(document.get("status"))) {
      var submitted=editorial.action(actor,request.item(),new EditorialService.Action(version,"SUBMIT","用户反馈修正",null));
      version=((Number)submitted.get("version")).longValue();
    }
    return editorial.action(actor,request.item(),new EditorialService.Action(version,"PUBLISH","处理用户反馈",null));
  }
  private void reviewer(Long actor) {
    if (db.queryForObject("SELECT count(*) FROM users WHERE id=? AND role='ADMIN'",Long.class,actor)==0 || editorial.permission(actor).equals("EDITOR"))
      throw BusinessException.forbidden("REVIEW_REQUIRED","需要审核权限");
  }
  @Transactional
  public Object submit(Long actor,String number,String kind,String description,String suggestion,MultipartFile image) {
    if (!List.of("题干／公式","答案","解析","图片","分类","其他").contains(kind) || description==null || description.trim().length()<3 || description.length()>3000 || Objects.toString(suggestion,"").length()>3000)
      throw BusinessException.badRequest("FEEDBACK_INPUT","请选择问题类型，描述需为3至3000字");
    // Serialize per-user submissions so concurrent requests cannot bypass the daily limit.
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE",actor);
    if (db.queryForObject("SELECT count(*) FROM problem_feedback WHERE user_id=? AND created_at>now()-interval '1 day'",Long.class,actor)>=20)
      throw BusinessException.badRequest("FEEDBACK_LIMIT","今日反馈较多，请明天再提交");
    var p=db.queryForList("SELECT id FROM problems WHERE problem_number=? AND deleted=false",number);
    if (p.isEmpty()) throw BusinessException.notFound("PROBLEM_NOT_FOUND","题目不存在或已下架");
    Object id=p.getFirst().get("id");
    var duplicate=db.queryForList("SELECT id FROM problem_feedback WHERE user_id=? AND problem_id=? AND kind=? AND description=? AND status IN ('OPEN','CHANGES')",actor,id,kind,description.trim());
    if (!duplicate.isEmpty()) return duplicate.getFirst();
    Long feedbackId=db.queryForObject("INSERT INTO problem_feedback(problem_id,user_id,kind,description,suggestion,problem_snapshot) SELECT id,?,?,?,?,jsonb_build_object('number',problem_number,'title',title,'content',content,'answer',answer,'solution',solution,'updated_at',updated_at) FROM problems WHERE id=? RETURNING id",Long.class,actor,kind,description.trim(),Objects.toString(suggestion,"").trim(),id);
    if (image!=null && !image.isEmpty()) {
      if (image.getSize()>5*1024*1024) throw BusinessException.badRequest("IMAGE_SIZE","截图不能超过5MB");
      String url=storage.saveProblemImage(image,"feedback-"+feedbackId).url();
      org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization(){
        @Override public void afterCompletion(int status) { if(status!=STATUS_COMMITTED) storage.deleteUrl(url); }
      });
      db.update("UPDATE problem_feedback SET image_url=? WHERE id=?",url,feedbackId);
    }
    return Map.of("id",feedbackId);
  }
  public Object mine(Long actor,int page) {
    int offset=(Math.max(1,Math.min(page,100000))-1)*30;
    return Map.of("items",db.queryForList("SELECT f.id,p.problem_number AS number,p.title,f.kind,f.description,f.suggestion,f.status,f.response,f.created_at FROM problem_feedback f JOIN problems p ON p.id=f.problem_id WHERE f.user_id=? ORDER BY f.created_at DESC,f.id DESC LIMIT 30 OFFSET ?",actor,offset),"total",db.queryForObject("SELECT count(*) FROM problem_feedback WHERE user_id=?",Long.class,actor));
  }
  public Object queue(Long actor,String state,int page) {
    reviewer(actor);
    String filter=switch(Objects.toString(state,"OPEN")){case "CHANGES"->"f.status='CHANGES'";case "DONE"->"f.status IN ('RESOLVED','DISMISSED')";default->"f.status='OPEN'";};
    var rows=db.queryForList("SELECT p.problem_number AS number,p.title,p.deleted,count(*) AS count,min(f.created_at) AS first_at FROM problem_feedback f JOIN problems p ON p.id=f.problem_id WHERE "+filter+" GROUP BY p.id ORDER BY min(f.created_at),p.id LIMIT 30 OFFSET ?",(Math.max(1,Math.min(page,100000))-1)*30);
    return Map.of("items",rows,"total",db.queryForObject("SELECT count(DISTINCT f.problem_id) FROM problem_feedback f WHERE "+filter,Long.class));
  }
  public Object detail(Long actor,String number) {
    reviewer(actor);
    return db.queryForList("SELECT f.id,f.kind,f.description,f.suggestion,f.image_url,f.status,f.response,f.version,f.created_at,f.problem_snapshot FROM problem_feedback f JOIN problems p ON p.id=f.problem_id WHERE p.problem_number=? ORDER BY f.created_at,f.id",number).stream().map(row->{
      // JDBC JSON is not exposed as a driver object.
      row.put("problem_snapshot",Objects.toString(row.get("problem_snapshot"),"{}")); return row;
    }).toList();
  }
  @Transactional
  public void resolve(Long actor,Resolution request) {
    reviewer(actor);
    if (request.items()==null || request.items().isEmpty() || request.items().size()>100 || request.items().stream().anyMatch(Objects::isNull) || !List.of("CHANGES","RESOLVED","DISMISSED").contains(Objects.toString(request.status(),"")) || Objects.toString(request.response(),"").isBlank() || request.response().length()>1500)
      throw BusinessException.badRequest("FEEDBACK_RESOLUTION","请选择反馈并填写处理说明");
    for(var item:request.items().stream().sorted(Comparator.comparingLong(Target::id)).toList()) {
      int changed=db.update("UPDATE problem_feedback SET status=?,response=?,handled_by=?,version=version+1,updated_at=now() WHERE id=? AND version=? AND status IN ('OPEN','CHANGES')",request.status(),request.response(),actor,item.id(),item.version());
      if(changed!=1) throw BusinessException.conflict("FEEDBACK_CHANGED","反馈已由其他管理员处理，请刷新后查看");
      audit.log(actor,"FEEDBACK_"+request.status(),"FEEDBACK",Long.toString(item.id()),request.response());
    }
  }
}
