package cn.mathsea.backend.documentimport;

import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.security.SecurityUtils;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** Optional sidecar integration. All existing editorial import/publish rules remain authoritative. */
@RestController
@RequestMapping("/api/v1/admin/document-import")
public class DocumentImportController {
  private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private final String workerUrl;
  private final String workerToken;

  public DocumentImportController(
      @Value("${DOCUMENT_WORKER_URL:http://127.0.0.1:8091}") String workerUrl,
      @Value("${DOCUMENT_WORKER_TOKEN:}") String workerToken) {
    this.workerUrl = workerUrl.replaceAll("/+$", "");
    this.workerToken = workerToken;
  }

  private ResponseEntity<byte[]> forward(String path, String method, byte[] body, String mime, Authentication auth) {
    Long actor = SecurityUtils.requireUserId(auth);
    if (auth.getAuthorities().stream().noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority())))
      throw BusinessException.forbidden("DOCUMENT_ACCESS", "需要管理员权限");
    if (workerToken.length() < 32)
      throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DOCUMENT_DISABLED", "试卷切分服务尚未启用，请配置独立 document-worker 服务");
    if (body != null && body.length > 10 * 1024 * 1024)
      throw BusinessException.badRequest("DOCUMENT_SIZE", "单次文档上传或保存最多 10MB");
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(workerUrl + path))
          .timeout(Duration.ofSeconds(45))
          .header("Authorization", "Bearer " + workerToken)
          .header("X-Document-Owner", actor.toString())
          .header("Content-Type", mime)
          .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofByteArray(body))
          .build();
      HttpResponse<java.io.InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
      byte[] value;
      try (var stream = response.body()) { value = stream.readNBytes(80 * 1024 * 1024 + 1); }
      if (value.length > 80 * 1024 * 1024)
        throw BusinessException.badRequest("DOCUMENT_RESULT_SIZE", "任务结果过大，请拆分为较小任务");
      String contentType = response.headers().firstValue("Content-Type").orElse("application/json");
      if (!contentType.equals("application/json") && !contentType.equals("image/png") && !contentType.equals("application/zip"))
        contentType = "application/octet-stream";
      return ResponseEntity.status(response.statusCode()).header("Content-Type", contentType)
          .header("Cache-Control", "no-store").header("X-Content-Type-Options", "nosniff").body(value);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DOCUMENT_INTERRUPTED", "文档请求中断，请刷新任务状态");
    } catch (IOException e) {
      throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DOCUMENT_UNAVAILABLE", "无法连接文档服务，请稍后刷新任务；不会自动重试付费请求");
    }
  }

  private String id(String value) {
    if (!value.matches("[a-f0-9]{32}")) throw BusinessException.badRequest("DOCUMENT_ID", "无效任务标识");
    return value;
  }

  @GetMapping("/health")
  public ResponseEntity<byte[]> health(Authentication auth) { return forward("/health", "GET", null, "application/json", auth); }

  @GetMapping("/jobs")
  public ResponseEntity<byte[]> jobs(Authentication auth) { return forward("/jobs", "GET", null, "application/json", auth); }

  @PostMapping(value="/jobs", consumes="multipart/form-data")
  public ResponseEntity<byte[]> upload(@RequestPart("file") MultipartFile file, Authentication auth) throws IOException {
    return uploadFile("/jobs", file, auth);
  }

  @PostMapping(value="/jobs/{job}/append", consumes="multipart/form-data")
  public ResponseEntity<byte[]> append(@PathVariable String job, @RequestPart("file") MultipartFile file, Authentication auth) throws IOException {
    return uploadFile("/jobs/" + id(job) + "/append", file, auth);
  }

  private ResponseEntity<byte[]> uploadFile(String path, MultipartFile file, Authentication auth) throws IOException {
    if (file.isEmpty() || file.getSize() > 10 * 1024 * 1024) throw BusinessException.badRequest("DOCUMENT_SIZE", "单文件最多 10MB");
    String name = file.getOriginalFilename() == null ? "upload.pdf" : file.getOriginalFilename();
    return forward(path + "?name=" + URLEncoder.encode(name, StandardCharsets.UTF_8), "POST", file.getBytes(), "application/octet-stream", auth);
  }

  @GetMapping("/jobs/{job}")
  public ResponseEntity<byte[]> detail(@PathVariable String job, Authentication auth) {
    return forward("/jobs/" + id(job), "GET", null, "application/json", auth);
  }

  @PutMapping("/jobs/{job}")
  public ResponseEntity<byte[]> save(@PathVariable String job, @RequestBody byte[] body, Authentication auth) {
    return forward("/jobs/" + id(job), "PUT", body, "application/json", auth);
  }

  @PostMapping("/jobs/{job}/recognize")
  public ResponseEntity<byte[]> recognize(@PathVariable String job, @RequestBody byte[] body, Authentication auth) {
    return forward("/jobs/" + id(job) + "/recognize", "POST", body, "application/json", auth);
  }

  @GetMapping("/jobs/{job}/{action:export|crops|bundle}")
  public ResponseEntity<byte[]> export(@PathVariable String job, @PathVariable String action, Authentication auth) {
    return forward("/jobs/" + id(job) + "/" + action, "GET", null, "application/json", auth);
  }

  @GetMapping("/jobs/{job}/{kind:image|crop}/{name}")
  public ResponseEntity<byte[]> image(@PathVariable String job, @PathVariable String kind, @PathVariable String name, Authentication auth) {
    if (!name.matches("[A-Za-z0-9_-]+(?:\\.png)?")) throw BusinessException.badRequest("DOCUMENT_PATH", "无效文件名");
    return forward("/jobs/" + id(job) + "/" + kind + "/" + name, "GET", null, "application/json", auth);
  }
}
