package cn.mathsea.backend.security;

import cn.mathsea.backend.user.entity.UserAccount;
import cn.mathsea.backend.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {
    private final UserMapper userMapper;

    @Override
    public UserDetails loadUserByUsername(String account) throws UsernameNotFoundException {
        UserAccount user = userMapper.findByAccount(account);
        if (user == null) throw new UsernameNotFoundException("账号或密码错误");
        return new CustomUserPrincipal(user);
    }
}
