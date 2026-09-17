package cn.mathsea.backend.security;

import cn.mathsea.backend.common.exception.BusinessException;
import org.springframework.security.core.Authentication;

public final class SecurityUtils {
    private SecurityUtils() {}

    public static Long userIdOrNull(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return null;
        if (authentication.getPrincipal() instanceof CustomUserPrincipal principal) return principal.id();
        return null;
    }

    public static Long requireUserId(Authentication authentication) {
        Long id = userIdOrNull(authentication);
        if (id == null) throw BusinessException.unauthorized("AUTH_REQUIRED", "请先登录");
        return id;
    }
}
