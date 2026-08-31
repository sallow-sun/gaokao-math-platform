package cn.mathsea.backend.common.rate;

import cn.mathsea.backend.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class RateLimitService {
    private final StringRedisTemplate redis;

    public void check(String bucket, String identity, int maxAttempts, Duration window) {
        String key = "mathsea:rate:" + bucket + ":" + sha256(identity);
        Long count = redis.opsForValue().increment(key);
        if (count != null && count == 1L) redis.expire(key, window);
        if (count != null && count > maxAttempts) {
            throw BusinessException.tooMany("RATE_LIMITED", "操作过于频繁，请稍后再试");
        }
    }

    public void clear(String bucket, String identity) {
        redis.delete("mathsea:rate:" + bucket + ":" + sha256(identity));
    }

    private String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
