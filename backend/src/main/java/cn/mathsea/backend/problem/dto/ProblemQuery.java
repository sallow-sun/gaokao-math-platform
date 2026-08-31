package cn.mathsea.backend.problem.dto;
import java.util.List;
public record ProblemQuery(
        String keyword,
        List<Integer> years,
        List<String> sources,
        List<String> types,
        List<String> levels,
        List<String> tags,
        String sort,
        int page,
        int pageSize
) {}
