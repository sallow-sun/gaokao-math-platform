package cn.mathsea.backend.paper;

import cn.mathsea.backend.security.SecurityUtils;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/papers")
@RequiredArgsConstructor
public class SharedPaperController {
  private final SharedPaperService service;

  @GetMapping
  public Object list(
      Authentication auth,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "") String kind,
      @RequestParam(defaultValue = "all") String scope,
      @RequestParam(defaultValue = "newest") String sort,
      @RequestParam(required = false) Integer year,
      @RequestParam(defaultValue = "") String examMode,
      @RequestParam(defaultValue = "false") boolean checked,
      @RequestParam(defaultValue = "1") int page) {
    return service.list(
        SecurityUtils.userIdOrNull(auth), q, kind, scope, sort, year, examMode, checked, page);
  }

  @GetMapping("/{id}")
  public Object detail(@PathVariable UUID id, Authentication auth) {
    return service.detail(id, SecurityUtils.userIdOrNull(auth));
  }

  @PostMapping("/share")
  public Object share(@RequestBody SharedPaperService.Publication input, Authentication auth) {
    return service.share(SecurityUtils.requireUserId(auth), input);
  }

  @PostMapping("/uploads")
  public Object upload(@RequestBody SharedPaperService.Publication input, Authentication auth) {
    return service.beginUpload(SecurityUtils.requireUserId(auth), input);
  }

  @PostMapping("/{id}/complete")
  public Object complete(@PathVariable UUID id, Authentication auth) {
    return service.finishUpload(SecurityUtils.requireUserId(auth), id);
  }

  @PutMapping("/{id}/rating")
  public void rate(
      @PathVariable UUID id, @RequestBody SharedPaperService.Rating input, Authentication auth) {
    service.rate(id, SecurityUtils.requireUserId(auth), input);
  }

  @PutMapping("/{id}/favorite")
  public void favorite(
      @PathVariable UUID id, @RequestBody Map<String, Boolean> input, Authentication auth) {
    service.favorite(
        id, SecurityUtils.requireUserId(auth), Boolean.TRUE.equals(input.get("favorite")));
  }

  @PutMapping("/{id}/check")
  public void check(
      @PathVariable UUID id, @RequestBody SharedPaperService.Check input, Authentication auth) {
    service.check(id, SecurityUtils.requireUserId(auth), input);
  }

  @DeleteMapping("/{id}")
  public void remove(@PathVariable UUID id, Authentication auth) {
    service.remove(id, SecurityUtils.requireUserId(auth));
  }

  @PostMapping("/{id}/access")
  public Object access(
      @PathVariable UUID id,
      @RequestParam(defaultValue = "false") boolean download,
      Authentication auth) {
    return service.access(id, SecurityUtils.requireUserId(auth), download);
  }
}
