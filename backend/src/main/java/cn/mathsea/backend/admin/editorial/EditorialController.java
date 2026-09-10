package cn.mathsea.backend.admin.editorial;

import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.security.SecurityUtils;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/admin/editorial")
@RequiredArgsConstructor
public class EditorialController {
  private final EditorialService service;

  @GetMapping("/me")
  public Map<String, Object> me(Authentication auth) {
    Long id = SecurityUtils.requireUserId(auth);
    return Map.of("id", id, "permission", service.permission(id));
  }

  @GetMapping("/members")
  public Object members(Authentication auth) {
    return service.members(SecurityUtils.requireUserId(auth));
  }

  @PutMapping("/members/{id}")
  public void permission(
      @PathVariable Long id, @RequestBody Map<String, String> body, Authentication auth) {
    service.setPermission(SecurityUtils.requireUserId(auth), id, body.get("permission"));
  }

  @GetMapping("/papers")
  public Object papers() {
    return service.papers();
  }

  @PostMapping("/papers")
  public Object paper(@RequestBody Map<String, String> body, Authentication auth) {
    return service.paper(SecurityUtils.requireUserId(auth), body.get("title"));
  }

  @GetMapping("/batches")
  public Object batches() {
    return service.batches();
  }

  @GetMapping("/batches/{id}")
  public Object entries(@PathVariable UUID id) {
    return service.entries(id);
  }

  @PostMapping("/batches")
  public Object batch(@RequestBody Map<String, String> body, Authentication auth) {
    return service.batch(SecurityUtils.requireUserId(auth), body.get("title"));
  }

  @PostMapping(value = "/import", consumes = "multipart/form-data")
  public Object upload(
      @RequestParam UUID batchId,
      @RequestParam UUID paperId,
      @RequestParam String path,
      @RequestPart("file") MultipartFile file,
      @RequestPart(value = "images", required = false) List<MultipartFile> images,
      Authentication auth) {
    Long actor = SecurityUtils.requireUserId(auth);
    try {
      return service.importFile(
          actor, batchId, paperId, path, file, images == null ? List.of() : images);
    } catch (BusinessException e) {
      service.failure(actor, batchId, path, e.getMessage());
      throw e;
    } catch (RuntimeException e) {
      service.failure(actor, batchId, path, "服务器处理失败，请重试或联系负责人");
      throw e;
    }
  }

  @GetMapping("/items")
  public Object queue(
      @RequestParam(defaultValue = "") String status,
      @RequestParam(required = false) UUID paperId,
      @RequestParam(defaultValue = "") String keyword,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "") String chapterStatus,
      @RequestParam(defaultValue = "") String issue) {
    return service.queue(status, paperId, keyword, page, chapterStatus, issue);
  }

  @PostMapping("/items/{id}/lease")
  public Object acquire(@PathVariable UUID id, Authentication auth) {
    return service.acquire(SecurityUtils.requireUserId(auth), id);
  }

  @DeleteMapping("/items/{id}/lease")
  public void release(@PathVariable UUID id, Authentication auth) {
    service.releaseLease(SecurityUtils.requireUserId(auth), id);
  }

  @PostMapping("/items")
  public Object manual(Authentication auth) {
    return service.manual(SecurityUtils.requireUserId(auth));
  }

  @PostMapping("/bulk")
  public void bulk(@RequestBody EditorialService.Bulk request, Authentication auth) {
    service.bulk(SecurityUtils.requireUserId(auth), request);
  }

  @PostMapping("/published/{number}")
  public Object existing(@PathVariable String number, Authentication auth) {
    return service.fromPublished(SecurityUtils.requireUserId(auth), number);
  }

  @GetMapping("/items/{id}")
  public Object detail(@PathVariable UUID id) {
    return service.detail(id);
  }

  @GetMapping("/items/{id}/history/{historyId}")
  public Object history(@PathVariable UUID id, @PathVariable Long historyId) {
    return service.history(id, historyId);
  }

  @PutMapping("/items/{id}")
  public Object save(
      @PathVariable UUID id, @RequestBody EditorialService.Save body, Authentication auth) {
    return service.save(SecurityUtils.requireUserId(auth), id, body);
  }

  @PostMapping("/items/{id}/actions")
  public Object action(
      @PathVariable UUID id, @RequestBody EditorialService.Action body, Authentication auth) {
    return service.action(SecurityUtils.requireUserId(auth), id, body);
  }

  @PostMapping(value = "/items/{id}/assets", consumes = "multipart/form-data")
  public Object asset(
      @PathVariable UUID id,
      @RequestParam long version,
      @RequestParam(defaultValue = "content") String section,
      @RequestPart("file") MultipartFile file,
      Authentication auth) {
    return service.upload(SecurityUtils.requireUserId(auth), id, version, file, section);
  }
}
