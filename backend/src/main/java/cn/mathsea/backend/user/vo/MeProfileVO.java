package cn.mathsea.backend.user.vo;
import java.time.OffsetDateTime;
public record MeProfileVO(
        String publicId,
        String uid,
        String username,
        String email,
        String phone,
        String avatarUrl,
        String signature,
        String role,
        String status,
        OffsetDateTime joinedAt,
        UserStatsVO stats
) {}
