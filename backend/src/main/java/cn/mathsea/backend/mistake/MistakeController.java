package cn.mathsea.backend.mistake;

import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.problem.mapper.ProblemMapper;
import cn.mathsea.backend.problem.service.ProblemService;
import cn.mathsea.backend.security.SecurityUtils;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/me/mistakes")
@RequiredArgsConstructor
public class MistakeController {
  private final JdbcTemplate db;
  private final ProblemMapper problems;
  private final ProblemService service;

  private Long problem(String number) {
    Long id = problems.findIdByProblemNumber(number);
    var p = id == null ? null : problems.selectById(id);
    if (p == null || Boolean.TRUE.equals(p.getDeleted()))
      throw BusinessException.notFound("PROBLEM_NOT_FOUND", "题目不存在或已下架");
    return id;
  }

  @GetMapping("/{number}")
  public Object state(@PathVariable String number, Authentication auth) {
    Long user = SecurityUtils.requireUserId(auth), id = problem(number);
    return Map.of(
        "included",
        db.queryForObject(
                "SELECT count(*) FROM user_mistakes WHERE user_id=? AND problem_id=?",
                Long.class,
                user,
                id)
            > 0);
  }

  @PutMapping("/{number}")
  @Transactional
  public void add(@PathVariable String number, Authentication auth) {
    Long user = SecurityUtils.requireUserId(auth), id = problem(number);
    db.update(
        "INSERT INTO user_mistakes(user_id,problem_id) VALUES (?,?) ON CONFLICT DO NOTHING",
        user,
        id);
  }

  @DeleteMapping("/{number}")
  @Transactional
  public void remove(@PathVariable String number, Authentication auth) {
    Long user = SecurityUtils.requireUserId(auth), id = problems.findIdByProblemNumber(number);
    if (id != null)
      db.update("DELETE FROM user_mistakes WHERE user_id=? AND problem_id=?", user, id);
  }

  @GetMapping
  public Object list(
      Authentication auth,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "1") int page) {
    Long user = SecurityUtils.requireUserId(auth);
    if (q.length() > 160) throw BusinessException.badRequest("SEARCH_TOO_LONG", "搜索内容最多160字");
    String where =
        " FROM user_mistakes m JOIN problems p ON p.id=m.problem_id WHERE m.user_id=? AND NOT"
            + " p.deleted AND (p.problem_number ILIKE ? OR p.title ILIKE ?)";
    String query = "%" + q.trim() + "%";
    long total = db.queryForObject("SELECT count(*)" + where, Long.class, user, query, query);
    int current = Math.max(1, Math.min(page, (int) Math.max(1, (total + 19) / 20)));
    var rows =
        db.queryForList(
            "SELECT m.problem_id,m.created_at"
                + where
                + " ORDER BY m.created_at DESC,m.problem_id DESC LIMIT 20 OFFSET ?",
            user,
            query,
            query,
            (current - 1) * 20);
    var summaries =
        service.summariesByInternalIds(
            rows.stream().map(row -> (Long) row.get("problem_id")).toList(), user);
    var items = new ArrayList<Map<String, Object>>();
    for (var row : rows) {
      var p = summaries.get((Long) row.get("problem_id"));
      if (p != null) items.add(Map.of("problem", p, "addedAt", row.get("created_at")));
    }
    return Map.of("items", items, "total", total, "page", current);
  }
}
