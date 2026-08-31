package cn.mathsea.backend.user.service;

import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.common.storage.LocalFileStorageService;
import cn.mathsea.backend.problem.mapper.ProblemMapper;
import cn.mathsea.backend.problem.mapper.UserProblemStateMapper;
import cn.mathsea.backend.user.dto.ProfileUpdateRequest;
import cn.mathsea.backend.user.dto.UsernameChangeRequest;
import cn.mathsea.backend.user.entity.UserAccount;
import cn.mathsea.backend.user.mapper.UserMapper;
import cn.mathsea.backend.user.vo.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final UserProblemStateMapper stateMapper;
    private final ProblemMapper problemMapper;
    private final PasswordEncoder passwordEncoder;
    private final LocalFileStorageService storageService;

    public PublicUserVO publicProfile(Long userId, Long viewerUserId) {
        UserAccount user = userMapper.selectById(userId);
        if (user == null) throw BusinessException.notFound("USER_NOT_FOUND", "用户不存在");
        List<UserDailyStatVO> dailyActivity = stateMapper.completedByDay(user.getId());
        return new PublicUserVO(
                user.getId(), user.getPublicId().toString(), user.getUid(), user.getUsername(), user.getAvatarUrl(),
                user.getSignature(), user.getRole(), user.getCreatedAt(), stats(user.getId(), dailyActivity), List.of(),
                dailyActivity, stateMapper.completedByType(user.getId()), stateMapper.completedByTagAndLevel(user.getId()),
                user.getId().equals(viewerUserId));
    }

    public MeProfileVO me(Long userId) {
        UserAccount user = requireUser(userId);
        return new MeProfileVO(
                user.getPublicId().toString(), user.getUid(), user.getUsername(), user.getEmail(), user.getPhone(),
                user.getAvatarUrl(), user.getSignature(), user.getRole(), user.getStatus(), user.getCreatedAt(), stats(userId));
    }

    @Transactional
    public MeProfileVO updateProfile(Long userId, ProfileUpdateRequest request) {
        UserAccount user = requireUser(userId);
        user.setSignature(request.signature() == null ? "" : request.signature().trim());
        userMapper.updateById(user);
        return me(userId);
    }

    @Transactional
    public MeProfileVO changeUsername(Long userId, UsernameChangeRequest request) {
        UserAccount user = requireUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw BusinessException.badRequest("CURRENT_PASSWORD_WRONG", "当前密码不正确");
        }
        String username = request.username().trim();
        if (!username.equals(user.getUsername()) && userMapper.countByUsername(username) > 0) {
            throw BusinessException.conflict("USERNAME_TAKEN", "该用户名已被使用");
        }
        user.setUsername(username);
        userMapper.updateById(user);
        return me(userId);
    }

    @Transactional
    public AvatarResponse uploadAvatar(Long userId, MultipartFile file) {
        UserAccount user = requireUser(userId);
        var stored = storageService.saveAvatar(file, user.getAvatarUrl());
        user.setAvatarUrl(stored.url());
        userMapper.updateById(user);
        return new AvatarResponse(stored.url());
    }

    @Transactional
    public void deleteAvatar(Long userId) {
        UserAccount user = requireUser(userId);
        storageService.deleteUrl(user.getAvatarUrl());
        user.setAvatarUrl(null);
        userMapper.updateById(user);
    }

    private UserStatsVO stats(Long userId) {
        return stats(userId, stateMapper.completedByDay(userId));
    }

    private UserStatsVO stats(Long userId, List<UserDailyStatVO> dailyActivity) {
        return new UserStatsVO(
                stateMapper.countCompleted(userId),
                stateMapper.countFavorite(userId),
                problemMapper.countByCreator(userId),
                calculateStreak(dailyActivity)
        );
    }

    private long calculateStreak(List<UserDailyStatVO> dailyActivity) {
        var dates = dailyActivity.stream().map(UserDailyStatVO::getDate).map(LocalDate::parse).collect(java.util.stream.Collectors.toSet());
        LocalDate day = LocalDate.now(java.time.ZoneId.of("Asia/Shanghai"));
        if (!dates.contains(day)) day = day.minusDays(1);
        long streak = 0;
        while (dates.contains(day)) {
            streak++;
            day = day.minusDays(1);
        }
        return streak;
    }

    private UserAccount requireUser(Long userId) {
        UserAccount user = userMapper.selectById(userId);
        if (user == null) throw BusinessException.notFound("USER_NOT_FOUND", "用户不存在");
        return user;
    }

}
