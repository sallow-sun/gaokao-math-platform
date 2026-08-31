package cn.mathsea.backend.problem.model;

import java.util.Arrays;

public enum DifficultyLevel {
    WHITE("white", "WHITE", 1),
    GREEN("green", "GREEN", 2),
    CYAN("cyan", "CYAN", 3),
    BLUE("blue", "BLUE", 4),
    YELLOW("yellow", "YELLOW", 5),
    ORANGE("orange", "ORANGE", 6),
    RED("red", "RED", 7),
    PURPLE("purple", "PURPLE", 8),
    BLACK("black", "BLACK", 9);

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
