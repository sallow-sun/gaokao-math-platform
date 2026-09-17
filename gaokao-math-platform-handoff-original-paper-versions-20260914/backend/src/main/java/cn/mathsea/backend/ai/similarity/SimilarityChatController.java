package cn.mathsea.backend.ai.similarity;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ai/similarity")
@RequiredArgsConstructor
public class SimilarityChatController {
    private final SimilarityChatService chatService;

    @PostMapping("/chat")
    public SimilarityChatResponse chat(@Valid @RequestBody SimilarityChatRequest request) {
        return chatService.relay(request);
    }
}
