package cn.mathsea.backend.documentimport;

import static org.junit.jupiter.api.Assertions.*;
import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.security.CustomUserPrincipal;
import cn.mathsea.backend.user.entity.UserAccount;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DocumentImportControllerTest {
  private HttpServer server;
  private DocumentImportController controller;
  private final AtomicInteger calls = new AtomicInteger();
  private final AtomicReference<String> owner = new AtomicReference<>(), token = new AtomicReference<>(),
      path = new AtomicReference<>(), payload = new AtomicReference<>();
  private static final String ID = "a".repeat(32), TOKEN = "test-only-".repeat(4);

  @BeforeEach void setup() throws Exception {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", exchange -> {
      calls.incrementAndGet();
      owner.set(exchange.getRequestHeaders().getFirst("X-Document-Owner"));
      token.set(exchange.getRequestHeaders().getFirst("Authorization"));
      path.set(exchange.getRequestURI().toString());
      payload.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
      byte[] response = "{\"ready\":true}".getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(path.get().endsWith("/recognize") ? 409 : 200, response.length);
      exchange.getResponseBody().write(response);
      exchange.close();
    });
    server.start();
    controller = new DocumentImportController("http://127.0.0.1:"+server.getAddress().getPort(), TOKEN);
  }

  @AfterEach void cleanup() { server.stop(0); }

  private Authentication actor(String role) {
    UserAccount user = new UserAccount();
    user.setId(42L); user.setUsername("test"); user.setRole(role); user.setStatus("ACTIVE");
    var principal = new CustomUserPrincipal(user);
    return UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
  }

  @Test void proxyUsesAuthenticatedOwnerAndPrivateToken() {
    var response = controller.health(actor("ADMIN"));
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertEquals("42", owner.get());
    assertEquals("Bearer "+TOKEN, token.get());
    assertEquals("no-store", response.getHeaders().getFirst("Cache-Control"));
  }

  @Test void disabledServiceAndNonAdminsNeverContactWorker() {
    assertEquals(HttpStatus.UNAUTHORIZED, assertThrows(BusinessException.class, () -> controller.health(null)).getStatus());
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(BusinessException.class, () -> controller.health(actor("USER"))).getStatus());
    var disabled = new DocumentImportController("http://127.0.0.1:1", "");
    assertEquals(HttpStatus.SERVICE_UNAVAILABLE, assertThrows(BusinessException.class, () -> disabled.health(actor("ADMIN"))).getStatus());
    assertEquals(0, calls.get());
  }

  @Test void rawUploadNameIsEncodedAndBodyIsForwarded() throws Exception {
    controller.upload(new MockMultipartFile("file", "试卷 & 答案.pdf", "application/pdf", "pdf-test".getBytes()), actor("ADMIN"));
    assertTrue(path.get().startsWith("/jobs?name=%"));
    assertTrue(path.get().contains("%26"));
    assertEquals("pdf-test", payload.get());
  }

  @Test void staleVersionIsPreservedWithoutAutomaticRetry() {
    var response = controller.recognize(ID, "{\"version\":1,\"maxCalls\":1}".getBytes(), actor("ADMIN"));
    assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
    assertEquals(1, calls.get());
    assertTrue(payload.get().contains("maxCalls"));
  }

  @Test void invalidPathsAreRejectedBeforeProxy() {
    assertThrows(BusinessException.class, () -> controller.detail("../secret", actor("ADMIN")));
    assertThrows(BusinessException.class, () -> controller.image(ID, "image", "../job.json", actor("ADMIN")));
    assertEquals(0, calls.get());
  }

  @Test void mvcRoutesAcceptJsonAndReturnBinaryBodyWithoutWrapping() throws Exception {
    var mvc = MockMvcBuilders.standaloneSetup(controller).build();
    mvc.perform(put("/api/v1/admin/document-import/jobs/"+ID)
        .principal(actor("ADMIN")).contentType("application/json").content("{\"version\":1}"))
        .andExpect(status().isOk()).andExpect(content().json("{\"ready\":true}"));
    assertEquals("{\"version\":1}", payload.get());
    mvc.perform(get("/api/v1/admin/document-import/jobs/"+ID+"/image/test.png")
        .principal(actor("ADMIN"))).andExpect(status().isOk());
    assertEquals("/jobs/"+ID+"/image/test.png", path.get());
  }
}
