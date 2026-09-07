package cn.mathsea.backend.admin.service;

import cn.mathsea.backend.admin.vo.AdminUserVO;
import cn.mathsea.backend.common.api.PageResponse;
import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.common.storage.LocalFileStorageService;
import cn.mathsea.backend.user.entity.UserAccount;
import cn.mathsea.backend.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminUserService {
    private final UserMapper userMapper;
    private final AuditLogService auditLogService;
    private final LocalFileStorageService storageService;

    public PageResponse<AdminUserVO> list(String keyword, int page, int pageSize) {
        page = Math.max(1, page); pageSize = Math.max(1, Math.min(pageSize, 100));
        String k = keyword == null ? null : keyword.trim();
        long total = userMapper.adminCount(k);
        List<AdminUserVO> items = userMapper.adminSearch(k, pageSize, (page-1)*pageSize).stream().map(this::toVo).toList();
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional
    public AdminUserVO setBanned(Long actorId, String publicId, boolean banned) {
        UserAccount target = userMapper.findByPublicId(parse(publicId));
        if (target == null) throw BusinessException.notFound("USER_NOT_FOUND", "用户不存在");
        if (target.getId().equals(actorId)) throw BusinessException.badRequest("CANNOT_BAN_SELF", "不能封禁自己");
        if ("ADMIN".equals(target.getRole())) throw BusinessException.forbidden("CANNOT_BAN_ADMIN", "暂不允许在后台封禁管理员账号");
        target.setStatus(banned ? "BANNED" : "ACTIVE");
        target.setSessionVersion((target.getSessionVersion() == null ? 0 : target.getSessionVersion()) + 1);
        userMapper.updateById(target);
        auditLogService.log(actorId, banned ? "USER_BAN" : "USER_UNBAN", "USER", target.getPublicId().toString(), target.getUsername());
        return toVo(target);
    }

    @Transactional
    public void delete(Long actorId, String publicId) {
        UserAccount target = userMapper.findByPublicId(parse(publicId));
        if (target == null) throw BusinessException.notFound("USER_NOT_FOUND", "用户不存在");
        if (target.getId().equals(actorId)) {
            throw BusinessException.badRequest("CANNOT_DELETE_SELF", "不能删除自己的账号");
        }
        if ("ADMIN".equals(target.getRole())) {
            throw BusinessException.forbidden("CANNOT_DELETE_ADMIN", "不能在管理后台删除管理员账号");
        }
        String targetId = target.getPublicId().toString();
        String details = target.getUsername() + " (" + target.getUid() + ")";
        storageService.deleteUrl(target.getAvatarUrl());
        userMapper.deleteById(target.getId());
        auditLogService.log(actorId, "USER_DELETE", "USER", targetId, details);
    }

    private AdminUserVO toVo(UserAccount u) {
        return new AdminUserVO(u.getPublicId().toString(), u.getUid(), u.getUsername(), u.getEmail(), u.getPhone(), u.getAvatarUrl(), u.getRole(), u.getStatus(), u.getCreatedAt());
    }
    private UUID parse(String s) {
        try { return UUID.fromString(s); } catch (Exception e) { throw BusinessException.notFound("USER_NOT_FOUND", "用户不存在"); }
    }
}
