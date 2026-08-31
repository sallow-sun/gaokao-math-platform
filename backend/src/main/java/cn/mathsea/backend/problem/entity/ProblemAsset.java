package cn.mathsea.backend.problem.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("problem_assets")
public class ProblemAsset {
    @TableId(type = IdType.AUTO) private Long id;
    @TableField("problem_id") private Long problemId;
    private String url;
    @TableField("mime_type") private String mimeType;
    @TableField("alt_text") private String altText;
    @TableField("sort_order") private Integer sortOrder;
    @TableField("created_at") private OffsetDateTime createdAt;
}
