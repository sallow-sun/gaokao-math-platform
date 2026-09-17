package cn.mathsea.backend.ai.similarity;

import cn.mathsea.backend.common.exception.BusinessException;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

final class SimilarityEndpointPolicy {
    private static final Set<String> EXACT_HOSTS = Set.of(
            "api.openai.com",
            "api.deepseek.com",
            "dashscope.aliyuncs.com",
            "dashscope-intl.aliyuncs.com"
    );

    private SimilarityEndpointPolicy() {}

    static URI requireAllowed(String rawEndpoint) {
        final URI endpoint;
        try {
            endpoint = URI.create(rawEndpoint.trim());
        } catch (RuntimeException ex) {
            throw BusinessException.badRequest("AI_ENDPOINT_INVALID", "API 地址格式不正确");
        }

        String host = endpoint.getHost() == null ? "" : endpoint.getHost().toLowerCase(Locale.ROOT);
        boolean allowedHost = EXACT_HOSTS.contains(host) || host.endsWith(".maas.aliyuncs.com");
        boolean allowedPort = endpoint.getPort() == -1 || endpoint.getPort() == 443;
        boolean allowedPath = endpoint.getPath() != null && endpoint.getPath().endsWith("/chat/completions");

        if (!"https".equalsIgnoreCase(endpoint.getScheme())
                || endpoint.getUserInfo() != null
                || endpoint.getFragment() != null
                || !allowedHost
                || !allowedPort
                || !allowedPath) {
            throw BusinessException.badRequest(
                    "AI_ENDPOINT_NOT_ALLOWED",
                    "模型代理仅允许 OpenAI、DeepSeek 和阿里云百炼的官方 HTTPS Chat Completions 地址"
            );
        }
        return endpoint;
    }
}
