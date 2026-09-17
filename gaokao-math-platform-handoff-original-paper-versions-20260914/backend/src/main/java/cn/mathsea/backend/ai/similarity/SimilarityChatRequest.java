package cn.mathsea.backend.ai.similarity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SimilarityChatRequest(
        @Size(max = 80) String taskType,
        @NotBlank @Size(max = 500) String endpoint,
        @NotBlank @Size(max = 120) String model,
        @NotBlank @Size(max = 1000) String apiKey,
        @NotEmpty @Size(max = 8) List<@Valid ChatMessage> messages,
        @Min(1) @Max(4000) int maxTokens,
        @Min(5) @Max(120) int timeoutSeconds,
        boolean jsonMode,
        boolean lowLatency
) {
    public record ChatMessage(
            @NotBlank @Pattern(regexp = "system|user|assistant") String role,
            @NotNull JsonNode content
    ) {}
}
