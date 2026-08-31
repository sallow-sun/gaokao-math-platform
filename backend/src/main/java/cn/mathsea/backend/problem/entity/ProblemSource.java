package cn.mathsea.backend.problem.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("problem_sources")
public class ProblemSource {
    @TableId(type = IdType.INPUT) private String code;
    private String label;
    @TableField("sort_order") private Integer sortOrder;
    private Boolean active;
    @TableField("created_at") private OffsetDateTime createdAt;
    @TableField("updated_at") private OffsetDateTime updatedAt;
}
