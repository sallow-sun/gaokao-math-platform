package cn.mathsea.backend.admin.dto;
import jakarta.validation.constraints.NotNull;
public record AdminUserBanRequest(@NotNull Boolean banned) {}
