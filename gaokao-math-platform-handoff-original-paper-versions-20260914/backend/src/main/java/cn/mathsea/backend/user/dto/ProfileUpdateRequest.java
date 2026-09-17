package cn.mathsea.backend.user.dto;
import jakarta.validation.constraints.Size;
public record ProfileUpdateRequest(@Size(max=80,message="签名不能超过80个字符") String signature) {}
