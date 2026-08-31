package cn.mathsea.backend.admin.dto;
import jakarta.validation.constraints.Size;
public record AdminTagUpdateRequest(@Size(min=1,max=100) String name, Integer sortOrder, Boolean active) {}
