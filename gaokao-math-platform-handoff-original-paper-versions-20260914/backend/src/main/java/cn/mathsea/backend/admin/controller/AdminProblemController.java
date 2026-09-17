package cn.mathsea.backend.admin.controller;

import cn.mathsea.backend.admin.dto.AdminProblemRequest;
import cn.mathsea.backend.admin.service.AdminProblemService;
import cn.mathsea.backend.admin.vo.AdminProblemVO;
import cn.mathsea.backend.auth.vo.SimpleMessage;
import cn.mathsea.backend.common.api.PageResponse;
import cn.mathsea.backend.problem.vo.ProblemAssetVO;
import cn.mathsea.backend.problem.vo.ProblemListVO;
import cn.mathsea.backend.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/admin/problems")
@RequiredArgsConstructor
public class AdminProblemController {
    private final AdminProblemService service;

    private void requireWorkbench() {
        throw cn.mathsea.backend.common.exception.BusinessException.conflict("USE_WORKBENCH", "请使用题目工作台创建草稿并复核发布");
    }

    @GetMapping
    public PageResponse<ProblemListVO> list(@RequestParam(required=false) String keyword,
                                            @RequestParam(defaultValue="1") int page,
                                            @RequestParam(defaultValue="20") int pageSize) {
        return service.list(keyword, page, pageSize);
    }

    @GetMapping("/{problemId}")
    public AdminProblemVO detail(@PathVariable String problemId) { return service.detail(problemId); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminProblemVO create(@Valid @RequestBody AdminProblemRequest request, Authentication auth) {
        requireWorkbench();
        return service.create(SecurityUtils.requireUserId(auth), request);
    }

    @PostMapping(value="/import-markdown", consumes="multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminProblemVO importMarkdown(@RequestPart("file") MultipartFile file, Authentication auth) {
        requireWorkbench();
        return service.importMarkdown(SecurityUtils.requireUserId(auth), file);
    }

    @PutMapping("/{problemId}")
    public AdminProblemVO update(@PathVariable String problemId, @Valid @RequestBody AdminProblemRequest request, Authentication auth) {
        requireWorkbench();
        return service.update(SecurityUtils.requireUserId(auth), problemId, request);
    }

    @DeleteMapping("/{problemId}")
    public SimpleMessage delete(@PathVariable String problemId, Authentication auth) {
        requireWorkbench();
        service.delete(SecurityUtils.requireUserId(auth), problemId);
        return new SimpleMessage("题目已删除");
    }

    @PostMapping(value="/{problemId}/assets", consumes="multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public ProblemAssetVO uploadAsset(@PathVariable String problemId,
                                      @RequestPart("file") MultipartFile file,
                                      @RequestPart(value="altText", required=false) String altText,
                                      Authentication auth) {
        requireWorkbench();
        return service.uploadAsset(SecurityUtils.requireUserId(auth), problemId, file, altText);
    }

    @DeleteMapping("/{problemId}/assets/{assetId}")
    public SimpleMessage deleteAsset(@PathVariable String problemId, @PathVariable Long assetId, Authentication auth) {
        requireWorkbench();
        service.deleteAsset(SecurityUtils.requireUserId(auth), problemId, assetId);
        return new SimpleMessage("图片已删除");
    }
}
