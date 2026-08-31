package cn.mathsea.backend.practice.vo;
import java.time.OffsetDateTime;
public record PracticeListSummaryVO(
        String id, String title, String description, boolean isDefault,
        boolean isPublic, boolean isOfficial, boolean canEdit,
        PracticeListOwnerVO owner,
        OffsetDateTime createdAt, OffsetDateTime updatedAt,
        long problemCount, long completedCount
) {}
