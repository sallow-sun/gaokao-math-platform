package cn.mathsea.backend.admin.controller;
import cn.mathsea.backend.admin.service.ProblemTrashService;
import cn.mathsea.backend.security.SecurityUtils;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/problem-trash")
@RequiredArgsConstructor
public class ProblemTrashController {
  private final ProblemTrashService service;
  public record Selection(List<String> numbers) {}
  public record Confirmation(String number) {}
  @GetMapping public Object list(Authentication auth,@RequestParam(defaultValue="") String keyword,@RequestParam(defaultValue="1") int page) { return service.list(SecurityUtils.requireUserId(auth),keyword,page); }
  @PostMapping public void delete(Authentication auth,@RequestBody Selection body) { service.delete(SecurityUtils.requireUserId(auth),body.numbers()); }
  @PostMapping("/{number}/restore") public void restore(Authentication auth,@PathVariable String number) { service.restore(SecurityUtils.requireUserId(auth),number); }
  @DeleteMapping("/{number}") public void purge(Authentication auth,@PathVariable String number,@RequestBody Confirmation body) { service.purge(SecurityUtils.requireUserId(auth),number,body.number()); }
}
