package cn.mathsea.backend.admin.controller;

import cn.mathsea.backend.admin.dto.*;
import cn.mathsea.backend.admin.service.AdminCatalogService;
import cn.mathsea.backend.admin.vo.*;
import cn.mathsea.backend.auth.vo.SimpleMessage;
import cn.mathsea.backend.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminCatalogController {
    private final AdminCatalogService service;

    @GetMapping("/tags")
    public List<AdminTagVO> tags() { return service.tags(); }
    @PostMapping("/tags")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminTagVO createTag(@Valid @RequestBody AdminTagCreateRequest request, Authentication auth) {
        return service.createTag(SecurityUtils.requireUserId(auth), request);
    }
    @PatchMapping("/tags/{id}")
    public AdminTagVO updateTag(@PathVariable Long id, @Valid @RequestBody AdminTagUpdateRequest request, Authentication auth) {
        return service.updateTag(SecurityUtils.requireUserId(auth), id, request);
    }
    @DeleteMapping("/tags/{id}")
    public SimpleMessage deleteTag(@PathVariable Long id, Authentication auth) {
        service.deleteTag(SecurityUtils.requireUserId(auth), id); return new SimpleMessage("标签已删除");
    }

    @GetMapping("/sources")
    public List<AdminSourceVO> sources() { return service.sources(); }
    @PostMapping("/sources")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminSourceVO createSource(@Valid @RequestBody AdminSourceCreateRequest request, Authentication auth) {
        return service.createSource(SecurityUtils.requireUserId(auth), request);
    }
    @PatchMapping("/sources/{code}")
    public AdminSourceVO updateSource(@PathVariable String code, @Valid @RequestBody AdminSourceUpdateRequest request, Authentication auth) {
        return service.updateSource(SecurityUtils.requireUserId(auth), code, request);
    }
    @DeleteMapping("/sources/{code}")
    public SimpleMessage deleteSource(@PathVariable String code, Authentication auth) {
        service.deleteSource(SecurityUtils.requireUserId(auth), code); return new SimpleMessage("来源已删除");
    }
}
