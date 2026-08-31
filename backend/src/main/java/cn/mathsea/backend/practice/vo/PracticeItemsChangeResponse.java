package cn.mathsea.backend.practice.vo;
import java.util.List;
public record PracticeItemsChangeResponse(List<String> added, List<String> existing, List<String> notFound) {}
