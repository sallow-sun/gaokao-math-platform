package cn.mathsea.backend.problem.controller;

import cn.mathsea.backend.problem.dto.ProblemStateBatchRequest;
import cn.mathsea.backend.problem.dto.ProblemStatePatchRequest;
import cn.mathsea.backend.problem.service.ProblemStateService;
import cn.mathsea.backend.problem.vo.ProblemStateBatchResponse;
import cn.mathsea.backend.problem.vo.ProblemStateVO;
import cn.mathsea.backend.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users/me/problem-states")
@RequiredArgsConstructor
public class ProblemStateController {
    private final ProblemStateService service;

    @PatchMapping("/{problemId}")
    public ProblemStateVO patch(@PathVariable String problemId,
                                @RequestBody ProblemStatePatchRequest request,
                                Authentication authentication) {
        return service.patch(SecurityUtils.requireUserId(authentication), problemId, request);
    }

    @PatchMapping("/batch")
    public ProblemStateBatchResponse batch(@Valid @RequestBody ProblemStateBatchRequest request,
                                           Authentication authentication) {
        return service.patchBatch(SecurityUtils.requireUserId(authentication), request);
    }
}
