package cn.mathsea.backend.problem;

import cn.mathsea.backend.problem.model.DifficultyLevel;
import cn.mathsea.backend.problem.model.QuestionType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ProblemModelTest {
    @Test
    void difficultyOrderMatchesProductRule() {
        assertTrue(DifficultyLevel.WHITE.rank() < DifficultyLevel.GREEN.rank());
        assertTrue(DifficultyLevel.RED.rank() < DifficultyLevel.PURPLE.rank());
        assertTrue(DifficultyLevel.PURPLE.rank() < DifficultyLevel.BLACK.rank());
    }

    @Test
    void questionTypeCodesAreStable() {
        assertEquals("单选题", QuestionType.fromCode("single-choice").label());
        assertEquals("解答题", QuestionType.fromCode("solution").label());
        assertNull(QuestionType.fromCode("unknown"));
    }
}
