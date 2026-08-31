package cn.mathsea.backend.problem.model;

import java.util.Arrays;

public enum QuestionType {
    SINGLE_CHOICE("single-choice", "单选题"),
    MULTIPLE_CHOICE("multiple-choice", "多选题"),
    FILL_BLANK("fill-blank", "填空题"),
    SOLUTION("solution", "解答题");

    private final String code;
    private final String label;

    QuestionType(String code, String label) { this.code = code; this.label = label; }
    public String code() { return code; }
    public String label() { return label; }

    public static QuestionType fromCode(String code) {
        return Arrays.stream(values()).filter(v -> v.code.equals(code)).findFirst().orElse(null);
    }
}
