package cn.mathsea.backend.admin.service;

import cn.mathsea.backend.admin.entity.AuditLog;
import cn.mathsea.backend.admin.mapper.AuditLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditLogService {
    private final AuditLogMapper auditLogMapper;

    public void log(Long actorUserId, String action, String targetType, String targetId, String details) {
        AuditLog log = new AuditLog();
        log.setActorUserId(actorUserId);
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setDetails(details);
        auditLogMapper.insert(log);
    }
}
