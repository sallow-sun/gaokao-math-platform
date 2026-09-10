package cn.mathsea.backend.admin.service;

import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.common.rate.RateLimitService;
import cn.mathsea.backend.security.CustomUserPrincipal;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PurgeAuthorizationService {
  private final AuthenticationManager authenticationManager;
  private final RateLimitService rateLimit;
  private final JdbcTemplate db;

  public long authenticate(Long actor, String account, String password) {
    rateLimit.check("purge-approval", actor.toString(), 10, Duration.ofMinutes(10));
    if(account==null || account.isBlank() || account.length()>254 || password==null || password.isBlank() || password.length()>128)
      throw BusinessException.badRequest("APPROVAL_REQUIRED","请由另一位管理员输入账号和密码");
    try {
      // Authenticate only: never replace the operator's SecurityContext or session.
      var auth=authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(account.trim(),password));
      var principal=(CustomUserPrincipal)auth.getPrincipal();
      if(actor.equals(principal.id()) || db.queryForObject("SELECT count(*) FROM users WHERE id=? AND role='ADMIN' AND status='ACTIVE'",Long.class,principal.id())!=1)
        throw BusinessException.forbidden("SECOND_ADMIN_REQUIRED","必须由另一位正常使用的管理员认证");
      return principal.id();
    } catch(AuthenticationException e) {
      throw BusinessException.unauthorized("APPROVAL_FAILED","认证失败，请检查另一位管理员的账号和密码");
    }
  }
}
