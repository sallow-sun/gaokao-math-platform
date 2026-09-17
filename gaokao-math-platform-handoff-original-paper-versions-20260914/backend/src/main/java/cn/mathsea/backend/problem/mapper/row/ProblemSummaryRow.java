package cn.mathsea.backend.problem.mapper.row;

import lombok.Data;
import java.time.OffsetDateTime;

@Data
public class ProblemSummaryRow {
    private Boolean deleted;
    private Long id;
    private String problemNumber;
    private String title;
    private Integer year;
    private String region;
    private String sourceCode;
    private String sourceLabel;
    private String questionType;
    private String difficulty;
    private String content;
    private String contentFormat;
    private Long creatorUserId;
    private Long viewCount;
    private Long favoriteCount;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
