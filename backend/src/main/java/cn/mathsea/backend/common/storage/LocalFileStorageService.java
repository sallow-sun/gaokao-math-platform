package cn.mathsea.backend.common.storage;

import cn.mathsea.backend.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;

@Service
public class LocalFileStorageService {
    private final Path root;

    public LocalFileStorageService(@Value("${mathsea.storage.root:./uploads}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    public StoredFile saveAvatar(MultipartFile file, String oldUrl) {
        StoredFile stored = saveImage(file, "avatars", 5L * 1024 * 1024);
        deleteUrl(oldUrl);
        return stored;
    }

    public StoredFile saveProblemImage(MultipartFile file, String problemNumber) {
        return saveImage(file, "problems/" + safeSegment(problemNumber), 10L * 1024 * 1024);
    }

    public void deleteUrl(String url) {
        if (url == null || !url.startsWith("/uploads/")) return;
        String relative = url.substring("/uploads/".length());
        Path target = root.resolve(relative).normalize();
        if (!target.startsWith(root)) return;
        try { Files.deleteIfExists(target); } catch (IOException ignored) {}
    }

    private StoredFile saveImage(MultipartFile file, String folder, long maxBytes) {
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("FILE_REQUIRED", "请选择图片文件");
        if (file.getSize() > maxBytes) throw new BusinessException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "图片文件过大");

        try {
            byte[] head;
            try (var input = file.getInputStream()) { head = input.readNBytes(16); }
            ImageType type = detect(head);
            if (type == null) throw BusinessException.badRequest("INVALID_IMAGE", "仅支持 PNG、JPEG、GIF 或 WEBP 图片");

            Path dir = root.resolve(folder).normalize();
            if (!dir.startsWith(root)) throw BusinessException.badRequest("INVALID_PATH", "文件路径不合法");
            Files.createDirectories(dir);

            String name = UUID.randomUUID() + "." + type.extension;
            Path target = dir.resolve(name).normalize();
            try (var input = file.getInputStream()) {
                Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
            }
            String relative = root.relativize(target).toString().replace('\\', '/');
            return new StoredFile("/uploads/" + relative, type.mimeType);
        } catch (IOException e) {
            throw new IllegalStateException("保存文件失败", e);
        }
    }

    private String safeSegment(String value) {
        return value == null ? "unknown" : value.replaceAll("[^A-Za-z0-9_-]", "_");
    }

    private ImageType detect(byte[] b) {
        if (b.length >= 8 && (b[0]&0xff)==0x89 && b[1]=='P' && b[2]=='N' && b[3]=='G') return new ImageType("png", "image/png");
        if (b.length >= 3 && (b[0]&0xff)==0xff && (b[1]&0xff)==0xd8 && (b[2]&0xff)==0xff) return new ImageType("jpg", "image/jpeg");
        if (b.length >= 6) {
            String s = new String(b, 0, 6, java.nio.charset.StandardCharsets.US_ASCII);
            if (s.equals("GIF87a") || s.equals("GIF89a")) return new ImageType("gif", "image/gif");
        }
        if (b.length >= 12) {
            String riff = new String(b, 0, 4, java.nio.charset.StandardCharsets.US_ASCII);
            String webp = new String(b, 8, 4, java.nio.charset.StandardCharsets.US_ASCII);
            if (riff.equals("RIFF") && webp.equals("WEBP")) return new ImageType("webp", "image/webp");
        }
        return null;
    }

    private record ImageType(String extension, String mimeType) {}
    public record StoredFile(String url, String mimeType) {}
}
