package cn.mathsea.backend.admin.dto;

import jakarta.validation.constraints.*;
import java.util.List;

public record AdminProblemRequest(
        @NotBlank @Pattern(regexp="^P\\d+$", message="题目编号格式应为 P 加数字") String problemNumber,
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
