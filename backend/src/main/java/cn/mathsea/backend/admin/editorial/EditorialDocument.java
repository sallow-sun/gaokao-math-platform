package cn.mathsea.backend.admin.editorial;

import cn.mathsea.backend.curriculum.CurriculumAnnotation;
import java.util.List;
import java.util.Map;

public record EditorialDocument(
    String title,
    Integer year,
    String source,
    String type,
    String level,
    List<String> tags,
    String content,
    String answer,
    String solution,
    List<Asset> assets,
    List<String> imageReferences,
    Map<String, String> originalMetadata,
    List<String> warnings,
    CurriculumAnnotation curriculum) {
  public EditorialDocument {
    if (curriculum == null) curriculum = CurriculumAnnotation.unknown();
  }

  public EditorialDocument(
      String title,
      Integer year,
      String source,
      String type,
      String level,
      List<String> tags,
      String content,
      String answer,
      String solution,
      List<Asset> assets,
      List<String> imageReferences,
      Map<String, String> originalMetadata,
      List<String> warnings) {
    this(
        title,
        year,
        source,
        type,
        level,
        tags,
        content,
        answer,
        solution,
        assets,
        imageReferences,
        originalMetadata,
        warnings,
        CurriculumAnnotation.unknown());
  }

  public record Asset(String id, String url, String mimeType, String altText, String section) {}
}
