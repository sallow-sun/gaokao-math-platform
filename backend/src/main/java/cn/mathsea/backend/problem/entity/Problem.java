package cn.mathsea.backend.problem.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("problems")
public class Problem {
    @TableId(type = IdType.AUTO) private Long id;
    @TableField("problem_number") private String problemNumber;
    private String title;
    private Integer year;
    private String region;
    @TableField("source_code") private String sourceCode;
    @TableField("question_type") private String questionType;
    private String difficulty;
    private String content;
    private String answer;
    private String solution;
    @TableField("content_format") private String contentFormat;
    @TableField("creator_user_id") private Long creatorUserId;
    @TableField("view_count") private Long viewCount;
    @TableField("favorite_count") private Long favoriteCount;
    @TableField("created_at") private OffsetDateTime createdAt;
    @TableField("updated_at") private OffsetDateTime updatedAt;
}
