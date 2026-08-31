package cn.mathsea.backend.user.vo;

import java.time.OffsetDateTime;

public record UserActivityVO(String type, String problemId, String title, OffsetDateTime occurredAt) {}
