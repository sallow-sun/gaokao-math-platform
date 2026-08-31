package cn.mathsea.backend.problem.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("user_problem_states")
public class UserProblemState {
    @TableId(type = IdType.AUTO) private Long id;
    @TableField("user_id") private Long userId;
    @TableField("problem_id") private Long problemId;
    private Boolean favorite;
    private Boolean completed;
    @TableField("updated_at") private OffsetDateTime updatedAt;
}
