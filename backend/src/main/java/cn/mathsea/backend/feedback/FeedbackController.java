package cn.mathsea.backend.feedback;
import cn.mathsea.backend.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
public class FeedbackController {
  private final FeedbackService service;
  @PostMapping(value="/api/v1/feedback",consumes="multipart/form-data")
  public Object submit(Authentication auth,@RequestParam String number,@RequestParam String kind,@RequestParam String description,@RequestParam(defaultValue="") String suggestion,@RequestParam(required=false) MultipartFile image) {
    return service.submit(SecurityUtils.requireUserId(auth),number,kind,description,suggestion,image);
  }
  @GetMapping("/api/v1/feedback/mine") public Object mine(Authentication auth,@RequestParam(defaultValue="1") int page) { return service.mine(SecurityUtils.requireUserId(auth),page); }
  @GetMapping("/api/v1/admin/feedback") public Object queue(Authentication auth,@RequestParam(defaultValue="OPEN") String status,@RequestParam(defaultValue="1") int page) { return service.queue(SecurityUtils.requireUserId(auth),status,page); }
  @GetMapping("/api/v1/admin/feedback/{number}") public Object detail(Authentication auth,@PathVariable String number) { return service.detail(SecurityUtils.requireUserId(auth),number); }
  @PostMapping("/api/v1/admin/feedback/resolve") public void resolve(Authentication auth,@RequestBody FeedbackService.Resolution request) { service.resolve(SecurityUtils.requireUserId(auth),request); }
  @PostMapping("/api/v1/admin/feedback/publish") public Object publish(Authentication auth,@RequestBody FeedbackService.Publication request) { return service.publish(SecurityUtils.requireUserId(auth),request); }
}
