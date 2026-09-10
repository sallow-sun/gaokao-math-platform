package cn.mathsea.backend.practice.service;

import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.practice.dto.*;
import cn.mathsea.backend.practice.entity.PracticeList;
import cn.mathsea.backend.practice.entity.PracticeListItem;
import cn.mathsea.backend.practice.mapper.PracticeListItemMapper;
import cn.mathsea.backend.practice.mapper.PracticeListMapper;
import cn.mathsea.backend.practice.vo.*;
import cn.mathsea.backend.problem.entity.Problem;
import cn.mathsea.backend.problem.mapper.ProblemMapper;
import cn.mathsea.backend.problem.service.ProblemService;
import cn.mathsea.backend.problem.vo.ProblemListVO;
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
public class PracticeListService {
    private final PracticeListMapper listMapper;
    private final PracticeListItemMapper itemMapper;
    private final ProblemMapper problemMapper;
    private final ProblemService problemService;
    private final UserMapper userMapper;

    public List<PracticeListSummaryVO> list(Long userId) {
        return listMapper.selectList(new LambdaQueryWrapper<PracticeList>()
                .eq(PracticeList::getUserId, userId)
                .orderByDesc(PracticeList::getDefaultList)
                .orderByDesc(PracticeList::getUpdatedAt)
                .orderByDesc(PracticeList::getId))
                .stream().map(l -> summary(l, userId)).toList();
    }

    public List<PracticeListSummaryVO> listPublic(String kind, Long viewerUserId) {
        LambdaQueryWrapper<PracticeList> query = new LambdaQueryWrapper<PracticeList>()
                .eq(PracticeList::getPublicList, true);
        if ("official".equals(kind)) query.eq(PracticeList::getOfficial, true);
        else if ("square".equals(kind)) query.eq(PracticeList::getOfficial, false);
        return listMapper.selectList(query
                        .orderByDesc(PracticeList::getOfficial)
                        .orderByDesc(PracticeList::getUpdatedAt)
                        .orderByDesc(PracticeList::getId))
                .stream().map(list -> summary(list, viewerUserId)).toList();
    }

    @Transactional
    public PracticeListSummaryVO create(Long userId, PracticeListCreateRequest request) {
        long defaultCount = listMapper.selectCount(new LambdaQueryWrapper<PracticeList>()
                .eq(PracticeList::getUserId, userId)
                .eq(PracticeList::getDefaultList, true));
        PracticeList list = new PracticeList();
        list.setPublicId(UUID.randomUUID());
        list.setUserId(userId);
        list.setTitle(request.title().trim());
        list.setDescription(request.description() == null ? "" : request.description().trim());
        list.setDefaultList(defaultCount == 0);
        boolean official = Boolean.TRUE.equals(request.isOfficial());
        if (official && !Objects.equals(userId, userMapper.firstUserId())) {
            throw BusinessException.forbidden("OFFICIAL_LIST_OWNER_REQUIRED", "只有首位用户可以创建官方题单");
        }
        list.setPublicList(official || request.isPublic() == null || request.isPublic());
        list.setOfficial(official);
        listMapper.insert(list);
        return summary(listMapper.selectById(list.getId()), userId);
    }

    public PracticeListDetailVO detail(Long userId, String listId) {
        PracticeList list = requireOwned(userId, listId);
        return detail(list, userId);
    }

    public PracticeListDetailVO publicDetail(Long viewerUserId, String listId) {
        PracticeList list = requireVisible(viewerUserId, listId);
        return detail(list, viewerUserId);
    }

    private PracticeListDetailVO detail(PracticeList list, Long viewerUserId) {
        List<PracticeListItem> items = itemMapper.selectList(new LambdaQueryWrapper<PracticeListItem>()
                .eq(PracticeListItem::getPracticeListId, list.getId())
                .orderByAsc(PracticeListItem::getPosition).orderByAsc(PracticeListItem::getId));
        List<Long> problemIds = items.stream().map(PracticeListItem::getProblemId).toList();
        Map<Long, ProblemListVO> summaries = problemService.summariesByInternalIds(problemIds, viewerUserId);
        boolean canEdit = Objects.equals(list.getUserId(), viewerUserId);
        List<PracticeListItemVO> itemVos = items.stream().map(i -> {
            ProblemListVO p = summaries.get(i.getProblemId());
            String number = p == null ? "UNKNOWN" : p.id();
            return new PracticeListItemVO(number, i.getPosition(), canEdit ? i.getNote() : "", i.getAddedAt(), i.getUpdatedAt(), p);
        }).toList();
        PracticeListSummaryVO s = summary(list, viewerUserId);
        return new PracticeListDetailVO(s.id(), s.title(), s.description(), s.isDefault(),
                s.isPublic(), s.isOfficial(), s.canEdit(), s.owner(), s.createdAt(), s.updatedAt(),
                s.problemCount(), s.completedCount(), itemVos);
    }

    @Transactional
    public PracticeListSummaryVO update(Long userId, String listId, PracticeListUpdateRequest request) {
        PracticeList list = requireOwned(userId, listId);
        if (request.title() != null) list.setTitle(request.title().trim());
        if (request.description() != null) list.setDescription(request.description().trim());
        if (request.isPublic() != null) {
            if (Boolean.TRUE.equals(list.getOfficial()) && !request.isPublic()) {
                throw BusinessException.badRequest("OFFICIAL_LIST_MUST_BE_PUBLIC", "官方题单必须保持公开");
            }
            list.setPublicList(request.isPublic());
        }
        listMapper.updateById(list);
        return summary(listMapper.selectById(list.getId()), userId);
    }

    @Transactional
    public void delete(Long userId, String listId) {
        PracticeList list = requireOwned(userId, listId);
        if (Boolean.TRUE.equals(list.getOfficial())) {
            throw BusinessException.badRequest("OFFICIAL_LIST_CANNOT_BE_DELETED", "官方题单不能删除，可以编辑其内容");
        }
        boolean wasDefault = Boolean.TRUE.equals(list.getDefaultList());
        listMapper.deleteById(list.getId());
        if (wasDefault) {
            PracticeList replacement = listMapper.selectOne(new LambdaQueryWrapper<PracticeList>()
                    .eq(PracticeList::getUserId, userId).orderByDesc(PracticeList::getUpdatedAt).last("LIMIT 1"));
            if (replacement != null) {
                replacement.setDefaultList(true);
                listMapper.updateById(replacement);
            }
        }
    }

    @Transactional
    public PracticeListSummaryVO setDefault(Long userId, String listId) {
        PracticeList list = requireOwned(userId, listId);
        listMapper.clearDefault(userId);
        list.setDefaultList(true);
        listMapper.updateById(list);
        return summary(listMapper.selectById(list.getId()), userId);
    }

    @Transactional
    public PracticeItemsChangeResponse addItems(Long userId, String listId, PracticeItemsRequest request) {
        PracticeList list = requireOwned(userId, listId);
        List<String> added = new ArrayList<>(), existing = new ArrayList<>(), notFound = new ArrayList<>();
        int position = itemMapper.maxPosition(list.getId()) + 1;
        for (String number : request.problemIds().stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).distinct().toList()) {
            Problem p = problemMapper.findByProblemNumber(number);
            if (p == null || Boolean.TRUE.equals(p.getDeleted())) { notFound.add(number); continue; }
            long exists = itemMapper.selectCount(new LambdaQueryWrapper<PracticeListItem>()
                    .eq(PracticeListItem::getPracticeListId, list.getId()).eq(PracticeListItem::getProblemId, p.getId()));
            if (exists > 0) { existing.add(number); continue; }
            PracticeListItem item = new PracticeListItem();
            item.setPracticeListId(list.getId());
            item.setProblemId(p.getId());
            item.setPosition(position++);
            item.setNote("");
            itemMapper.insert(item);
            added.add(number);
        }
        if (!added.isEmpty()) listMapper.touch(list.getId());
        return new PracticeItemsChangeResponse(added, existing, notFound);
    }

    @Transactional
    public void removeItem(Long userId, String listId, String problemNumber) {
        PracticeList list = requireOwned(userId, listId);
        Problem p = requireProblem(problemNumber);
        itemMapper.delete(new LambdaQueryWrapper<PracticeListItem>()
                .eq(PracticeListItem::getPracticeListId, list.getId()).eq(PracticeListItem::getProblemId, p.getId()));
        compactPositions(list.getId());
        listMapper.touch(list.getId());
    }

    @Transactional
    public void removeItems(Long userId, String listId, PracticeItemsRequest request) {
        PracticeList list = requireOwned(userId, listId);
        List<Long> ids = request.problemIds().stream().distinct().map(problemMapper::findIdByProblemNumber).filter(Objects::nonNull).toList();
        if (!ids.isEmpty()) itemMapper.delete(new LambdaQueryWrapper<PracticeListItem>()
                .eq(PracticeListItem::getPracticeListId, list.getId()).in(PracticeListItem::getProblemId, ids));
        compactPositions(list.getId());
        listMapper.touch(list.getId());
    }

    @Transactional
    public void reorder(Long userId, String listId, PracticeOrderRequest request) {
        PracticeList list = requireOwned(userId, listId);
        List<PracticeListItem> existing = itemMapper.selectList(new LambdaQueryWrapper<PracticeListItem>()
                .eq(PracticeListItem::getPracticeListId, list.getId()));
        if (existing.size() != request.problemIds().size()) throw BusinessException.badRequest("ORDER_MISMATCH", "排序列表必须包含题单中的全部题目且不能重复");
        Map<Long, PracticeListItem> byProblem = existing.stream().collect(Collectors.toMap(PracticeListItem::getProblemId, Function.identity()));
        Set<Long> seen = new HashSet<>();
        int pos = 0;
        for (String number : request.problemIds()) {
            Long pid = problemMapper.findIdByProblemNumber(number);
            if (pid == null || !byProblem.containsKey(pid) || !seen.add(pid)) throw BusinessException.badRequest("ORDER_MISMATCH", "排序列表与题单内容不一致");
            PracticeListItem item = byProblem.get(pid);
            item.setPosition(pos++);
            itemMapper.updateById(item);
        }
        listMapper.touch(list.getId());
    }

    @Transactional
    public PracticeListItemVO updateNote(Long userId, String listId, String problemNumber, PracticeNoteRequest request) {
        PracticeList list = requireOwned(userId, listId);
        Problem p = requireProblem(problemNumber);
        PracticeListItem item = itemMapper.selectOne(new LambdaQueryWrapper<PracticeListItem>()
                .eq(PracticeListItem::getPracticeListId, list.getId()).eq(PracticeListItem::getProblemId, p.getId()).last("LIMIT 1"));
        if (item == null) throw BusinessException.notFound("LIST_ITEM_NOT_FOUND", "题目不在该题单中");
        item.setNote(request.note() == null ? "" : request.note());
        itemMapper.updateById(item);
        listMapper.touch(list.getId());
        item = itemMapper.selectById(item.getId());
        ProblemListVO problem = problemService.summariesByInternalIds(List.of(p.getId()), userId).get(p.getId());
        return new PracticeListItemVO(problemNumber, item.getPosition(), item.getNote(), item.getAddedAt(), item.getUpdatedAt(), problem);
    }

    private void compactPositions(Long listId) {
        List<PracticeListItem> items = itemMapper.selectList(new LambdaQueryWrapper<PracticeListItem>()
                .eq(PracticeListItem::getPracticeListId, listId).orderByAsc(PracticeListItem::getPosition).orderByAsc(PracticeListItem::getId));
        for (int i=0;i<items.size();i++) {
            if (!Objects.equals(items.get(i).getPosition(), i)) { items.get(i).setPosition(i); itemMapper.updateById(items.get(i)); }
        }
    }

    private PracticeListSummaryVO summary(PracticeList list, Long userId) {
        UserAccount owner = userMapper.selectById(list.getUserId());
        PracticeListOwnerVO ownerVO = owner == null ? null : new PracticeListOwnerVO(
                owner.getPublicId().toString(), owner.getUid(), owner.getUsername(), owner.getAvatarUrl());
        boolean canEdit = Objects.equals(list.getUserId(), userId);
        long completedCount = userId == null ? 0 : itemMapper.countCompleted(list.getId(), userId);
        return new PracticeListSummaryVO(list.getPublicId().toString(), list.getTitle(), list.getDescription(),
                Boolean.TRUE.equals(list.getDefaultList()), Boolean.TRUE.equals(list.getPublicList()),
                Boolean.TRUE.equals(list.getOfficial()), canEdit, ownerVO, list.getCreatedAt(), list.getUpdatedAt(),
                itemMapper.countForList(list.getId()), completedCount);
    }

    private PracticeList requireOwned(Long userId, String publicId) {
        UUID id;
        try { id = UUID.fromString(publicId); } catch (Exception e) { throw BusinessException.notFound("PRACTICE_LIST_NOT_FOUND", "题单不存在"); }
        PracticeList list = listMapper.findOwned(id, userId);
        if (list == null) throw BusinessException.notFound("PRACTICE_LIST_NOT_FOUND", "题单不存在");
        return list;
    }

    private PracticeList requireVisible(Long viewerUserId, String publicId) {
        UUID id;
        try { id = UUID.fromString(publicId); }
        catch (Exception e) { throw BusinessException.notFound("PRACTICE_LIST_NOT_FOUND", "题单不存在"); }
        PracticeList list = listMapper.findByPublicId(id);
        if (list == null || (!Boolean.TRUE.equals(list.getPublicList()) && !Objects.equals(list.getUserId(), viewerUserId))) {
            throw BusinessException.notFound("PRACTICE_LIST_NOT_FOUND", "题单不存在或未公开");
        }
        return list;
    }

    private Problem requireProblem(String number) {
        Problem p = problemMapper.findByProblemNumber(number);
        if (p == null) throw BusinessException.notFound("PROBLEM_NOT_FOUND", "题目不存在");
        return p;
    }
}
