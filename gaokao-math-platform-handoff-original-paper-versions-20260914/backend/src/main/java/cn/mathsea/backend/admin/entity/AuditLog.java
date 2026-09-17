package cn.mathsea.backend.admin.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("audit_logs")
public class AuditLog {
    @TableId(type = IdType.AUTO) private Long id;
    @TableField("actor_user_id") private Long actorUserId;
    private String action;
    @TableField("target_type") private String targetType;
    @TableField("target_id") private String targetId;
    private String details;
    @TableField("created_at") private OffsetDateTime createdAt;
}
