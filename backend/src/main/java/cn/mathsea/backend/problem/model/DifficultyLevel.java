package cn.mathsea.backend.problem.model;

import java.util.Arrays;

public enum DifficultyLevel {
    RED("red", "D1 · RED", 1),
    ORANGE("orange", "D2 · ORANGE", 2),
    YELLOW("yellow", "D3 · YELLOW", 3),
    GREEN("green", "D4 · GREEN", 4),
    CYAN("cyan", "D5 · CYAN", 5),
    BLUE("blue", "D6 · BLUE", 6),
    PURPLE("purple", "D7 · PURPLE", 7),
    BLACK("black", "BLACK（保留）", 8),
    WHITE("white", "WHITE（保留）", 9);

    private final String code;
    private final String label;
    private final int rank;

    DifficultyLevel(String code, String label, int rank) {
        this.code = code; this.label = label; this.rank = rank;
    }
    public String code() { return code; }
    public String label() { return label; }
    public int rank() { return rank; }

    public static DifficultyLevel fromCode(String code) {
        return Arrays.stream(values()).filter(v -> v.code.equals(code)).findFirst().orElse(null);
    }
}
