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
    int pageSize,
    boolean learning,
    List<String> learned,
    List<String> chapters) {
  public ProblemQuery(
      String keyword,
      List<Integer> years,
      List<String> sources,
      List<String> types,
      List<String> levels,
      List<String> tags,
      String sort,
      int page,
      int pageSize) {
    this(
        keyword, years, sources, types, levels, tags, sort, page, pageSize, false, List.of(),
        List.of());
  }
}
