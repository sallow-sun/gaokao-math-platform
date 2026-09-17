package cn.mathsea.backend.practice.controller;

import cn.mathsea.backend.practice.service.PracticeListService;
import cn.mathsea.backend.practice.vo.PracticeListDetailVO;
import cn.mathsea.backend.practice.vo.PracticeListSummaryVO;
import cn.mathsea.backend.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/practice-lists")
@RequiredArgsConstructor
public class PublicPracticeListController {
    private final PracticeListService service;

    @GetMapping
    public List<PracticeListSummaryVO> list(
            @RequestParam(defaultValue = "all") String kind,
            Authentication authentication) {
        return service.listPublic(kind, SecurityUtils.userIdOrNull(authentication));
    }

    @GetMapping("/{listId}")
    public PracticeListDetailVO detail(@PathVariable String listId, Authentication authentication) {
        return service.publicDetail(SecurityUtils.userIdOrNull(authentication), listId);
    }
}
