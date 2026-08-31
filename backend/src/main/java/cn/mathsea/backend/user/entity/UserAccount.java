package cn.mathsea.backend.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@TableName("users")
public class UserAccount {
    @TableId(type = IdType.AUTO)
    private Long id;
    @TableField("public_id") private UUID publicId;
    private String uid;
    private String username;
    private String email;
    private String phone;
    @TableField("password_hash") private String passwordHash;
    @TableField("avatar_url") private String avatarUrl;
    private String signature;
    private String role;
    private String status;
    @TableField("session_version") private Integer sessionVersion;
    @TableField("created_at") private OffsetDateTime createdAt;
    @TableField("updated_at") private OffsetDateTime updatedAt;
}
