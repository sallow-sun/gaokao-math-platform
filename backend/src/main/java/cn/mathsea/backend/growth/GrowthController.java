package cn.mathsea.backend.growth;

import cn.mathsea.backend.security.SecurityUtils;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class GrowthController {
  private final GrowthService growth;

  @GetMapping("/api/v1/admin/growth/users/{id}")
  public Object history(
      Authentication auth, @PathVariable Long id, @RequestParam(defaultValue = "1") int page) {
    return growth.adminHistory(SecurityUtils.requireUserId(auth), id, page);
  }

  @GetMapping("/api/v1/users/me/growth")
  public Object mine(Authentication auth, @RequestParam(defaultValue = "1") int page) {
    return growth.history(SecurityUtils.requireUserId(auth), page);
  }

  @PostMapping("/api/v1/admin/growth/events/{id}/revoke")
  public void revoke(
      Authentication auth, @PathVariable long id, @RequestBody Map<String, String> body) {
    growth.revoke(SecurityUtils.requireUserId(auth), id, body.get("reason"));
  }
}
