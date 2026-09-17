package cn.mathsea.backend.practice.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record PracticeListCreateRequest(
        @NotBlank @Size(max=100) String title,
        @Size(max=500) String description,
        Boolean isPublic,
        Boolean isOfficial
) {}
