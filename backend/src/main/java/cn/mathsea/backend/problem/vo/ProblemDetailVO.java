package cn.mathsea.backend.problem.vo;

import java.time.OffsetDateTime;
import java.util.List;

public record ProblemDetailVO(
    String id,
    String title,
    String detail,
    Integer year,
    String region,
    String source,
    String sourceLabel,
    String type,
    String typeLabel,
    String level,
    List<String> tags,
    String sourceText,
    String content,
    String answer,
    String solution,
    String contentFormat,
    ProblemStatsVO stats,
    ViewerStateVO viewerState,
    UploaderVO uploader,
    List<ProblemAssetVO> assets,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    cn.mathsea.backend.curriculum.CurriculumAnnotation curriculum) {}
