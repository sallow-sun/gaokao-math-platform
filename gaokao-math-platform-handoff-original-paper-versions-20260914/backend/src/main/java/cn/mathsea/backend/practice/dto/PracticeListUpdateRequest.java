package cn.mathsea.backend.practice.dto;
import jakarta.validation.constraints.Size;
public record PracticeListUpdateRequest(
        @Size(min=1,max=100) String title,
        @Size(max=500) String description,
        Boolean isPublic
) {}
