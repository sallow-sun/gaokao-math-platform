package cn.mathsea.backend.auth.dto;

import jakarta.validation.constraints.*;

public record RegisterRequest(
        @NotBlank @Size(min=2, max=20, message="用户名长度必须为2到20个字符") String username,
        @NotBlank @Email(message="邮箱格式不正确") @Size(max=320) String email,
        @Pattern(regexp="^$|^1[3-9]\\d{9}$", message="手机号格式不正确") String phone,
        @NotBlank @Size(min=8, max=128, message="密码长度必须为8到128个字符") String password,
        @NotBlank String confirmPassword
) {}
