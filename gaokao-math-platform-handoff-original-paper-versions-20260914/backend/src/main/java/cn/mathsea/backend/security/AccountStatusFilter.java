package cn.mathsea.backend.security;

import cn.mathsea.backend.common.exception.ApiErrorResponse;
import cn.mathsea.backend.user.entity.UserAccount;
import cn.mathsea.backend.user.mapper.UserMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AccountStatusFilter extends OncePerRequestFilter {
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof CustomUserPrincipal principal) {
            UserAccount fresh = userMapper.selectById(principal.id());
            boolean invalid = fresh == null
                    || !"ACTIVE".equals(fresh.getStatus())
                    || !principal.role().equals(fresh.getRole())
                    || principal.sessionVersion() != (fresh.getSessionVersion() == null ? 0 : fresh.getSessionVersion());
            if (invalid) {
                var session = request.getSession(false);
                if (session != null) session.invalidate();
                SecurityContextHolder.clearContext();
                response.setStatus(401);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setCharacterEncoding("UTF-8");
                objectMapper.writeValue(response.getWriter(), ApiErrorResponse.of(
                        "SESSION_INVALIDATED", "账号状态或权限已变化，请重新登录", null, UUID.randomUUID().toString()));
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}
