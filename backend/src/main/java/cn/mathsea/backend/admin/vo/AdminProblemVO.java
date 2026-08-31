package cn.mathsea.backend.admin.vo;
import cn.mathsea.backend.problem.vo.ProblemAssetVO;
import java.time.OffsetDateTime;
import java.util.List;
public record AdminProblemVO(
        String problemNumber, String title, Integer year, String region,
        String source, String sourceLabel, String type, String typeLabel,
        String level, List<String> tags, String content, String answer, String solution,
        String contentFormat, long views, long favorites, List<ProblemAssetVO> assets,
        OffsetDateTime createdAt, OffsetDateTime updatedAt
) {}
