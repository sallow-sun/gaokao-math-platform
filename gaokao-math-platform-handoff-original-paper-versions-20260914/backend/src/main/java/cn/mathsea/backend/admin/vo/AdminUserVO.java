package cn.mathsea.backend.admin.vo;
import java.time.OffsetDateTime;
public record AdminUserVO(
        String publicId, String uid, String username, String email, String phone,
        String avatarUrl, String role, String status, OffsetDateTime createdAt
) {}
