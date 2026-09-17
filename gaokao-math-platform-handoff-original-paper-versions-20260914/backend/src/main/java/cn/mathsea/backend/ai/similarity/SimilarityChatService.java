package cn.mathsea.backend.ai.similarity;

import cn.mathsea.backend.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class SimilarityChatService {
    private static final int MAX_TEXT_CONTENT_LENGTH = 30_000;
    private static final int MAX_IMAGE_DATA_URL_LENGTH = 3_000_000;
    private final ObjectMapper objectMapper;

    public SimilarityChatResponse relay(SimilarityChatRequest request) {
        long startedAt = System.nanoTime();
        URI endpoint = SimilarityEndpointPolicy.requireAllowed(request.endpoint());
        validateMessages(request);
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", request.model().trim());
        body.put("temperature", 0);
        body.put("max_tokens", request.maxTokens());
        body.set("messages", objectMapper.valueToTree(request.messages()));
        if (request.jsonMode()) {
            body.set("response_format", objectMapper.createObjectNode().put("type", "json_object"));
        }
        if (request.lowLatency() && "api.deepseek.com".equalsIgnoreCase(endpoint.getHost())) {
            body.set("thinking", objectMapper.createObjectNode().put("type", "disabled"));
        } else if (request.lowLatency() && isAliyunEndpoint(endpoint)) {
            body.put("reasoning_effort", "minimal");
        }

        HttpRequest upstream = HttpRequest.newBuilder(endpoint)
                .timeout(Duration.ofSeconds(request.timeoutSeconds()))
                .header("Authorization", "Bearer " + request.apiKey().trim())
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();

        try {
            HttpResponse<String> response = HttpClientHolder.CLIENT.send(upstream, HttpResponse.BodyHandlers.ofString());
            JsonNode responseBody = parseResponseBody(response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String message = responseBody.path("error").path("message").asText();
                if (message.isBlank()) message = "模型服务请求失败（HTTP " + response.statusCode() + "）";
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_UPSTREAM_ERROR", limit(message, 300));
            }

            String content = responseBody.path("choices").path(0).path("message").path("content").asText();
            if (content.isBlank()) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_RESPONSE_INVALID", "模型服务未返回有效文本内容");
            }
            JsonNode usageNode = responseBody.path("usage");
            long promptTokens = usageNode.path("prompt_tokens").asLong(usageNode.path("input_tokens").asLong(0));
            long completionTokens = usageNode.path("completion_tokens").asLong(usageNode.path("output_tokens").asLong(0));
            long totalTokens = usageNode.path("total_tokens").asLong(promptTokens + completionTokens);
            SimilarityChatResponse.Usage usage = usageNode.isMissingNode() || usageNode.isNull()
                    ? null
                    : new SimilarityChatResponse.Usage(promptTokens, completionTokens, totalTokens);
            String providerRequestId = response.headers().firstValue("x-request-id")
                    .or(() -> response.headers().firstValue("x-dashscope-request-id"))
                    .or(() -> response.headers().firstValue("request-id"))
                    .orElse("");
            long elapsedMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
            return new SimilarityChatResponse(
                    content,
                    responseBody.path("model").asText(request.model()),
                    usage,
                    providerRequestId,
                    elapsedMs
            );
        } catch (java.net.http.HttpTimeoutException ex) {
            throw new BusinessException(HttpStatus.GATEWAY_TIMEOUT, "AI_UPSTREAM_TIMEOUT", "模型服务响应超时");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_PROXY_INTERRUPTED", "模型代理请求已中断");
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_UPSTREAM_UNREACHABLE", "MathSea 后端无法连接模型服务");
        }
    }

    private JsonNode parseResponseBody(String rawBody) {
        try {
            return objectMapper.readTree(rawBody);
        } catch (Exception ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_RESPONSE_INVALID", "模型服务返回了无法解析的内容");
        }
    }

    private String limit(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private void validateMessages(SimilarityChatRequest request) {
        for (SimilarityChatRequest.ChatMessage message : request.messages()) {
            JsonNode content = message.content();
            if (content.isTextual()) {
                requireValidText(content.asText());
                continue;
            }
            if (!"user".equals(message.role()) || !content.isArray() || content.isEmpty() || content.size() > 4) {
                throw invalidMultimodalContent();
            }
            for (JsonNode part : content) {
                String type = part.path("type").asText();
                if ("text".equals(type)) {
                    requireValidText(part.path("text").asText());
                } else if ("image_url".equals(type)) {
                    requireValidImage(part.path("image_url").path("url").asText());
                } else {
                    throw invalidMultimodalContent();
                }
            }
        }
    }

    private void requireValidText(String text) {
        if (text.isBlank() || text.length() > MAX_TEXT_CONTENT_LENGTH) {
            throw invalidMultimodalContent();
        }
    }

    private void requireValidImage(String dataUrl) {
        boolean supportedType = dataUrl.startsWith("data:image/jpeg;base64,")
                || dataUrl.startsWith("data:image/png;base64,")
                || dataUrl.startsWith("data:image/webp;base64,");
        if (!supportedType || dataUrl.length() > MAX_IMAGE_DATA_URL_LENGTH) {
            throw invalidMultimodalContent();
        }
    }

    private BusinessException invalidMultimodalContent() {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "AI_MESSAGE_INVALID",
                "模型消息格式不正确；图片仅支持受限大小的 JPG、PNG 或 WebP 上传数据"
        );
    }

    private boolean isAliyunEndpoint(URI endpoint) {
        String host = endpoint.getHost().toLowerCase();
        return host.endsWith(".aliyuncs.com") || host.endsWith(".maas.aliyuncs.com");
    }

    private static final class HttpClientHolder {
        private static final HttpClient CLIENT = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        private HttpClientHolder() {
        }
    }
}
