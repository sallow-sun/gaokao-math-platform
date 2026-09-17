package cn.mathsea.backend.admin.service;

import cn.mathsea.backend.admin.vo.AdminStatsVO;
import cn.mathsea.backend.problem.mapper.ProblemMapper;
import cn.mathsea.backend.user.entity.UserAccount;
import cn.mathsea.backend.user.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminStatsService {
    private final UserMapper userMapper;
    private final ProblemMapper problemMapper;

    public AdminStatsVO stats() {
        long total = userMapper.selectCount(null);
        long active = userMapper.selectCount(new LambdaQueryWrapper<UserAccount>().eq(UserAccount::getStatus, "ACTIVE"));
        long banned = userMapper.selectCount(new LambdaQueryWrapper<UserAccount>().eq(UserAccount::getStatus, "BANNED"));
        return new AdminStatsVO(total, active, banned, problemMapper.selectCount(null));
    }
}
