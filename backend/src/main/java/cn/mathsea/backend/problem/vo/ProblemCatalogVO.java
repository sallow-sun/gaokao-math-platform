package cn.mathsea.backend.problem.vo;
import java.util.List;
public record ProblemCatalogVO(
        List<Integer> years,
        List<SourceOption> sources,
        List<Option> types,
        List<Option> levels,
        List<TagOption> tags
) {
    public record SourceOption(String code, String label) {}
    public record Option(String code, String label) {}
    public record TagOption(String name) {}
}
