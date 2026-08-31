package cn.mathsea.backend.practice.dto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
public record PracticeOrderRequest(@NotNull @Size(max=1000) List<String> problemIds) {}
