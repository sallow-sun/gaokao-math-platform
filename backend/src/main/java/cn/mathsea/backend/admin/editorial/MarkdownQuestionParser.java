package cn.mathsea.backend.admin.editorial;

import cn.mathsea.backend.common.exception.BusinessException;
import java.util.*;
import java.util.regex.*;
import org.springframework.stereotype.Component;

/** Rule 1.2 compatibility. Normalize structural markers only, never LaTeX punctuation. */
@Component
public class MarkdownQuestionParser {
  public static final List<String> LEVELS =
      List.of("red", "orange", "yellow", "green", "cyan", "blue", "purple");
  private static final Pattern FIELD = Pattern.compile("^([\\w]+)\\s*[:：]\\s*(.*)$");
  private static final Pattern SECTION =
      Pattern.compile("(?i)^(content|answer|solution|img)\\s*[:：]\\s*(.*)$");

  public record Parsed(String originalId, String number, EditorialDocument document) {}

  public Parsed parse(String raw, String filename) {
    String text = raw.replace("\uFEFF", "").replace("\r\n", "\n").replace('\r', '\n');
    String[] lines = text.split("\n", -1);
    Map<String, String> meta = new LinkedHashMap<>();
    int index = 0;
    while (index < lines.length && lines[index].isBlank()) index++;
    if (index < lines.length && lines[index].trim().equals("---")) {
      boolean closed = false;
      for (index++; index < lines.length; index++) {
        if (lines[index].trim().equals("---")) {
          index++;
          closed = true;
          break;
        }
        Matcher m = FIELD.matcher(lines[index].trim());
        if (m.matches()) meta.put(m.group(1).toLowerCase(Locale.ROOT), m.group(2).trim());
      }
      if (!closed) throw BusinessException.badRequest("MARKDOWN_HEADER", "元数据缺少结束行 ---");
    }
    Map<String, StringBuilder> sections = new LinkedHashMap<>();
    String section = "content";
    for (; index < lines.length; index++) {
      String line = lines[index];
      Matcher m = SECTION.matcher(line);
      String heading = line.trim().replaceFirst("^#{1,6}\\s+", "");
      if (m.matches()) {
        section = m.group(1).toLowerCase(Locale.ROOT);
        line = m.group(2);
      } else if (line.trim().startsWith("#")
          && List.of("题目", "题干", "答案", "解析", "题解").contains(heading)) {
        section =
            switch (heading) {
              case "答案" -> "answer";
              case "解析", "题解" -> "solution";
              default -> "content";
            };
        line = "";
      }
      sections.computeIfAbsent(section, k -> new StringBuilder()).append(line).append('\n');
    }
    String content = value(sections, "content");
    if (content.isBlank())
      throw BusinessException.badRequest("MARKDOWN_CONTENT_REQUIRED", "缺少题干 content");
    Integer year = null;
    try {
      if (!meta.getOrDefault("year", "").isBlank()) year = Integer.valueOf(meta.get("year"));
    } catch (NumberFormatException e) {
      throw BusinessException.badRequest("MARKDOWN_YEAR", "年份应为四位数字");
    }
    String type =
        switch (meta.getOrDefault("question_type", "")) {
          case "单选题", "单项选择题", "single-choice" -> "single-choice";
          case "多选题", "多项选择题", "multiple-choice" -> "multiple-choice";
          case "填空题", "fill-blank" -> "fill-blank";
          case "解答题", "solution" -> "solution";
          default -> "";
        };
    String difficulty = meta.getOrDefault("difficulty", "").trim().toUpperCase(Locale.ROOT);
    String level =
        difficulty.matches("D[1-7]")
            ? LEVELS.get(difficulty.charAt(1) - '1')
            : difficulty.toLowerCase(Locale.ROOT);
    List<String> warnings = new ArrayList<>();
    if (type.isBlank()) warnings.add("请选择题型");
    if (!LEVELS.contains(level)) warnings.add("请选择 D1～D7 难度");
    List<String> images = new ArrayList<>();
    Matcher image = Pattern.compile("\\{([^}]+)}").matcher(value(sections, "img"));
    while (image.find()) images.add(image.group(1).trim());
    String img = value(sections, "img");
    if (images.isEmpty() && !img.isBlank() && !img.equals("0")) images.add(img);
    Matcher inline =
        Pattern.compile("!\\[[^]\\n]*]\\(([^)\\n]+)\\)")
            .matcher(
                content + "\n" + value(sections, "answer") + "\n" + value(sections, "solution"));
    while (inline.find()) {
      String path = inline.group(1).trim();
      if (!images.contains(path)) images.add(path);
    }
    List<String> tags =
        Arrays.stream(meta.getOrDefault("tags", "").split("[,，]"))
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .distinct()
            .toList();
    String id = meta.getOrDefault("id", filename.replaceFirst("(?i)\\.md$", ""));
    String number =
        meta.getOrDefault("number", "0")
            .trim()
            .toUpperCase(Locale.ROOT)
            .replaceFirst("^T(?=\\d+$)", "");
    return new Parsed(
        id,
        number,
        new EditorialDocument(
            meta.getOrDefault("title", id),
            year,
            meta.getOrDefault("source", ""),
            type,
            level,
            tags,
            content,
            value(sections, "answer"),
            value(sections, "solution"),
            List.of(),
            images,
            meta,
            warnings,
            new cn.mathsea.backend.curriculum.CurriculumAnnotation(
                meta.getOrDefault(
                    "curriculum", cn.mathsea.backend.curriculum.CurriculumAnnotation.VERSION),
                Arrays.stream(meta.getOrDefault("chapters", "").split("[,，]"))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .map(s -> s.toUpperCase(Locale.ROOT))
                    .distinct()
                    .toList(),
                false)));
  }

  private String value(Map<String, StringBuilder> sections, String name) {
    return sections.getOrDefault(name, new StringBuilder()).toString().trim();
  }
}
