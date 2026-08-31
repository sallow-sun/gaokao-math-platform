package cn.mathsea.backend.user.controller;

import cn.mathsea.backend.auth.vo.SimpleMessage;
import cn.mathsea.backend.security.SecurityUtils;
import cn.mathsea.backend.user.dto.ProfileUpdateRequest;
import cn.mathsea.backend.user.dto.UsernameChangeRequest;
import cn.mathsea.backend.user.service.UserService;
import cn.mathsea.backend.user.vo.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/{userId}")
    public PublicUserVO publicProfile(@PathVariable Long userId, Authentication authentication) {
        return userService.publicProfile(userId, SecurityUtils.userIdOrNull(authentication));
    }

    @GetMapping("/me")
    public MeProfileVO me(Authentication authentication) {
        return userService.me(SecurityUtils.requireUserId(authentication));
    }

    @PatchMapping("/me")
    public MeProfileVO update(@Valid @RequestBody ProfileUpdateRequest request, Authentication authentication) {
        return userService.updateProfile(SecurityUtils.requireUserId(authentication), request);
    }

    @PatchMapping("/me/username")
    public MeProfileVO changeUsername(@Valid @RequestBody UsernameChangeRequest request, Authentication authentication) {
        return userService.changeUsername(SecurityUtils.requireUserId(authentication), request);
    }

    @PostMapping(value="/me/avatar", consumes="multipart/form-data")
    public AvatarResponse avatar(@RequestPart("file") MultipartFile file, Authentication authentication) {
        return userService.uploadAvatar(SecurityUtils.requireUserId(authentication), file);
    }

    @DeleteMapping("/me/avatar")
    public SimpleMessage deleteAvatar(Authentication authentication) {
        userService.deleteAvatar(SecurityUtils.requireUserId(authentication));
        return new SimpleMessage("头像已删除");
    }
}
