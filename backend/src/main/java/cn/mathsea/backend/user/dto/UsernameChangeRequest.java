package cn.mathsea.backend.user.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record UsernameChangeRequest(
        @NotBlank @Size(min=2,max=20,message="用户名长度必须为2到20个字符") String username,
        @NotBlank String currentPassword
) {}
