package cn.mathsea.backend.user.controller;

import cn.mathsea.backend.common.exception.BusinessException;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class UserProblemStatisticsController {
  private final JdbcTemplate db;
  private static final List<String> LEVELS =
      List.of(
          "red", "orange", "yellow", "green", "cyan", "blue", "purple", "black", "white",
          "unknown");
  private static final String LEVEL =
      "CASE WHEN lower(p.difficulty) IN"
          + " ('red','orange','yellow','green','cyan','blue','purple','black','white') THEN"
          + " lower(p.difficulty) ELSE 'unknown' END";

  @GetMapping("/api/v1/users/{userId}/problem-statistics")
  public Object statistics(
      @PathVariable Long userId,
      @RequestParam(defaultValue = "") String level,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "1") int page) {
    if (db.queryForObject("SELECT count(*) FROM users WHERE id=?", Long.class, userId) == 0)
      throw BusinessException.notFound("USER_NOT_FOUND", "用户不存在");
    if (q.length() > 160 || (!level.isBlank() && !LEVELS.contains(level)))
      throw BusinessException.badRequest("STATISTICS_FILTER", "筛选条件无效");
    String base =
        " FROM user_problem_states s JOIN problems p ON p.id=s.problem_id WHERE s.user_id=? AND"
            + " s.completed AND NOT p.deleted";
    var counts =
        db.queryForList(
            "SELECT " + LEVEL + " AS level,count(*) AS count" + base + " GROUP BY " + LEVEL,
            userId);
    List<Object> args = new ArrayList<>();
    args.add(userId);
    String where = base;
    if (!level.isBlank()) {
      where += " AND " + LEVEL + "=?";
      args.add(level);
    }
    if (!q.isBlank()) {
      where += " AND (p.problem_number ILIKE ? OR p.title ILIKE ?)";
      args.add("%" + q.trim() + "%");
      args.add("%" + q.trim() + "%");
    }
    long total = db.queryForObject("SELECT count(*)" + where, Long.class, args.toArray());
    int current = Math.max(1, Math.min(page, (int) Math.max(1, (total + 99) / 100)));
    args.add((current - 1) * 100);
    String order = "CASE " + LEVEL;
    for (int i = 0; i < LEVELS.size(); i++) order += " WHEN '" + LEVELS.get(i) + "' THEN " + i;
    order += " END,p.problem_number";
    return Map.of(
        "levels",
        counts,
        "total",
        total,
        "page",
        current,
        "pageSize",
        100,
        "items",
        db.queryForList(
            "SELECT p.problem_number AS id,p.title,"
                + LEVEL
                + " AS level"
                + where
                + " ORDER BY "
                + order
                + " LIMIT 100 OFFSET ?",
            args.toArray()));
  }
}
