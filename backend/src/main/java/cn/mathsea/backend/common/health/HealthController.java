package cn.mathsea.backend.common.health;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
@RequiredArgsConstructor
public class HealthController {
    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;

    @GetMapping
    public Map<String, Object> health() {
        Map<String, Object> result = new LinkedHashMap<>();
        boolean postgres = false, redis = false;
        try { postgres = Integer.valueOf(1).equals(jdbcTemplate.queryForObject("SELECT 1", Integer.class)); } catch (Exception ignored) {}
        try (var connection = redisTemplate.getConnectionFactory().getConnection()) { redis = connection.ping() != null; } catch (Exception ignored) {}
        result.put("status", postgres && redis ? "UP" : "DEGRADED");
        result.put("postgres", postgres ? "UP" : "DOWN");
        result.put("redis", redis ? "UP" : "DOWN");
        return result;
    }
}
