package cn.mathsea.backend.problem.controller;

import cn.mathsea.backend.common.api.PageResponse;
import cn.mathsea.backend.problem.dto.ProblemQuery;
import cn.mathsea.backend.problem.service.ProblemService;
import cn.mathsea.backend.problem.vo.*;
import cn.mathsea.backend.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ProblemController {
    private final ProblemService problemService;

    @GetMapping("/problems")
    public PageResponse<ProblemListVO> problems(
            @RequestParam(required=false) String keyword,
            @RequestParam(required=false, name="year") List<Integer> years,
            @RequestParam(required=false, name="source") List<String> sources,
            @RequestParam(required=false, name="type") List<String> types,
            @RequestParam(required=false, name="level") List<String> levels,
            @RequestParam(required=false, name="tag") List<String> tags,
            @RequestParam(defaultValue="newest") String sort,
            @RequestParam(defaultValue="1") int page,
            @RequestParam(defaultValue="20") int pageSize,
            Authentication authentication) {
        return problemService.query(new ProblemQuery(keyword, years, sources, types, levels, tags, sort, page, pageSize),
                SecurityUtils.userIdOrNull(authentication));
    }

    @GetMapping("/problems/random")
    public RandomProblemVO random() { return problemService.random(); }

    @GetMapping("/problems/{problemId}")
    public ProblemDetailVO detail(@PathVariable String problemId, Authentication authentication) {
        return problemService.detail(problemId, SecurityUtils.userIdOrNull(authentication));
    }

    @GetMapping("/problem-catalogs")
    public ProblemCatalogVO catalogs() { return problemService.catalog(); }

    @GetMapping("/problem-stats")
    public ProblemCollectionStatsVO stats() { return problemService.collectionStats(); }
}
