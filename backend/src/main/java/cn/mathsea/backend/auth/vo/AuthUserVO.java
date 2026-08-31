package cn.mathsea.backend.auth.vo;
public record AuthUserVO(
        Long id,
        String publicId,
        String uid,
        String username,
        String avatarUrl,
        String role,
        boolean officialListOwner
) {}
