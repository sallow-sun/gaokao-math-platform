package cn.mathsea.backend.practice.dto;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
public record PracticeItemsRequest(@NotEmpty @Size(max=200) List<String> problemIds) {}
