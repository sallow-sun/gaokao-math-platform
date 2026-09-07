package cn.mathsea.backend.auth.service;

import cn.mathsea.backend.auth.dto.RegisterRequest;
import cn.mathsea.backend.auth.vo.RegisterResponse;
import cn.mathsea.backend.common.rate.RateLimitService;
import cn.mathsea.backend.user.entity.UserAccount;
import cn.mathsea.backend.user.mapper.UserMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    @Mock private UserMapper userMapper;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private SecurityContextRepository securityContextRepository;
    @Mock private RateLimitService rateLimitService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userMapper,
                passwordEncoder,
                authenticationManager,
                securityContextRepository,
                rateLimitService
        );
        when(passwordEncoder.encode("password123")).thenReturn("encoded-password");
    }

    @Test
    void firstRegistrationIsInsertedDirectlyAsAdmin() {
        when(userMapper.firstUserId()).thenReturn(null);
        assignInsertedId(1L);

        RegisterResponse response = authService.register(request("first", "first@example.com"), "127.0.0.1");

        ArgumentCaptor<UserAccount> inserted = ArgumentCaptor.forClass(UserAccount.class);
        verify(userMapper).insert(inserted.capture());
        assertEquals("ADMIN", inserted.getValue().getRole());
        assertEquals("ACTIVE", inserted.getValue().getStatus());
        assertEquals("UID00000001", response.uid());

        var order = inOrder(userMapper);
        order.verify(userMapper).lockRegistrationBootstrap();
        order.verify(userMapper).firstUserId();
        order.verify(userMapper).insert(any(UserAccount.class));
    }

    @Test
    void laterRegistrationIsInsertedAsUser() {
        when(userMapper.firstUserId()).thenReturn(1L);
        assignInsertedId(2L);

        RegisterResponse response = authService.register(request("second", "second@example.com"), "127.0.0.2");

        ArgumentCaptor<UserAccount> inserted = ArgumentCaptor.forClass(UserAccount.class);
        verify(userMapper).insert(inserted.capture());
        assertEquals("USER", inserted.getValue().getRole());
        assertEquals("UID00000002", response.uid());
    }

    private RegisterRequest request(String username, String email) {
        return new RegisterRequest(username, email, null, "password123", "password123");
    }

    private void assignInsertedId(long id) {
        doAnswer(invocation -> {
            UserAccount user = invocation.getArgument(0);
            user.setId(id);
            return 1;
        }).when(userMapper).insert(any(UserAccount.class));
    }
}
