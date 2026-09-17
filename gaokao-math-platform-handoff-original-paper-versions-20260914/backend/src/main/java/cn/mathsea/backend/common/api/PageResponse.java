package cn.mathsea.backend.common.api;

import java.util.List;

public record PageResponse<T>(List<T> items, Pagination pagination) {
    public static <T> PageResponse<T> of(List<T> items, int page, int pageSize, long total) {
        return new PageResponse<>(items, new Pagination(page, pageSize, total, (long) page * pageSize < total));
    }
}
