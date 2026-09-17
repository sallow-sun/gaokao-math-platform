package cn.mathsea.backend.practice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("practice_list_items")
public class PracticeListItem {
    @TableId(type = IdType.AUTO) private Long id;
    @TableField("practice_list_id") private Long practiceListId;
    @TableField("problem_id") private Long problemId;
    private Integer position;
    private String note;
    @TableField("added_at") private OffsetDateTime addedAt;
    @TableField("updated_at") private OffsetDateTime updatedAt;
}
