package cn.mathsea.backend.practice.controller;

import cn.mathsea.backend.auth.vo.SimpleMessage;
import cn.mathsea.backend.practice.dto.*;
import cn.mathsea.backend.practice.service.PracticeListService;
import cn.mathsea.backend.practice.vo.*;
import cn.mathsea.backend.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users/me/practice-lists")
@RequiredArgsConstructor
public class PracticeListController {
    private final PracticeListService service;

    @GetMapping
    public List<PracticeListSummaryVO> list(Authentication auth) { return service.list(SecurityUtils.requireUserId(auth)); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PracticeListSummaryVO create(@Valid @RequestBody PracticeListCreateRequest request, Authentication auth) {
        return service.create(SecurityUtils.requireUserId(auth), request);
    }

    @GetMapping("/{listId}")
    public PracticeListDetailVO detail(@PathVariable String listId, Authentication auth) {
        return service.detail(SecurityUtils.requireUserId(auth), listId);
    }

    @PatchMapping("/{listId}")
    public PracticeListSummaryVO update(@PathVariable String listId, @Valid @RequestBody PracticeListUpdateRequest request, Authentication auth) {
        return service.update(SecurityUtils.requireUserId(auth), listId, request);
    }

    @DeleteMapping("/{listId}")
    public SimpleMessage delete(@PathVariable String listId, Authentication auth) {
        service.delete(SecurityUtils.requireUserId(auth), listId); return new SimpleMessage("题单已删除");
    }

    @PutMapping("/{listId}/default")
    public PracticeListSummaryVO setDefault(@PathVariable String listId, Authentication auth) {
        return service.setDefault(SecurityUtils.requireUserId(auth), listId);
    }

    @PostMapping("/{listId}/items")
    public PracticeItemsChangeResponse addItems(@PathVariable String listId, @Valid @RequestBody PracticeItemsRequest request, Authentication auth) {
        return service.addItems(SecurityUtils.requireUserId(auth), listId, request);
    }

    @DeleteMapping("/{listId}/items/{problemId}")
    public SimpleMessage removeItem(@PathVariable String listId, @PathVariable String problemId, Authentication auth) {
        service.removeItem(SecurityUtils.requireUserId(auth), listId, problemId); return new SimpleMessage("已从题单移除");
    }

    @PostMapping("/{listId}/items/remove")
    public SimpleMessage removeItems(@PathVariable String listId, @Valid @RequestBody PracticeItemsRequest request, Authentication auth) {
        service.removeItems(SecurityUtils.requireUserId(auth), listId, request); return new SimpleMessage("批量移除完成");
    }

    @PutMapping("/{listId}/order")
    public SimpleMessage reorder(@PathVariable String listId, @Valid @RequestBody PracticeOrderRequest request, Authentication auth) {
        service.reorder(SecurityUtils.requireUserId(auth), listId, request); return new SimpleMessage("顺序已保存");
    }

    @PatchMapping("/{listId}/items/{problemId}")
    public PracticeListItemVO note(@PathVariable String listId, @PathVariable String problemId,
                                   @Valid @RequestBody PracticeNoteRequest request, Authentication auth) {
        return service.updateNote(SecurityUtils.requireUserId(auth), listId, problemId, request);
    }
}
