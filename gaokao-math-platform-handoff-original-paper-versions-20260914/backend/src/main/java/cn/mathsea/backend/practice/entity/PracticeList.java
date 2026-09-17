package cn.mathsea.backend.practice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@TableName("practice_lists")
public class PracticeList {
    @TableId(type = IdType.AUTO) private Long id;
    @TableField("public_id") private UUID publicId;
    @TableField("user_id") private Long userId;
    private String title;
    private String description;
    @TableField("is_default") private Boolean defaultList;
    @TableField("is_public") private Boolean publicList;
    @TableField("is_official") private Boolean official;
    @TableField("created_at") private OffsetDateTime createdAt;
    @TableField("updated_at") private OffsetDateTime updatedAt;
}
