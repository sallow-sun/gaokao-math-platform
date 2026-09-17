package cn.mathsea.backend.ai.similarity;

import cn.mathsea.backend.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SimilarityEndpointPolicyTest {
    @Test
    void allowsSupportedOfficialEndpoints() {
        assertEquals("api.deepseek.com", SimilarityEndpointPolicy.requireAllowed(
                "https://api.deepseek.com/chat/completions").getHost());
        assertEquals("workspace.cn-beijing.maas.aliyuncs.com", SimilarityEndpointPolicy.requireAllowed(
                "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions").getHost());
    }

    @Test
    void rejectsArbitraryHostsAndNonTlsEndpoints() {
        assertThrows(BusinessException.class, () -> SimilarityEndpointPolicy.requireAllowed(
                "https://example.com/v1/chat/completions"));
        assertThrows(BusinessException.class, () -> SimilarityEndpointPolicy.requireAllowed(
                "http://api.deepseek.com/chat/completions"));
    }

    @Test
    void rejectsLookalikeDomainsAndWrongPaths() {
        assertThrows(BusinessException.class, () -> SimilarityEndpointPolicy.requireAllowed(
                "https://api.deepseek.com.evil.example/chat/completions"));
        assertThrows(BusinessException.class, () -> SimilarityEndpointPolicy.requireAllowed(
                "https://api.deepseek.com/models"));
    }
}
