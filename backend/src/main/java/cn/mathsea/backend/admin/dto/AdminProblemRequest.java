package cn.mathsea.backend.admin.dto;

import jakarta.validation.constraints.*;
import java.util.List;

public record AdminProblemRequest(
        @NotBlank
        @Size(max=32)
        @Pattern(
                regexp="^[A-Za-z0-9][A-Za-z0-9_-]*$",
                message="题目编号只能包含英文字母、数字、下划线和连字符"
        ) String problemNumber,
        @Size(max=255) String title,
        Integer year,
        @Size(max=100) String region,
        @Size(max=64) String source,
        @NotBlank String type,
        @NotBlank String level,
        @Size(max=50) List<@Size(max=100) String> tags,
        @NotBlank String content,
        String answer,
        String solution,
        @Size(max=40) String contentFormat
) {}
