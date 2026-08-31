package cn.mathsea.backend.auth.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min=8,max=128,message="新密码长度必须为8到128个字符") String newPassword,
        @NotBlank String confirmPassword
) {}
