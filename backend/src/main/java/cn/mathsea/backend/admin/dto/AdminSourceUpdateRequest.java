package cn.mathsea.backend.admin.dto;
import jakarta.validation.constraints.Size;
public record AdminSourceUpdateRequest(@Size(min=1,max=100) String label, Integer sortOrder, Boolean active) {}
