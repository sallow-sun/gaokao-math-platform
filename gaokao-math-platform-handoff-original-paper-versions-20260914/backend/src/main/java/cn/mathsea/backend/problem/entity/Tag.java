package cn.mathsea.backend.problem.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("tags")
public class Tag {
    @TableId(type = IdType.AUTO) private Long id;
    private String name;
    @TableField("sort_order") private Integer sortOrder;
    private Boolean active;
    @TableField("created_at") private OffsetDateTime createdAt;
    @TableField("updated_at") private OffsetDateTime updatedAt;
}
