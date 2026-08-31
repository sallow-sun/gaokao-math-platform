package cn.mathsea.backend.admin.controller;

import cn.mathsea.backend.admin.dto.AdminUserBanRequest;
import cn.mathsea.backend.admin.service.AdminUserService;
import cn.mathsea.backend.admin.vo.AdminUserVO;
import cn.mathsea.backend.common.api.PageResponse;
import cn.mathsea.backend.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {
    private final AdminUserService service;

    @GetMapping
    public PageResponse<AdminUserVO> list(@RequestParam(required=false) String keyword,
                                          @RequestParam(defaultValue="1") int page,
                                          @RequestParam(defaultValue="20") int pageSize) {
        return service.list(keyword, page, pageSize);
    }

    @PatchMapping("/{publicId}/ban")
    public AdminUserVO ban(@PathVariable String publicId, @Valid @RequestBody AdminUserBanRequest request, Authentication auth) {
        return service.setBanned(SecurityUtils.requireUserId(auth), publicId, request.banned());
    }
}
