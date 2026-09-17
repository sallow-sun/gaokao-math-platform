package cn.mathsea.backend.security;

import cn.mathsea.backend.user.entity.UserAccount;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serial;
import java.io.Serializable;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public class CustomUserPrincipal implements UserDetails, Serializable {
    @Serial private static final long serialVersionUID = 1L;

    private final Long id;
    private final UUID publicId;
    private final String uid;
    private final String username;
    private final String passwordHash;
    private final String role;
    private final String status;
    private final int sessionVersion;

    public CustomUserPrincipal(UserAccount user) {
        this.id = user.getId();
        this.publicId = user.getPublicId();
        this.uid = user.getUid();
        this.username = user.getUsername();
        this.passwordHash = user.getPasswordHash();
        this.role = user.getRole();
        this.status = user.getStatus();
        this.sessionVersion = user.getSessionVersion() == null ? 0 : user.getSessionVersion();
    }

    public Long id() { return id; }
    public UUID publicId() { return publicId; }
    public String uid() { return uid; }
    public String role() { return role; }
    public String status() { return status; }
    public int sessionVersion() { return sessionVersion; }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }
    @Override public String getPassword() { return passwordHash; }
    @Override public String getUsername() { return username; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return "ACTIVE".equals(status); }
}
