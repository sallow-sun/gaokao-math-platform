package cn.mathsea.backend.practice.vo;
import cn.mathsea.backend.problem.vo.ProblemListVO;
import java.time.OffsetDateTime;
public record PracticeListItemVO(
        String problemId, int position, String note,
        OffsetDateTime addedAt, OffsetDateTime updatedAt,
        ProblemListVO problem
) {}
