package cn.mathsea.backend.problem.dto;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
public record ProblemStateBatchRequest(
        @NotEmpty @Size(max=200) List<String> problemIds,
        Boolean favorite,
        Boolean completed
) {}
