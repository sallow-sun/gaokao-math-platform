package cn.mathsea.backend.curriculum;

import cn.mathsea.backend.admin.editorial.EditorialService;
import cn.mathsea.backend.security.SecurityUtils;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class CurriculumController {
  private final CurriculumService curriculum;
  private final EditorialService editorial;

  @GetMapping("/api/v1/curriculum")
  public Map<String, Object> catalog() {
    return curriculum.catalog();
  }

  @PutMapping("/api/v1/admin/curriculum/presets/{id}")
  public void update(
      @PathVariable String id,
      @RequestBody CurriculumService.PresetUpdate request,
      Authentication authentication) {
    Long actor = SecurityUtils.userIdOrNull(authentication);
    editorial.manager(actor);
    curriculum.updatePreset(actor, id, request);
  }
}
