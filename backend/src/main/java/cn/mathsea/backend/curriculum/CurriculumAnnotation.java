package cn.mathsea.backend.curriculum;

import java.util.List;

public record CurriculumAnnotation(String version, List<String> chapters, boolean confirmed) {
  public static final String VERSION = "PEP-A-2019";

  public static CurriculumAnnotation unknown() {
    return new CurriculumAnnotation(VERSION, List.of(), false);
  }
}
