package cn.mathsea.backend.documentimport;

import static org.junit.jupiter.api.Assertions.*;
import cn.mathsea.backend.admin.editorial.MarkdownQuestionParser;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class DocumentMarkdownContractTest {
  @Test void independentWorkerOutputIsAcceptedByUnmodifiedEditorialParser() throws Exception {
    // The Python suite asserts its real export equals this shared contract fixture.
    String markdown = Files.readString(Path.of("../document-worker/fixtures/expected.md"));
    var parsed = new MarkdownQuestionParser().parse(markdown, "2026年测试卷数学T1.md");
    assertEquals("1", parsed.number());
    assertEquals("fill-blank", parsed.document().type());
    assertEquals("$1+2=$____。", parsed.document().content());
    assertEquals("", parsed.document().answer());
    assertEquals("", parsed.document().solution());
    assertTrue(parsed.document().imageReferences().isEmpty());
    assertFalse(parsed.document().curriculum().confirmed());
    assertEquals("", parsed.document().level(), "Unknown difficulty must remain for human review");
  }
}
