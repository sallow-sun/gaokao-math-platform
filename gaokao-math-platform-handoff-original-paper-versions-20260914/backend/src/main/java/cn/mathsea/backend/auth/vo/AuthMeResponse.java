package cn.mathsea.backend.auth.vo;
public record AuthMeResponse(boolean authenticated, AuthUserVO user) {}
