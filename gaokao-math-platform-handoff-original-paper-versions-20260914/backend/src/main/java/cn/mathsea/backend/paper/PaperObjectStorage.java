package cn.mathsea.backend.paper;

import cn.mathsea.backend.common.exception.BusinessException;
import com.aliyun.oss.*;
import com.aliyun.oss.model.*;
import jakarta.annotation.PreDestroy;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PaperObjectStorage {
  public static final long MAX_BYTES = 25L * 1024 * 1024;
  private final String bucket, publicEndpoint, accessId;
  private final OSS client, publicClient;

  public PaperObjectStorage(
      @Value("${mathsea.oss.endpoint:}") String endpoint,
      @Value("${mathsea.oss.bucket:}") String bucket,
      @Value("${mathsea.oss.public-endpoint:}") String publicEndpoint,
      @Value("${mathsea.oss.access-key-id:}") String accessId,
      @Value("${mathsea.oss.access-key-secret:}") String secret) {
    this.bucket = bucket;
    this.publicEndpoint = publicEndpoint;
    this.accessId = accessId;
    boolean configured =
        !endpoint.isBlank()
            && !bucket.isBlank()
            && !publicEndpoint.isBlank()
            && !accessId.isBlank()
            && !secret.isBlank();
    if (configured) {
      ClientBuilderConfiguration config = new ClientBuilderConfiguration();
      config.setConnectionTimeout(5000);
      config.setSocketTimeout(10000);
      config.setMaxErrorRetry(1);
      client = new OSSClientBuilder().build(endpoint, accessId, secret, config);
      ClientBuilderConfiguration external = new ClientBuilderConfiguration();
      external.setSupportCname(true);
      external.setConnectionTimeout(5000);
      external.setSocketTimeout(10000);
      publicClient = new OSSClientBuilder().build(publicEndpoint, accessId, secret, external);
    } else {
      client = null;
      publicClient = null;
    }
  }

  public boolean available() {
    return client != null;
  }

  private void require() {
    if (!available()) throw BusinessException.badRequest("PDF_UNAVAILABLE", "PDF 上传暂未开放，可先分享站内组卷");
  }

  public Map<String, Object> upload(UUID id) {
    require();
    String key = "paper-temp/" + id + ".pdf";
    PolicyConditions conditions = new PolicyConditions();
    conditions.addConditionItem(PolicyConditions.COND_CONTENT_LENGTH_RANGE, 1, MAX_BYTES);
    conditions.addConditionItem(PolicyConditions.COND_KEY, key);
    conditions.addConditionItem("Content-Type", "application/pdf");
    String policy =
        client.generatePostPolicy(
            new Date(System.currentTimeMillis() + 15 * 60 * 1000), conditions);
    return Map.of(
        "url",
        publicEndpoint,
        "fields",
        Map.of(
            "key",
            key,
            "policy",
            Base64.getEncoder().encodeToString(policy.getBytes(StandardCharsets.UTF_8)),
            "OSSAccessKeyId",
            accessId,
            "signature",
            client.calculatePostSignature(policy),
            "success_action_status",
            "200",
            "Content-Type",
            "application/pdf"));
  }

  public record Stored(String key, long bytes) {}

  public Stored complete(UUID id) {
    require();
    String temporary = "paper-temp/" + id + ".pdf";
    try {
      var metadata = client.getObjectMetadata(bucket, temporary);
      if (metadata.getContentLength() < 5 || metadata.getContentLength() > MAX_BYTES)
        throw new IllegalArgumentException();
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      long size = 0;
      GetObjectRequest get = new GetObjectRequest(bucket, temporary);
      get.setMatchingETagConstraints(List.of(metadata.getETag()));
      try (OSSObject object = client.getObject(get);
          var stream = object.getObjectContent()) {
        byte[] head = stream.readNBytes(5);
        if (!Arrays.equals(head, "%PDF-".getBytes(StandardCharsets.US_ASCII)))
          throw new IllegalArgumentException();
        digest.update(head);
        size = head.length;
        byte[] buffer = new byte[32768];
        int read;
        while ((read = stream.read(buffer)) != -1) {
          size += read;
          if (size > MAX_BYTES) throw new IllegalArgumentException();
          digest.update(buffer, 0, read);
        }
      }
      if (size != metadata.getContentLength()) throw new IllegalArgumentException();
      String key = "paper-files/" + HexFormat.of().formatHex(digest.digest()) + ".pdf";
      if (!client.doesObjectExist(bucket, key)) {
        // Store the verified bytes under an immutable content hash, never the uploadable key.
        CopyObjectRequest copy = new CopyObjectRequest(bucket, temporary, bucket, key);
        copy.setMatchingETagConstraints(List.of(metadata.getETag()));
        ObjectMetadata target = new ObjectMetadata();
        target.setContentType("application/pdf");
        target.setCacheControl("private, max-age=86400");
        copy.setNewObjectMetadata(target);
        client.copyObject(copy);
      }
      // A lifecycle rule removes temporary uploads after one day, including interrupted uploads.
      return new Stored(key, size);
    } catch (Exception e) {
      throw BusinessException.badRequest("PDF_INVALID", "文件校验失败，请确认是25MB以内的有效 PDF，再重试上传");
    }
  }

  public String read(String key, boolean download) {
    require();
    var request = new GeneratePresignedUrlRequest(bucket, key);
    request.setExpiration(new Date(System.currentTimeMillis() + 60 * 60 * 1000));
    var headers = new ResponseHeaderOverrides();
    headers.setContentType("application/pdf");
    headers.setContentDisposition(download ? "attachment; filename=paper.pdf" : "inline");
    request.setResponseHeaders(headers);
    return publicClient.generatePresignedUrl(request).toString();
  }

  @PreDestroy
  public void close() {
    if (client != null) client.shutdown();
    if (publicClient != null) publicClient.shutdown();
  }
}
