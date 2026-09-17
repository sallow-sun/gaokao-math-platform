package cn.mathsea.backend.ai.similarity;

public record SimilarityChatResponse(
        String content,
        String model,
        Usage usage,
        String providerRequestId,
        long elapsedMs
) {
    public record Usage(long promptTokens, long completionTokens, long totalTokens) {}
}
