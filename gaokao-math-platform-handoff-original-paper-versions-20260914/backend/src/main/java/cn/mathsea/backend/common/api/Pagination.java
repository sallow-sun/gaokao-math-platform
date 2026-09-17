package cn.mathsea.backend.common.api;

public record Pagination(int page, int pageSize, long total, boolean hasNext) {}
