package cn.mathsea.backend.admin.editorial;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import org.junit.jupiter.api.Test;

class MarkdownQuestionParserTest {
  private final MarkdownQuestionParser parser = new MarkdownQuestionParser();

  @Test
  void acceptsRule12AndDoesNotLeakImageMetadataIntoContent() {
    var result =
        parser.parse(
            "---\n"
                + "id:2024全国甲卷T1\n"
                + "number：T1\n"
                + "year:2024\n"
                + "question_type:单选题\n"
                + "difficulty:D1\n"
                + "tags:集合,复数\n"
                + "---\n"
                + "content:\n"
                + "已知 $x=1$\n"
                + "img：{示意图.png}\n"
                + "answer:\n"
                + "A",
            "题目.md");
    assertEquals("red", result.document().level());
    assertEquals("1", result.number());
    assertEquals("已知 $x=1$", result.document().content());
    assertEquals("A", result.document().answer());
    assertEquals(java.util.List.of("示意图.png"), result.document().imageReferences());
  }

  @Test
  void allSevenLevelsFollowUserMapping() {
    for (int i = 1; i <= 7; i++)
      assertEquals(
          MarkdownQuestionParser.LEVELS.get(i - 1),
          parser.parse("---\ndifficulty:D" + i + "\n---\ncontent:\nx", "x.md").document().level());
  }

  @Test
  void corpusCompatibilityWhenLocalFixturesExist() throws Exception {
    Path root = Path.of("../TEST");
    if (!Files.isDirectory(root)) return;
    try (var files = Files.walk(root)) {
      for (Path p : files.filter(p -> p.toString().endsWith(".md")).toList()) {
        var result = parser.parse(Files.readString(p), p.getFileName().toString());
        assertFalse(result.document().content().isBlank(), p.toString());
        assertTrue(MarkdownQuestionParser.LEVELS.contains(result.document().level()), p.toString());
        assertFalse(result.document().content().matches("(?s).*\\nimg[:：].*"), p.toString());
      }
    }
  }

  @Test
  void downloadableRule13TemplateParsesAndAnswerImagesAreRecognized() throws Exception {
    Path template=Path.of("../frontend/public/docs/题目模板1.3.md");
    var parsed=parser.parse(Files.readString(template),template.getFileName().toString());
    assertEquals(java.util.List.of("A11","A42"),parsed.document().curriculum().chapters());
    assertEquals("PEP-A-2019",parsed.document().curriculum().version());
    assertFalse(parsed.document().curriculum().confirmed());
    assertFalse(parsed.document().answer().isBlank());
    assertEquals(java.util.List.of("答案图.png"),parser.parse("content:\n题干\nanswer:\n![答案](答案图.png)","x.md").document().imageReferences());
  }
}
