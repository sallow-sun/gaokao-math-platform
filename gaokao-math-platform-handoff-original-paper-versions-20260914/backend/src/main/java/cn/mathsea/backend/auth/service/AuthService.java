package cn.mathsea.backend.auth.service;

import cn.mathsea.backend.auth.dto.ChangePasswordRequest;
import cn.mathsea.backend.auth.dto.LoginRequest;
import cn.mathsea.backend.auth.dto.RegisterRequest;
import cn.mathsea.backend.auth.vo.*;
import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.common.rate.RateLimitService;
import cn.mathsea.backend.security.CustomUserPrincipal;
import cn.mathsea.backend.user.entity.UserAccount;
import cn.mathsea.backend.user.mapper.UserMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final RateLimitService rateLimitService;

    @Value("${mathsea.security.login-max-attempts:10}") private int loginMaxAttempts;
    @Value("${mathsea.security.login-window-seconds:600}") private long loginWindowSeconds;
    @Value("${mathsea.security.register-max-attempts:5}") private int registerMaxAttempts;
    @Value("${mathsea.security.register-window-seconds:3600}") private long registerWindowSeconds;

    @Transactional
    public RegisterResponse register(RegisterRequest req, String ip) {
        rateLimitService.check("register", ip, registerMaxAttempts, Duration.ofSeconds(registerWindowSeconds));
        String username = req.username().trim();
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        String phone = req.phone() == null || req.phone().isBlank() ? null : req.phone().trim();

        if (!req.password().equals(req.confirmPassword())) {
            throw BusinessException.badRequest("PASSWORD_MISMATCH", "两次输入的密码不一致");
        }

        String passwordHash = passwordEncoder.encode(req.password());

        // Serialize registration writes so the bootstrap decision and uniqueness checks
        // cannot become stale while another registration commits.
        userMapper.lockRegistrationBootstrap();
        if (userMapper.countByUsername(username) > 0) throw BusinessException.conflict("USERNAME_TAKEN", "该用户名已被使用");
        if (userMapper.countByEmail(email) > 0) throw BusinessException.conflict("EMAIL_TAKEN", "该邮箱已被注册");
        if (phone != null && userMapper.countByPhone(phone) > 0) throw BusinessException.conflict("PHONE_TAKEN", "该手机号已被使用");

        UserAccount user = new UserAccount();
        user.setPublicId(UUID.randomUUID());
        user.setUid("TMP" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        user.setUsername(username);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(passwordHash);
        user.setSignature("");
        user.setStatus("ACTIVE");

        // The database trigger remains the final guard, but the application must insert
        // the first account as ADMIN itself so the UID update cannot demote it to USER.
        user.setRole(userMapper.firstUserId() == null ? "ADMIN" : "USER");
        userMapper.insert(user);

        String uid = "UID%08d".formatted(user.getId());
        user.setUid(uid);
        userMapper.updateById(user);
        return new RegisterResponse("注册成功", uid, user.getPublicId().toString());
    }

    public AuthMeResponse login(LoginRequest req, String ip, HttpServletRequest request, HttpServletResponse response) {
        String account = req.account().trim();
        String rateIdentity = ip + "|" + account.toLowerCase(Locale.ROOT);
        rateLimitService.check("login", rateIdentity, loginMaxAttempts, Duration.ofSeconds(loginWindowSeconds));
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(account, req.password())
            );
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            request.getSession(true);
            request.changeSessionId();
            securityContextRepository.saveContext(context, request, response);
            rateLimitService.clear("login", rateIdentity);
            return new AuthMeResponse(true, toAuthUser((CustomUserPrincipal) authentication.getPrincipal()));
        } catch (AuthenticationException ex) {
            throw BusinessException.unauthorized("INVALID_CREDENTIALS", "账号或密码错误");
        }
    }

    public AuthMeResponse me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || !(authentication.getPrincipal() instanceof CustomUserPrincipal principal)) {
            return new AuthMeResponse(false, null);
        }
        UserAccount fresh = userMapper.selectById(principal.id());
        if (fresh == null || !"ACTIVE".equals(fresh.getStatus())) return new AuthMeResponse(false, null);
        return new AuthMeResponse(true, toAuthUser(new CustomUserPrincipal(fresh)));
    }

    public void logout(HttpServletRequest request) {
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest req, HttpServletRequest request) {
        if (!req.newPassword().equals(req.confirmPassword())) {
            throw BusinessException.badRequest("PASSWORD_MISMATCH", "两次输入的新密码不一致");
        }
        UserAccount user = userMapper.selectById(userId);
        if (user == null) throw BusinessException.notFound("USER_NOT_FOUND", "用户不存在");
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw BusinessException.badRequest("CURRENT_PASSWORD_WRONG", "当前密码不正确");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.setSessionVersion((user.getSessionVersion() == null ? 0 : user.getSessionVersion()) + 1);
        userMapper.updateById(user);
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
    }

    private AuthUserVO toAuthUser(CustomUserPrincipal p) {
        UserAccount user = userMapper.selectById(p.id());
        return new AuthUserVO(
                user.getId(),
                user.getPublicId().toString(),
                user.getUid(),
                user.getUsername(),
                user.getAvatarUrl(),
                user.getRole(),
                user.getId().equals(userMapper.firstUserId())
        );
    }
}
