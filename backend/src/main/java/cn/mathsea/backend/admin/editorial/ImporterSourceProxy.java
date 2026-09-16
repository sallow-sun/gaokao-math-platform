package cn.mathsea.backend.admin.editorial;

import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@Service
public class ImporterSourceProxy {
  private final HttpClient client =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private final String baseUrl;
  private final String secret;

  public ImporterSourceProxy(
      @Value("${mathsea.importer.base-url:http://127.0.0.1:8001}") String baseUrl,
      @Value("${mathsea.importer.integration-secret:}") String secret) {
    this.baseUrl = baseUrl.replaceAll("/+$", "");
    this.secret = secret;
  }

  public ResponseEntity<StreamingResponseBody> source(String externalJobId) {
    if (secret.length() < 32)
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "原卷服务尚未完成安全配置");
    String encoded = URLEncoder.encode(externalJobId, StandardCharsets.UTF_8);
    HttpRequest request =
        HttpRequest.newBuilder(
                URI.create(baseUrl + "/api/integration/jobs/" + encoded + "/source"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + secret)
            .header("Accept", MediaType.APPLICATION_PDF_VALUE)
            .GET()
            .build();
    final HttpResponse<InputStream> response;
    try {
      response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "无法连接原卷服务", e);
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "无法连接原卷服务", e);
    }
    if (response.statusCode() != 200) {
      try {
        response.body().close();
      } catch (Exception ignored) {
        // The upstream response is already unusable.
      }
      HttpStatus status = response.statusCode() == 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY;
      throw new ResponseStatusException(status, "原卷服务返回异常");
    }
    StreamingResponseBody body =
        output -> {
          try (InputStream input = response.body()) {
            input.transferTo(output);
          }
        };
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
        .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
        .contentType(MediaType.APPLICATION_PDF)
        .body(body);
  }
}
