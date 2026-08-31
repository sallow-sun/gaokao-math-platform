package cn.mathsea.backend.problem.service;

import cn.mathsea.backend.common.api.PageResponse;
import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.practice.mapper.PracticeListItemMapper;
import cn.mathsea.backend.problem.dto.ProblemQuery;
import cn.mathsea.backend.problem.entity.*;
import cn.mathsea.backend.problem.mapper.*;
import cn.mathsea.backend.problem.mapper.row.ProblemSummaryRow;
import cn.mathsea.backend.problem.mapper.row.ProblemTagNameRow;
import cn.mathsea.backend.problem.model.DifficultyLevel;
import cn.mathsea.backend.problem.model.QuestionType;
import cn.mathsea.backend.problem.vo.*;
import cn.mathsea.backend.user.entity.UserAccount;
import cn.mathsea.backend.user.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProblemService {
    private static final Set<String> SORTS = Set.of("newest", "oldest", "easy-first", "hard-first", "view-most", "star-most");

    private final ProblemMapper problemMapper;
    private final ProblemSourceMapper sourceMapper;
    private final TagMapper tagMapper;
    private final ProblemTagMapper problemTagMapper;
    private final UserProblemStateMapper stateMapper;
    private final PracticeListItemMapper practiceItemMapper;
    private final ProblemAssetMapper assetMapper;
    private final UserMapper userMapper;

    public PageResponse<ProblemListVO> query(ProblemQuery q, Long viewerUserId) {
        int page = Math.max(1, q.page());
        int pageSize = Math.max(1, Math.min(q.pageSize() <= 0 ? 20 : q.pageSize(), 100));
        String sort = q.sort() != null && SORTS.contains(q.sort()) ? q.sort() : "newest";
        List<String> tags = cleanStrings(q.tags());
        List<String> types = cleanStrings(q.types());
        List<String> levels = cleanStrings(q.levels());
        validateCodes(types, levels);

        long total = problemMapper.countFiltered(
                clean(q.keyword()), q.years(), cleanStrings(q.sources()), types, levels, tags, tags.size());
        List<ProblemSummaryRow> rows = problemMapper.selectFiltered(
                clean(q.keyword()), q.years(), cleanStrings(q.sources()), types, levels, tags, tags.size(),
                sort, pageSize, (page - 1) * pageSize);
        List<ProblemListVO> items = buildList(rows, viewerUserId);
        return PageResponse.of(items, page, pageSize, total);
    }

    @Transactional
    public ProblemDetailVO detail(String problemNumber, Long viewerUserId) {
        Problem p = problemMapper.findByProblemNumber(problemNumber);
        if (p == null) throw BusinessException.notFound("PROBLEM_NOT_FOUND", "题目不存在");
        problemMapper.incrementViewCount(p.getId());
        p.setViewCount((p.getViewCount() == null ? 0 : p.getViewCount()) + 1);

        ProblemSource source = p.getSourceCode() == null ? null : sourceMapper.selectById(p.getSourceCode());
        String sourceLabel = source == null ? p.getSourceCode() : source.getLabel();
        List<String> tags = problemTagMapper.selectNamesByProblemId(p.getId());
        ViewerStateVO viewerState = viewerState(viewerUserId, p.getId());
        UploaderVO uploader = null;
        if (p.getCreatorUserId() != null) {
            UserAccount u = userMapper.selectById(p.getCreatorUserId());
            if (u != null) uploader = new UploaderVO(u.getPublicId().toString(), u.getUid(), u.getUsername(), u.getAvatarUrl());
        }
        List<ProblemAssetVO> assets = assetMapper.findByProblemId(p.getId()).stream()
                .map(a -> new ProblemAssetVO(a.getId().toString(), a.getUrl(), a.getMimeType(), a.getAltText(), Optional.ofNullable(a.getSortOrder()).orElse(0)))
                .toList();
        QuestionType type = QuestionType.fromCode(p.getQuestionType());
        return new ProblemDetailVO(
                p.getProblemNumber(), title(p.getProblemNumber(), p.getTitle()), p.getRegion(), p.getYear(), p.getRegion(),
                p.getSourceCode(), sourceLabel, p.getQuestionType(), type == null ? p.getQuestionType() : type.label(),
                p.getDifficulty(), tags, sourceText(p.getYear(), sourceLabel, p.getRegion()), p.getContent(), p.getAnswer(),
                p.getSolution(), Optional.ofNullable(p.getContentFormat()).orElse("markdown-latex-v1"),
                new ProblemStatsVO(Optional.ofNullable(p.getViewCount()).orElse(0L), Optional.ofNullable(p.getFavoriteCount()).orElse(0L)),
                viewerState, uploader, assets, p.getCreatedAt(), p.getUpdatedAt());
    }

    public ProblemCatalogVO catalog() {
        List<ProblemSource> sources = sourceMapper.selectList(new LambdaQueryWrapper<ProblemSource>()
                .eq(ProblemSource::getActive, true).orderByAsc(ProblemSource::getSortOrder).orderByAsc(ProblemSource::getCode));
        List<Tag> tags = tagMapper.selectList(new LambdaQueryWrapper<Tag>()
                .eq(Tag::getActive, true).orderByAsc(Tag::getSortOrder).orderByAsc(Tag::getId));
        return new ProblemCatalogVO(
                problemMapper.distinctYears(),
                sources.stream().map(s -> new ProblemCatalogVO.SourceOption(s.getCode(), s.getLabel())).toList(),
                Arrays.stream(QuestionType.values()).map(t -> new ProblemCatalogVO.Option(t.code(), t.label())).toList(),
                Arrays.stream(DifficultyLevel.values()).sorted(Comparator.comparingInt(DifficultyLevel::rank))
                        .map(d -> new ProblemCatalogVO.Option(d.code(), d.label())).toList(),
                tags.stream().map(t -> new ProblemCatalogVO.TagOption(t.getName())).toList());
    }

    public ProblemCollectionStatsVO collectionStats() {
        return new ProblemCollectionStatsVO(problemMapper.selectCount(null), problemMapper.countDistinctYears(),
                tagMapper.selectCount(new LambdaQueryWrapper<Tag>().eq(Tag::getActive, true)));
    }

    public RandomProblemVO random() {
        String id = problemMapper.randomProblemNumber();
        if (id == null) throw BusinessException.notFound("NO_PROBLEM", "题库暂时没有题目");
        return new RandomProblemVO(id);
    }

    public Map<Long, ProblemListVO> summariesByInternalIds(List<Long> ids, Long viewerUserId) {
        if (ids == null || ids.isEmpty()) return Map.of();
        List<ProblemSummaryRow> rows = problemMapper.selectSummariesByIds(ids);
        Map<String, String> sourceLabels = sourceMapper.selectList(null).stream()
                .collect(Collectors.toMap(ProblemSource::getCode, ProblemSource::getLabel, (a,b)->a));
        rows.forEach(r -> r.setSourceLabel(sourceLabels.get(r.getSourceCode())));
        List<ProblemListVO> vos = buildList(rows, viewerUserId);
        Map<String, Long> byNumber = rows.stream().collect(Collectors.toMap(ProblemSummaryRow::getProblemNumber, ProblemSummaryRow::getId));
        Map<Long, ProblemListVO> result = new LinkedHashMap<>();
        for (ProblemListVO vo : vos) result.put(byNumber.get(vo.id()), vo);
        return result;
    }

    private List<ProblemListVO> buildList(List<ProblemSummaryRow> rows, Long viewerUserId) {
        if (rows.isEmpty()) return List.of();
        List<Long> ids = rows.stream().map(ProblemSummaryRow::getId).toList();
        Map<Long, List<String>> tags = new HashMap<>();
        for (ProblemTagNameRow row : problemTagMapper.selectNamesByProblemIds(ids)) {
            tags.computeIfAbsent(row.getProblemId(), k -> new ArrayList<>()).add(row.getTagName());
        }

        Map<Long, UserProblemState> states = new HashMap<>();
        Set<Long> inLists = new HashSet<>();
        if (viewerUserId != null) {
            for (UserProblemState state : stateMapper.findMany(viewerUserId, ids)) states.put(state.getProblemId(), state);
            inLists.addAll(practiceItemMapper.problemIdsInAnyList(viewerUserId, ids));
        }

        List<ProblemListVO> result = new ArrayList<>();
        for (ProblemSummaryRow r : rows) {
            QuestionType type = QuestionType.fromCode(r.getQuestionType());
            ViewerStateVO vs = null;
            if (viewerUserId != null) {
                UserProblemState s = states.get(r.getId());
                vs = new ViewerStateVO(s != null && Boolean.TRUE.equals(s.getFavorite()),
                        s != null && Boolean.TRUE.equals(s.getCompleted()), inLists.contains(r.getId()));
            }
            String sourceLabel = r.getSourceLabel() == null ? r.getSourceCode() : r.getSourceLabel();
            result.add(new ProblemListVO(
                    r.getProblemNumber(), title(r.getProblemNumber(), r.getTitle()), r.getRegion(), r.getYear(),
                    r.getSourceCode(), sourceLabel, r.getQuestionType(), type == null ? r.getQuestionType() : type.label(),
                    r.getDifficulty(), tags.getOrDefault(r.getId(), List.of()), sourceText(r.getYear(), sourceLabel, r.getRegion()),
                    r.getContent(), Optional.ofNullable(r.getContentFormat()).orElse("markdown-latex-v1"),
                    new ProblemStatsVO(Optional.ofNullable(r.getViewCount()).orElse(0L), Optional.ofNullable(r.getFavoriteCount()).orElse(0L)), vs));
        }
        return result;
    }

    private ViewerStateVO viewerState(Long userId, Long problemId) {
        if (userId == null) return null;
        UserProblemState s = stateMapper.find(userId, problemId);
        boolean inList = practiceItemMapper.existsForUserProblem(userId, problemId);
        return new ViewerStateVO(s != null && Boolean.TRUE.equals(s.getFavorite()), s != null && Boolean.TRUE.equals(s.getCompleted()), inList);
    }

    private void validateCodes(List<String> types, List<String> levels) {
        if (types.stream().anyMatch(v -> QuestionType.fromCode(v) == null)) throw BusinessException.badRequest("INVALID_TYPE", "存在不合法的题型");
        if (levels.stream().anyMatch(v -> DifficultyLevel.fromCode(v) == null)) throw BusinessException.badRequest("INVALID_LEVEL", "存在不合法的训练价值");
    }

    private List<String> cleanStrings(List<String> list) {
        if (list == null) return List.of();
        return list.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
    }
    private String clean(String v) { return v == null ? null : v.trim(); }
    private String title(String number, String title) { return title == null || title.isBlank() ? number : title; }
    private String sourceText(Integer year, String sourceLabel, String region) {
        return java.util.stream.Stream.of(year == null ? null : year.toString(), sourceLabel, region)
                .filter(Objects::nonNull).filter(s -> !s.isBlank()).collect(Collectors.joining(" · "));
    }
}
