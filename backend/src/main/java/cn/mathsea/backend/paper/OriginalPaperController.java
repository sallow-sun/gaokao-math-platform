package cn.mathsea.backend.paper;

import cn.mathsea.backend.security.SecurityUtils;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/original-papers")
@RequiredArgsConstructor
public class OriginalPaperController {
  private final OriginalPaperService service;

  @GetMapping
  public Object list() {
    return service.list();
  }

  @GetMapping("/{id}")
  public Object detail(@PathVariable UUID id) {
    return service.detail(id);
  }

  @PutMapping("/{id}")
  public Object save(
      @PathVariable UUID id, @RequestBody OriginalPaperService.Edit body, Authentication auth) {
    return service.save(id, SecurityUtils.requireUserId(auth), body);
  }

  @PostMapping("/{id}/publish")
  public Object publish(
      @PathVariable UUID id, @RequestBody OriginalPaperService.Publish body, Authentication auth) {
    return service.publish(id, SecurityUtils.requireUserId(auth), body);
  }
}
