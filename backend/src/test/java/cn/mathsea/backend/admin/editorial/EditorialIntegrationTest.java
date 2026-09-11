package cn.mathsea.backend.admin.editorial;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.security.CustomUserPrincipal;
import cn.mathsea.backend.user.mapper.UserMapper;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
      "logging.level.root=WARN",
      "logging.level.org.springframework=WARN",
      "debug=false",
      "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.session.SessionAutoConfiguration"
    })
@AutoConfigureMockMvc
class EditorialIntegrationTest {
  static EmbeddedPostgres postgres;

  static {
    try {
      postgres = EmbeddedPostgres.builder().setPort(0).start();
    } catch (Exception e) {
      throw new ExceptionInInitializerError(e);
    }
  }

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
    r.add("spring.datasource.username", () -> "postgres");
    r.add("spring.datasource.password", () -> "");
    r.add("mathsea.storage.root", () -> "target/editorial-test-uploads");
  }

  @Autowired EditorialService service;
  @Autowired JdbcTemplate db;
  @Autowired cn.mathsea.backend.feedback.FeedbackService feedback;
  @Autowired MockMvc mvc;
  @Autowired UserMapper users;
  @Autowired cn.mathsea.backend.curriculum.CurriculumService curriculum;
  @Autowired cn.mathsea.backend.problem.service.ProblemService publicProblems;
  @Autowired cn.mathsea.backend.problem.mapper.ProblemMapper problemMapper;
  @Autowired cn.mathsea.backend.admin.service.ProblemTrashService trash;
  @Autowired org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
  @org.springframework.test.context.bean.override.mockito.MockitoBean cn.mathsea.backend.common.rate.RateLimitService purgeRateLimit;

  cn.mathsea.backend.admin.service.ProblemTrashService.PurgeTarget purgeTarget(String kind,String id) {
    String generation=db.queryForObject(kind.equals("draft") ? "SELECT version::text FROM editorial_items WHERE id=?::uuid" : "SELECT deleted_at::text FROM problems WHERE problem_number=?",String.class,id);
    return new cn.mathsea.backend.admin.service.ProblemTrashService.PurgeTarget(kind,id,generation);
  }
  cn.mathsea.backend.admin.service.ProblemTrashService.PurgeRequest purgeRequest(List<cn.mathsea.backend.admin.service.ProblemTrashService.PurgeTarget> items,String account,String password) {
    return new cn.mathsea.backend.admin.service.ProblemTrashService.PurgeRequest(items,account,password,"彻底删除");
  }
  String approver() {
    String account="approve"+UUID.randomUUID().toString().substring(0,8);
    long id=actor(account,"REVIEWER");
    db.update("UPDATE users SET password_hash=? WHERE id=?",passwordEncoder.encode("test-approval-password"),id);
    return account;
  }

  long actor(String name, String permission) {
    Long id =
        db.queryForObject(
            "INSERT INTO users(public_id,uid,username,email,password_hash,role) VALUES"
                + " (?,?,?,?,?,'ADMIN') RETURNING id",
            Long.class,
            UUID.randomUUID(),
            "UID" + UUID.randomUUID().toString().substring(0, 12),
            name,
            name + "@example.test",
            "unused");
    db.update("INSERT INTO editorial_permissions VALUES (?,?)", id, permission);
    return id;
  }

  MockMultipartFile markdown(String content) {
    return new MockMultipartFile(
        "file",
        "2024全国甲卷T1.md",
        "text/markdown",
        ("---\n"
                + "id:2024全国甲卷T1\n"
                + "year:2024\n"
                + "source:全国甲卷\n"
                + "number：T1\n"
                + "question_type:单选题\n"
                + "difficulty:D1\n"
                + "tags:集合\n"
                + "---\n"
                + "content:\n"
                + content
                + "\nimg：0")
            .getBytes(StandardCharsets.UTF_8));
  }

  long version(Map<String, Object> item) {
    return ((Number) item.get("version")).longValue();
  }

  @Test
  void purgeRequiresDifferentActiveAdminAndIsAtomic() throws Exception {
    String account=approver();
    long approverId=users.findByAccount(account).getId();
    long manager=actor("purge"+UUID.randomUUID().toString().substring(0,8),"MANAGER");
    String own=users.selectById(manager).getUsername();
    db.update("UPDATE users SET password_hash=? WHERE id=?",passwordEncoder.encode("own-password"),manager);
    var a=service.manual(manager); var b=service.manual(manager);
    UUID aid=(UUID)a.get("id"),bid=(UUID)b.get("id");
    trash.deleteDrafts(manager,List.of(new cn.mathsea.backend.admin.service.ProblemTrashService.DraftTarget(aid,version(a)),new cn.mathsea.backend.admin.service.ProblemTrashService.DraftTarget(bid,version(b))));
    var targets=List.of(purgeTarget("draft",aid.toString()),purgeTarget("draft",bid.toString()));
    assertThrows(BusinessException.class,()->trash.purgeBatch(manager,purgeRequest(targets,own,"own-password")));
    assertThrows(BusinessException.class,()->trash.purgeBatch(manager,purgeRequest(targets,account,"wrong")));
    db.update("UPDATE users SET role='USER' WHERE id=?",approverId);
    assertThrows(BusinessException.class,()->trash.purgeBatch(manager,purgeRequest(targets,account,"test-approval-password")));
    db.update("UPDATE users SET role='ADMIN',status='BANNED' WHERE id=?",approverId);
    assertThrows(BusinessException.class,()->trash.purgeBatch(manager,purgeRequest(targets,account,"test-approval-password")));
    db.update("UPDATE users SET status='ACTIVE' WHERE id=?",approverId);
    trash.restoreDraft(manager,bid);
    assertThrows(BusinessException.class,()->trash.purgeBatch(manager,purgeRequest(targets,account,"test-approval-password")));
    assertNull(db.queryForObject("SELECT purged_at FROM editorial_items WHERE id=?",Object.class,aid));
    trash.deleteDrafts(manager,List.of(new cn.mathsea.backend.admin.service.ProblemTrashService.DraftTarget(bid,version(service.detail(bid)))));
    assertThrows(BusinessException.class,()->trash.purgeBatch(manager,purgeRequest(targets,account,"test-approval-password")));
    var current=List.of(purgeTarget("draft",aid.toString()),purgeTarget("draft",bid.toString()));
    var principal=new CustomUserPrincipal(users.selectById(manager));
    mvc.perform(delete("/api/v1/admin/problem-trash/GC000001").with(user(principal)).with(csrf()).contentType("application/json").content("{\"number\":\"GC000001\"}")).andExpect(status().isForbidden());
    var requestBody=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(purgeRequest(current,account,"test-approval-password"));
    mvc.perform(post("/api/v1/admin/problem-trash/purge").with(user(principal)).contentType("application/json").content(requestBody)).andExpect(status().isForbidden());
    mvc.perform(post("/api/v1/admin/problem-trash/purge").with(user(principal)).with(csrf()).contentType("application/json").content(requestBody)).andExpect(status().isOk()).andExpect(org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated().withUsername(own));
    assertEquals(2,db.queryForObject("SELECT count(*) FROM editorial_items WHERE id IN (?,?) AND purged_at IS NOT NULL AND payload='{}'::jsonb",Integer.class,aid,bid));
    assertEquals(2,db.queryForObject("SELECT count(*) FROM audit_logs WHERE actor_user_id=? AND action='DRAFT_PURGE' AND details LIKE ?",Integer.class,manager,"%认证管理员="+approverId+"；%"));
    assertThrows(BusinessException.class,()->trash.restoreDraft(manager,aid));
    assertThrows(BusinessException.class,()->trash.purgeBatch(manager,purgeRequest(current,account,"test-approval-password")));
    org.mockito.Mockito.verify(purgeRateLimit,org.mockito.Mockito.atLeastOnce()).check(org.mockito.ArgumentMatchers.eq("purge-approval"),org.mockito.ArgumentMatchers.eq(Long.toString(manager)),org.mockito.ArgumentMatchers.eq(10),org.mockito.ArgumentMatchers.eq(java.time.Duration.ofMinutes(10)));
  }

  @Test
  void purgedRevisionCanStartFreshFromPublicVersion() {
    long manager=actor("renew"+UUID.randomUUID().toString().substring(0,8),"MANAGER");
    UUID paper=(UUID)service.paper(manager,"重新修订"+UUID.randomUUID()).get("id");
    UUID batch=(UUID)service.batch(manager,"renew").get("id");
    UUID id=(UUID)service.importFile(manager,batch,paper,"T1.md",markdown("公开内容"),List.of()).get("itemId");
    var published=service.action(manager,id,new EditorialService.Action(1,"PUBLISH","",null));
    String number=published.get("problem_number").toString();
    // Model an initial-review revision of an already published question.
    long pid=problemMapper.findByProblemNumber(number).getId();
    db.update("INSERT INTO problem_assets(problem_id,url,mime_type,alt_text,sort_order) VALUES (?,'/uploads/shared-purge-test.png','image/png','test',0)",pid);
    db.update("INSERT INTO editorial_assets(id,item_id,filename,checksum,url,mime_type) VALUES (?,?,'shared.png','shared','/uploads/shared-purge-test.png','image/png')",UUID.randomUUID(),id);
    db.update("UPDATE editorial_items SET status='DRAFT' WHERE id=?",id);
    trash.deleteDrafts(manager,List.of(new cn.mathsea.backend.admin.service.ProblemTrashService.DraftTarget(id,version(service.detail(id)))));
    trash.purgeBatch(manager,purgeRequest(List.of(purgeTarget("draft",id.toString())),approver(),"test-approval-password"));
    assertEquals("公开内容",publicProblems.detail(number,null).content());
    assertEquals(1,db.queryForObject("SELECT count(*) FROM problem_assets WHERE problem_id=?",Integer.class,pid));
    assertEquals(0,db.queryForObject("SELECT count(*) FROM editorial_assets WHERE item_id=?",Integer.class,id));
    var fresh=service.fromPublished(manager,number);
    assertEquals(id,fresh.get("id"));
    assertEquals("PUBLISHED",fresh.get("status"));
    assertNull(db.queryForObject("SELECT purged_at FROM editorial_items WHERE id=?",Object.class,id));
  }

  @Test
  void draftBatchTrashIsAtomicPermissionCheckedAndRestorable() {
    long manager=actor("delete-manager"+UUID.randomUUID().toString().substring(0,8),"MANAGER");
    long other=actor("delete-other"+UUID.randomUUID().toString().substring(0,8),"EDITOR");
    var a=service.manual(manager); var b=service.manual(manager);
    var ids=List.of((UUID)a.get("id"),(UUID)b.get("id")).stream().sorted().toList();
    var targets=ids.stream().map(id -> new cn.mathsea.backend.admin.service.ProblemTrashService.DraftTarget(id,version(service.detail(id)))).toList();
    assertThrows(BusinessException.class,()->trash.deleteDrafts(other,targets));
    assertThrows(BusinessException.class,()->trash.deleteDrafts(manager,List.of(targets.get(0),new cn.mathsea.backend.admin.service.ProblemTrashService.DraftTarget(ids.get(1),999))));
    assertEquals("DRAFT",service.detail(ids.getFirst()).get("status"));
    assertThrows(BusinessException.class,()->trash.deleteDrafts(manager,List.of(targets.get(0),targets.get(0))));
    service.releaseLease(manager,ids.get(1)); service.acquire(other,ids.get(1));
    assertThrows(BusinessException.class,()->trash.deleteDrafts(manager,targets));
    assertEquals("DRAFT",service.detail(ids.getFirst()).get("status"));
    service.releaseLease(other,ids.get(1));
    long count=db.queryForObject("SELECT count(*) FROM problems",Long.class);
    trash.deleteDrafts(manager,targets);
    assertEquals(count,db.queryForObject("SELECT count(*) FROM problems",Long.class));
    assertThrows(BusinessException.class,()->service.detail(ids.getFirst()));
    var listed=(Map<?,?>)trash.list(manager,"",1);
    assertTrue(((List<Map<String,Object>>)listed.get("items")).stream().anyMatch(r->"draft".equals(r.get("kind")) && ids.getFirst().toString().equals(r.get("id"))));
    trash.restoreDraft(manager,ids.getFirst());
    assertEquals("DRAFT",service.detail(ids.getFirst()).get("status"));
    assertTrue(version(service.detail(ids.getFirst()))>targets.getFirst().version());
  }

  @Test
  void discardingRevisionDoesNotDeletePublicQuestionOrRestoreItAccidentally() {
    long manager=actor("revision-delete"+UUID.randomUUID().toString().substring(0,8),"MANAGER");
    UUID paper=(UUID)service.paper(manager,"删除测试卷"+UUID.randomUUID()).get("id");
    UUID batch=(UUID)service.batch(manager,"delete-test").get("id");
    UUID id=(UUID)service.importFile(manager,batch,paper,"T1.md",markdown("公开题干"),List.of()).get("itemId");
    var published=service.action(manager,id,new EditorialService.Action(version(service.detail(id)),"PUBLISH","",null));
    String number=(String)published.get("problem_number");
    var draft=service.save(manager,id,new EditorialService.Save(version(published),(EditorialDocument)published.get("document"),"修订"));
    trash.deleteDrafts(manager,List.of(new cn.mathsea.backend.admin.service.ProblemTrashService.DraftTarget(id,version(draft))));
    assertFalse(db.queryForObject("SELECT deleted FROM problems WHERE problem_number=?",Boolean.class,number));
    assertThrows(BusinessException.class,()->trash.delete(manager,List.of(number,"GS999999")));
    assertFalse(db.queryForObject("SELECT deleted FROM problems WHERE problem_number=?",Boolean.class,number));
    trash.delete(manager,List.of(number));
    assertThrows(BusinessException.class,()->trash.restoreDraft(manager,id));
    trash.restore(manager,number);
    assertEquals("TRASH",db.queryForObject("SELECT status FROM editorial_items WHERE id=?",String.class,id));
    trash.restoreDraft(manager,id);
    assertEquals("DRAFT",service.detail(id).get("status"));
  }

  @Test
  void draftsArePrivateDuplicateSafeAndPublishingRetainsThePreviousVersion() {
    long editor = actor("editor" + UUID.randomUUID().toString().substring(0, 8), "EDITOR"),
        reviewer = actor("reviewer" + UUID.randomUUID().toString().substring(0, 8), "REVIEWER");
    UUID paper = (UUID) service.paper(editor, "2024全国甲卷理科 " + UUID.randomUUID()).get("id");
    UUID batch = (UUID) service.batch(editor, "test").get("id");
    Long before = db.queryForObject("SELECT count(*) FROM problems", Long.class);
    var imported =
        service.importFile(editor, batch, paper, "卷/T1.md", markdown("原始内容 $x=1$"), List.of());
    UUID id = (UUID) imported.get("itemId");
    assertEquals(before, db.queryForObject("SELECT count(*) FROM problems", Long.class));
    assertEquals(
        "SKIPPED",
        service
            .importFile(editor, batch, paper, "卷/T1.md", markdown("原始内容 $x=1$"), List.of())
            .get("result"));
    assertEquals(
        "CONFLICT",
        service
            .importFile(editor, batch, paper, "卷/T1.md", markdown("改变"), List.of())
            .get("result"));
    var item = service.detail(id);
    var review =
        service.action(
            editor, id, new EditorialService.Action(version(item), "SUBMIT", "初校完成", null));
    assertThrows(
        BusinessException.class,
        () ->
            service.action(
                editor, id, new EditorialService.Action(version(review), "PUBLISH", "", null)));
    var published =
        service.action(
            reviewer, id, new EditorialService.Action(version(review), "PUBLISH", "复核完成", null));
    String number = published.get("problem_number").toString();
    assertTrue(number.matches("GC[0-9]{6}"));
    var doc = (EditorialDocument) published.get("document");
    var edited =
        new EditorialDocument(
            doc.title(),
            doc.year(),
            doc.source(),
            doc.type(),
            doc.level(),
            doc.tags(),
            "修正内容",
            doc.answer(),
            doc.solution(),
            doc.assets(),
            doc.imageReferences(),
            doc.originalMetadata(),
            doc.warnings());
    var saved =
        service.save(editor, id, new EditorialService.Save(version(published), edited, "修正"));
    assertEquals(
        "原始内容 $x=1$",
        db.queryForObject(
            "SELECT content FROM problems WHERE problem_number=?", String.class, number));
    assertThrows(
        BusinessException.class,
        () ->
            service.save(
                reviewer, id, new EditorialService.Save(version(published), doc, "旧版本保存")));
    var claim =
        service.action(editor, id, new EditorialService.Action(version(saved), "CLAIM", "", null));
    assertThrows(
        BusinessException.class,
        () -> service.save(reviewer, id, new EditorialService.Save(version(claim), doc, "冲突")));
    var submitted =
        service.action(editor, id, new EditorialService.Action(version(claim), "SUBMIT", "", null));
    service.action(
        reviewer, id, new EditorialService.Action(version(submitted), "PUBLISH", "再次复核", null));
    assertEquals(
        "修正内容",
        db.queryForObject(
            "SELECT content FROM problems WHERE problem_number=?", String.class, number));
    assertEquals(before + 1, db.queryForObject("SELECT count(*) FROM problems", Long.class));
    UUID anotherPaper = (UUID) service.paper(editor, "同名题的另一张卷 " + UUID.randomUUID()).get("id");
    assertEquals(
        "IMPORTED",
        service
            .importFile(editor, batch, anotherPaper, "另一卷/T1.md", markdown("不同题目"), List.of())
            .get("result"));
    assertFalse(((List<?>) service.queue("", null, "", 1).get("items")).isEmpty());
    var current = service.detail(id);
    var corrected =
        new EditorialDocument(
            doc.title(),
            doc.year(),
            doc.source(),
            "multiple-choice",
            doc.level(),
            doc.tags(),
            doc.content(),
            doc.answer(),
            doc.solution(),
            doc.assets(),
            doc.imageReferences(),
            Map.of("source_category", "E"),
            doc.warnings());
    var correction =
        service.save(editor, id, new EditorialService.Save(version(current), corrected, "更正分类"));
    var correctionReview =
        service.action(
            editor, id, new EditorialService.Action(version(correction), "SUBMIT", "", null));
    var republished =
        service.action(
            reviewer,
            id,
            new EditorialService.Action(version(correctionReview), "PUBLISH", "", null));
    String correctedNumber = "EM" + number.substring(2);
    assertEquals(correctedNumber, republished.get("problem_number"));
    assertEquals(correctedNumber, problemMapper.findByProblemNumber(number).getProblemNumber());
    assertEquals(
        problemMapper.findIdByProblemNumber(correctedNumber),
        problemMapper.findIdByProblemNumber(number));
    assertEquals(id, service.fromPublished(editor, number).get("id"));
  }

  @Test
  void imagesRestoreAndBulkConflictsAreAtomic() {
    long manager = actor("manager" + UUID.randomUUID().toString().substring(0, 8), "MANAGER");
    var first = service.manual(manager);
    UUID id = (UUID) first.get("id");
    byte[] png =
        Base64.getDecoder()
            .decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0l8AAAAASUVORK5CYII=");
    var withImage =
        service.upload(
            manager,
            id,
            version(first),
            new MockMultipartFile("file", "截图.png", "image/png", png),
            "solution");
    var imageDoc = (EditorialDocument) withImage.get("document");
    assertEquals(1, imageDoc.assets().size());
    var filled =
        new EditorialDocument(
            "配图题",
            2024,
            "全国甲卷",
            "single-choice",
            "purple",
            List.of("集合"),
            "题干",
            "A",
            "解析",
            imageDoc.assets(),
            List.of(),
            Map.of(),
            List.of());
    var saved =
        service.save(manager, id, new EditorialService.Save(version(withImage), filled, "补齐内容"));
    var review =
        service.action(
            manager, id, new EditorialService.Action(version(saved), "SUBMIT", "", null));
    var published =
        service.action(
            manager, id, new EditorialService.Action(version(review), "PUBLISH", "", null));
    String publicSolution =
        db.queryForObject(
            "SELECT solution FROM problems WHERE problem_number=?",
            String.class,
            published.get("problem_number"));
    assertTrue(publicSolution.contains(imageDoc.assets().getFirst().url()));
    var second = service.manual(manager);
    UUID secondId = (UUID) second.get("id");
    var forged =
        new EditorialDocument(
            "盗用图片",
            2024,
            "",
            "single-choice",
            "red",
            List.of(),
            "题干",
            "",
            "",
            imageDoc.assets(),
            List.of(),
            Map.of(),
            List.of());
    assertThrows(
        BusinessException.class,
        () ->
            service.save(
                manager, secondId, new EditorialService.Save(version(second), forged, "")));
    var oldVersion = version(published);
    assertThrows(
        BusinessException.class,
        () ->
            service.bulk(
                manager,
                new EditorialService.Bulk(
                    List.of(
                        new EditorialService.Target(id, oldVersion),
                        new EditorialService.Target(secondId, 999)),
                    "source",
                    "新来源",
                    "")));
    assertEquals(oldVersion, version(service.detail(id)));
    var history = (List<Map<String, Object>>) published.get("history");
    long oldest = ((Number) history.getLast().get("id")).longValue();
    var restored =
        service.action(
            manager, id, new EditorialService.Action(oldVersion, "RESTORE", "回到初始草稿", oldest));
    assertTrue(((EditorialDocument) restored.get("document")).assets().isEmpty());
    assertEquals(
        publicSolution,
        db.queryForObject(
            "SELECT solution FROM problems WHERE problem_number=?",
            String.class,
            published.get("problem_number")));
    assertEquals(
        1L,
        db.queryForObject("SELECT count(*) FROM editorial_assets WHERE item_id=?", Long.class, id));
  }

  @Test
  void httpRoutesEnforceAuthenticationCsrfAndReviewerPermissions() throws Exception {
    mvc.perform(get("/api/v1/curriculum"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.chapters.length()").value(18));
    mvc.perform(get("/api/v1/admin/editorial/items")).andExpect(status().isUnauthorized());
    long editor = actor("http" + UUID.randomUUID().toString().substring(0, 8), "EDITOR");
    var principal = new CustomUserPrincipal(users.selectById(editor));
    mvc.perform(
            put("/api/v1/admin/curriculum/presets/semester-1")
                .with(user(principal))
                .with(csrf())
                .contentType("application/json")
                .content("{\"version\":1,\"chapters\":[\"A11\"]}"))
        .andExpect(status().isForbidden());
    mvc.perform(post("/api/v1/admin/editorial/items").with(user(principal)))
        .andExpect(status().isForbidden());
    mvc.perform(post("/api/v1/admin/editorial/items").with(user(principal)).with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DRAFT"));
    mvc.perform(get("/api/v1/admin/editorial/me").with(user(principal)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.permission").value("EDITOR"));
    mvc.perform(get("/api/v1/admin/editorial/members").with(user(principal)))
        .andExpect(status().isForbidden());
    mvc.perform(delete("/api/v1/admin/problems/P10001").with(user(principal)).with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error.code").value("USE_WORKBENCH"));
  }

  @Test
  void curriculumRequiresAllPrerequisitesAndOnlyPublishedConfirmationCounts() throws Exception {
    long actor = actor("chap" + UUID.randomUUID().toString().substring(0, 8), "MANAGER");
    UUID paper = (UUID) service.paper(actor, "章节测试" + UUID.randomUUID()).get("id");
    UUID batch = (UUID) service.batch(actor, "章节测试").get("id");
    var raw =
        new String(markdown("集合与导数").getBytes(), StandardCharsets.UTF_8)
            .replace(
                "tags:集合",
                "tags:集合\ncurriculum:PEP-A-2019\nchapters:A11,A42\nchapters_confirmed:true");
    var file =
        new MockMultipartFile(
            "file", "chapters.md", "text/markdown", raw.getBytes(StandardCharsets.UTF_8));
    UUID id =
        (UUID)
            service.importFile(actor, batch, paper, "chapters.md", file, List.of()).get("itemId");
    var imported = service.detail(id);
    var doc = (EditorialDocument) imported.get("document");
    assertEquals(List.of("A11", "A42"), doc.curriculum().chapters());
    assertEquals(1L,service.queue("",paper,"",1,"pending").get("total"));
    assertEquals(0L,service.queue("",paper,"",1,"missing").get("total"));
    assertEquals(0L,service.queue("",paper,"",1,"confirmed").get("total"));
    assertFalse(doc.curriculum().confirmed(), "MD cannot grant confirmation");
    var initial = publishItem(actor, id, imported);
    String number = initial.get("problem_number").toString();
    assertEquals(1, queryCurriculum(number, false, List.of(), List.of()));
    assertEquals(1, queryCurriculum(number, true, List.of("A11", "A42"), List.of()));
    var confirmed = withCurriculum(doc, List.of("A11", "A42"), true);
    var saved =
        service.save(actor, id, new EditorialService.Save(version(initial), confirmed, "确认章节"));
    assertEquals(1, queryCurriculum(number, true, List.of("A11", "A42"), List.of()));
    var published = publishItem(actor, id, saved);
    assertEquals(0, queryCurriculum(number, true, List.of("A11"), List.of()));
    assertEquals(0, queryCurriculum(number, true, List.of("A42"), List.of()));
    assertEquals(0, queryCurriculum(number, true, List.of(), List.of()));
    assertEquals(1, queryCurriculum(number, true, List.of("A11", "A42", "A22"), List.of()));
    assertEquals(1, queryCurriculum(number, false, List.of(), List.of("A42")));
    assertEquals(0, queryCurriculum(number, true, List.of("A11"), List.of("A42")));
    assertEquals(0, queryCurriculum(number, false, List.of(), List.of("A22")));
    assertTrue(publicProblems.detail(number, null).curriculum().confirmed());
    assertThrows(
        BusinessException.class, () -> queryCurriculum(number, true, List.of("A99"), List.of()));
    service.bulk(
        actor,
        new EditorialService.Bulk(
            List.of(new EditorialService.Target(id, version(published))), "chapters", "A22", "补标"));
    var bulk = service.detail(id);
    assertFalse(((EditorialDocument) bulk.get("document")).curriculum().confirmed());
    assertEquals(
        1,
        queryCurriculum(number, true, List.of("A11", "A42"), List.of()),
        "draft must not alter public prerequisites");
    assertThrows(
        BusinessException.class,
        () ->
            service.save(
                actor,
                id,
                new EditorialService.Save(
                    version(bulk), withCurriculum(doc, List.of(), true), "")));
    var unconfirmed = publishItem(actor, id, bulk);
    assertEquals(1, queryCurriculum(number, true, List.of("A11", "A42", "A22"), List.of()));
    assertEquals(1, queryCurriculum(number, false, List.of(), List.of()));
    assertEquals(List.of("A22"), publicProblems.detail(number, null).curriculum().chapters());
    var history = (List<Map<String, Object>>) unconfirmed.get("history");
    var old =
        history.stream().filter(h -> "IMPORT".equals(h.get("action"))).findFirst().orElseThrow();
    service.action(
        actor,
        id,
        new EditorialService.Action(
            version(unconfirmed), "RESTORE", "恢复旧章节", ((Number) old.get("id")).longValue()));
    assertEquals(List.of("A22"), publicProblems.detail(number, null).curriculum().chapters());
    var preset =
        new cn.mathsea.backend.curriculum.CurriculumService.PresetUpdate(1, List.of("A11", "A12"));
    curriculum.updatePreset(actor, "semester-1", preset);
    assertThrows(
        BusinessException.class, () -> curriculum.updatePreset(actor, "semester-1", preset));
  }

  private EditorialDocument withCurriculum(
      EditorialDocument d, List<String> codes, boolean confirmed) {
    return new EditorialDocument(
        d.title(),
        d.year(),
        d.source(),
        d.type(),
        d.level(),
        d.tags(),
        d.content(),
        d.answer(),
        d.solution(),
        d.assets(),
        d.imageReferences(),
        d.originalMetadata(),
        d.warnings(),
        new cn.mathsea.backend.curriculum.CurriculumAnnotation("PEP-A-2019", codes, confirmed));
  }

  private Map<String, Object> publishItem(long actor, UUID id, Map<String, Object> item) {
    var review =
        service.action(actor, id, new EditorialService.Action(version(item), "SUBMIT", "", null));
    return service.action(
        actor, id, new EditorialService.Action(version(review), "PUBLISH", "", null));
  }

  @Test
  void reviewQueuesLeasesAndHierarchicalTags() throws Exception {
    long reviewer = actor("rev" + UUID.randomUUID().toString().substring(0, 8), "REVIEWER");
    long other = actor("other" + UUID.randomUUID().toString().substring(0, 8), "REVIEWER");
    UUID paper = (UUID) service.paper(reviewer, "连续审核 " + UUID.randomUUID()).get("id");
    UUID batch = (UUID) service.batch(reviewer, "review").get("id");
    UUID id = (UUID) service.importFile(reviewer, batch, paper, "T1.md", markdown("双曲线测试"), List.of()).get("itemId");
    assertEquals(1L, ((Number) service.queue("PENDING", paper, "", 1).get("total")).longValue());
    var acquired = service.acquire(reviewer, id);
    assertThrows(BusinessException.class, () -> service.acquire(other, id));
    service.releaseLease(other, id);
    assertThrows(BusinessException.class, () -> service.acquire(other, id));
    var returned = service.action(reviewer, id, new EditorialService.Action(version(acquired), "RETURN", "图片：补图", null));
    assertEquals("CHANGES", returned.get("status"));
    assertEquals(0L, ((Number) service.queue("PENDING", paper, "", 1).get("total")).longValue());
    assertEquals(1L, ((Number) service.queue("CHANGES", paper, "", 1, "", "图片").get("total")).longValue());
    var d = (EditorialDocument) returned.get("document");
    var updated = new EditorialDocument(d.title(), d.year(), d.source(), d.type(), d.level(), List.of("双曲线"), d.content(), d.answer(), d.solution(), d.assets(), d.imageReferences(), d.originalMetadata(), d.warnings(), d.curriculum());
    var saved = service.save(other, id, new EditorialService.Save(version(returned), updated, "已修正"));
    assertEquals("CHANGES", saved.get("status"));
    assertThrows(BusinessException.class, () -> service.action(other, id, new EditorialService.Action(version(saved), "PUBLISH", "", null)));
    var submitted = service.action(other, id, new EditorialService.Action(version(saved), "SUBMIT", "", null));
    var pub = service.action(reviewer, id, new EditorialService.Action(version(submitted), "PUBLISH", "", null));
    String number = pub.get("problem_number").toString();
    for (String tag : List.of("解析几何", "解几", "圆锥曲线", "双曲线")) {
      var result = publicProblems.query(new cn.mathsea.backend.problem.dto.ProblemQuery(number, List.of(), List.of(), List.of(), List.of(), List.of(tag, "不存在标签"), "newest", 1, 20), null);
      assertEquals(1, result.pagination().total(), tag);
    }
    assertEquals(1, publicProblems.query(new cn.mathsea.backend.problem.dto.ProblemQuery(number, List.of(), List.of(), List.of(), List.of(), List.of("抛物线"), "newest", 1, 20), null).pagination().total());
    UUID freshPaper = (UUID) service.paper(reviewer, "直接审核 " + UUID.randomUUID()).get("id");
    UUID fresh = (UUID) service.importFile(reviewer, batch, freshPaper, "new.md", markdown("直接通过"), List.of()).get("itemId");
    assertEquals("PUBLISHED", service.action(reviewer, fresh, new EditorialService.Action(1, "PUBLISH", "", null)).get("status"));
    mvc.perform(get("/api/v1/problems/tag-taxonomy")).andExpect(status().isOk()).andExpect(jsonPath("$[6].name").value("解析几何"));
  }

  @Test
  void recycleBinPreservesLinksAndPreventsStalePublishing() {
    long manager = actor("trash" + UUID.randomUUID().toString().substring(0,8),"MANAGER");
    long editor = actor("noDel" + UUID.randomUUID().toString().substring(0,8),"EDITOR");
    UUID paper=(UUID) service.paper(manager,"回收测试 " + UUID.randomUUID()).get("id");
    UUID batch=(UUID) service.batch(manager,"trash").get("id");
    UUID id=(UUID) service.importFile(manager,batch,paper,"T1.md",markdown("保留原文"),List.of()).get("itemId");
    var published=service.action(manager,id,new EditorialService.Action(1,"PUBLISH","",null));
    String number=published.get("problem_number").toString();
    long pid=problemMapper.findByProblemNumber(number).getId();
    db.update("INSERT INTO problem_assets(problem_id,url,mime_type,alt_text,sort_order) VALUES (?,'/uploads/trash-test.png','image/png','test',0)",pid);
    db.update("INSERT INTO user_problem_states(user_id,problem_id,favorite,completed) VALUES (?,?,true,true)",editor,pid);
    assertThrows(BusinessException.class,()->trash.delete(editor,List.of(number)));
    assertThrows(BusinessException.class,()->trash.delete(manager,List.of(number,"not-a-number")));
    assertFalse(problemMapper.findByProblemNumber(number).getDeleted());
    trash.delete(manager,List.of(number));
    assertTrue(problemMapper.findByProblemNumber(number).getDeleted());
    assertThrows(BusinessException.class,()->publicProblems.detail(number,null));
    assertEquals(0,queryCurriculum(number,false,List.of(),List.of()));
    var summary=publicProblems.summariesByInternalIds(List.of(pid),editor).get(pid);
    assertEquals("题目已删除",summary.title()); assertTrue(summary.assets().isEmpty());
    assertEquals(1,db.queryForObject("SELECT count(*) FROM problem_assets WHERE problem_id=?",Integer.class,pid));
    assertThrows(BusinessException.class,()->service.action(manager,id,new EditorialService.Action(version(published),"PUBLISH","",null)));
    assertThrows(BusinessException.class,()->service.acquire(manager,id));
    trash.restore(manager,number);
    assertEquals("保留原文",publicProblems.detail(number,null).content());
    assertEquals("PUBLISHED",service.detail(id).get("status"));
    assertEquals(1,db.queryForObject("SELECT count(*) FROM user_problem_states WHERE problem_id=? AND favorite",Integer.class,pid));
    trash.delete(manager,List.of(number));
    String account=approver();
    var targets=List.of(purgeTarget("published",number));
    assertThrows(BusinessException.class,()->trash.purgeBatch(manager,purgeRequest(targets,account,"wrong")));
    trash.purgeBatch(manager,purgeRequest(targets,account,"test-approval-password"));
    assertThrows(BusinessException.class,()->trash.restore(manager,number));
    assertEquals("",db.queryForObject("SELECT content FROM problems WHERE id=?",String.class,pid));
    assertEquals(number,problemMapper.findByProblemNumber(number).getProblemNumber());
    assertEquals(0,db.queryForObject("SELECT count(*) FROM problem_assets WHERE problem_id=?",Integer.class,pid));
  }


  @Test
  void simpleTagsMappingAndFeedbackWorkflow() throws Exception {
    long manager=actor("fb"+UUID.randomUUID().toString().substring(0,8),"MANAGER");
    long user=actor("fu"+UUID.randomUUID().toString().substring(0,8),"EDITOR");
    long other=actor("fo"+UUID.randomUUID().toString().substring(0,8),"EDITOR");
    UUID paper=(UUID)service.paper(manager,"反馈测试 "+UUID.randomUUID()).get("id");
    UUID batch=(UUID)service.batch(manager,"feedback").get("id");
    var raw=new String(markdown("反馈原题").getBytes(),StandardCharsets.UTF_8).replace("tags:集合","tags:集合,集合的运算,导数");
    UUID id=(UUID)service.importFile(manager,batch,paper,"T1.md",new MockMultipartFile("file","T1.md","text/markdown",raw.getBytes(StandardCharsets.UTF_8)),List.of()).get("itemId");
    var doc=(EditorialDocument)service.detail(id).get("document");
    assertEquals(List.of("集合与逻辑","函数与导数"),doc.tags());
    var published=service.action(manager,id,new EditorialService.Action(1,"PUBLISH","",null));
    String number=published.get("problem_number").toString();
    assertEquals(0,queryCurriculum(number,true,List.of("A11","A13","A14"),List.of()));
    assertEquals(1,queryCurriculum(number,true,List.of("A11","A13","A14","A42"),List.of()));
    assertFalse(publicProblems.detail(number,null).curriculum().confirmed());
    assertEquals(List.of("A32","A33"),curriculum.suggest(List.of("双曲线")));
    long fid=((Number)((Map<?,?>)feedback.submit(user,number,"答案","答案有错误","建议核对计算",null)).get("id")).longValue();
    assertEquals(fid,((Number)((Map<?,?>)feedback.submit(user,number,"答案","答案有错误","",null)).get("id")).longValue());
    assertEquals(0L,((Map<?,?>)feedback.mine(other,1)).get("total"));
    assertThrows(BusinessException.class,()->feedback.queue(user,"OPEN",1));
    var snapshot=db.queryForObject("SELECT problem_snapshot->>'content' FROM problem_feedback WHERE id=?",String.class,fid);
    assertEquals("反馈原题",snapshot);
    var target=new cn.mathsea.backend.feedback.FeedbackService.Target(fid,1);
    var change=new cn.mathsea.backend.feedback.FeedbackService.Resolution(List.of(target),"CHANGES","已安排核对");
    assertThrows(BusinessException.class,()->feedback.resolve(user,change));
    feedback.resolve(manager,change);
    assertThrows(BusinessException.class,()->feedback.resolve(manager,change));
    long second=((Number)((Map<?,?>)feedback.submit(other,number,"解析","解析结论有误","",null)).get("id")).longValue();
    feedback.resolve(manager,new cn.mathsea.backend.feedback.FeedbackService.Resolution(List.of(new cn.mathsea.backend.feedback.FeedbackService.Target(fid,2)),"RESOLVED","已修正答案"));
    assertEquals("OPEN",db.queryForObject("SELECT status FROM problem_feedback WHERE id=?",String.class,second));
    assertEquals("RESOLVED",db.queryForObject("SELECT status FROM problem_feedback WHERE id=?",String.class,fid));
    var secondTarget=List.of(new cn.mathsea.backend.feedback.FeedbackService.Target(second,1));
    assertThrows(BusinessException.class,()->feedback.publish(manager,new cn.mathsea.backend.feedback.FeedbackService.Publication(id,9999,secondTarget)));
    assertEquals("OPEN",db.queryForObject("SELECT status FROM problem_feedback WHERE id=?",String.class,second));
    var revision=service.save(manager,id,new EditorialService.Save(version(published),doc,"反馈修订"));
    feedback.publish(manager,new cn.mathsea.backend.feedback.FeedbackService.Publication(id,version(revision),secondTarget));
    assertEquals("RESOLVED",db.queryForObject("SELECT status FROM problem_feedback WHERE id=?",String.class,second));
    trash.delete(manager,List.of(number));
    assertThrows(BusinessException.class,()->feedback.submit(user,number,"答案","再次提交错误","",null));
    assertEquals(snapshot,db.queryForObject("SELECT problem_snapshot->>'content' FROM problem_feedback WHERE id=?",String.class,fid));
    mvc.perform(get("/api/v1/feedback/mine")).andExpect(status().isUnauthorized());
  }

  @Test
  void paperRandomOrderingIsStableAcrossPagesAndRespectsFilters() throws Exception {
    String marker = "paper-seed-" + UUID.randomUUID();
    for (int i = 0; i < 30; i++) {
      db.update("INSERT INTO problems(problem_number,title,question_type,difficulty,content,created_at,deleted) VALUES(?,?,?,?,?,NOW() + (? * INTERVAL '1 second'),?)",
          "TC" + String.format("%06d", 800000 + i), marker, i < 25 ? "single-choice" : "solution", "red", "测试题干", i, i == 24);
    }
    var first = paperQuery(marker, "random", "seed-one", 1, 12);
    var second = paperQuery(marker, "random", "seed-one", 2, 12);
    var all = paperQuery(marker, "random", "seed-one", 1, 100);
    assertEquals(24, all.size());
    assertEquals(first, paperQuery(marker, "random", "seed-one", 1, 12));
    var combined = new ArrayList<>(first); combined.addAll(second);
    assertEquals(all, combined);
    assertEquals(24, new HashSet<>(combined).size());
    assertNotEquals(all, paperQuery(marker, "random", "seed-two", 1, 100));
    var newest = paperQuery(marker, "newest", "seed-one", 1, 12);
    assertEquals("TC800023", newest.getFirst());
    mvc.perform(get("/api/v1/problems").param("keyword", marker).param("type", "single-choice")
        .param("sort", "random").param("seed", "seed-one").param("pageSize", "12"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(first.getFirst()));
  }

  private List<String> paperQuery(String keyword, String sort, String seed, int page, int pageSize) {
    return publicProblems.query(new cn.mathsea.backend.problem.dto.ProblemQuery(keyword, List.of(), List.of(),
        List.of("single-choice"), List.of(), List.of(), sort, page, pageSize, false, List.of(), List.of(), seed), null)
        .items().stream().map(cn.mathsea.backend.problem.vo.ProblemListVO::id).toList();
  }

  private long queryCurriculum(
      String number, boolean learning, List<String> learned, List<String> chapters) {
    return publicProblems
        .query(
            new cn.mathsea.backend.problem.dto.ProblemQuery(
                number, List.of(), List.of(), List.of(), List.of(), List.of(), "newest", 1, 20,
                learning, learned, chapters),
            null)
        .pagination()
        .total();
  }
}
