package cn.mathsea.backend.common.exception;

import java.util.Map;

public record ApiErrorResponse(ErrorBody error) {
    public record ErrorBody(
            String code,
            String message,
            Map<String, Object> fieldErrors,
            String requestId
    ) {}

    public static ApiErrorResponse of(String code, String message, Map<String, Object> fieldErrors, String requestId) {
        return new ApiErrorResponse(new ErrorBody(code, message, fieldErrors, requestId));
    }
}
