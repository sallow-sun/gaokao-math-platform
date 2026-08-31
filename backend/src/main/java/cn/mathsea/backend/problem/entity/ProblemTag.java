package cn.mathsea.backend.problem.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("problem_tags")
public class ProblemTag {
    @TableId(type = IdType.AUTO) private Long id;
    @TableField("problem_id") private Long problemId;
    @TableField("tag_id") private Long tagId;
}
