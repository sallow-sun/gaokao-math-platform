package cn.mathsea.backend.problem.service;

import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.problem.dto.ProblemStateBatchRequest;
import cn.mathsea.backend.problem.dto.ProblemStatePatchRequest;
import cn.mathsea.backend.problem.entity.Problem;
import cn.mathsea.backend.problem.entity.UserProblemState;
import cn.mathsea.backend.problem.mapper.ProblemMapper;
import cn.mathsea.backend.problem.mapper.UserProblemStateMapper;
import cn.mathsea.backend.problem.vo.ProblemStateBatchResponse;
import cn.mathsea.backend.problem.vo.ProblemStateVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProblemStateService {
    private final ProblemMapper problemMapper;
    private final UserProblemStateMapper stateMapper;

    @Transactional
    public ProblemStateVO patch(Long userId, String problemNumber, ProblemStatePatchRequest request) {
        if (request.favorite() == null && request.completed() == null) {
            throw BusinessException.badRequest("NO_STATE_CHANGE", "favorite 和 completed 至少提供一个字段");
        }
        Problem problem = problemMapper.findByProblemNumber(problemNumber);
        if (problem == null) throw BusinessException.notFound("PROBLEM_NOT_FOUND", "题目不存在");
        return patchInternal(userId, problem, request.favorite(), request.completed());
    }

    @Transactional
    public ProblemStateBatchResponse patchBatch(Long userId, ProblemStateBatchRequest request) {
        if (request.favorite() == null && request.completed() == null) {
            throw BusinessException.badRequest("NO_STATE_CHANGE", "favorite 和 completed 至少提供一个字段");
        }
        List<ProblemStateVO> items = new ArrayList<>();
        for (String number : request.problemIds().stream().distinct().toList()) {
            Problem p = problemMapper.findByProblemNumber(number);
            if (p == null) throw BusinessException.notFound("PROBLEM_NOT_FOUND", "题目不存在：" + number);
            items.add(patchInternal(userId, p, request.favorite(), request.completed()));
        }
        return new ProblemStateBatchResponse(items);
    }

    private ProblemStateVO patchInternal(Long userId, Problem problem, Boolean favoritePatch, Boolean completedPatch) {
        UserProblemState old = stateMapper.find(userId, problem.getId());
        boolean oldFavorite = old != null && Boolean.TRUE.equals(old.getFavorite());
        boolean favorite = favoritePatch == null ? oldFavorite : favoritePatch;
        boolean completed = completedPatch == null ? old != null && Boolean.TRUE.equals(old.getCompleted()) : completedPatch;
        stateMapper.upsert(userId, problem.getId(), favorite, completed);
        return new ProblemStateVO(problem.getProblemNumber(), favorite, completed);
    }
}
