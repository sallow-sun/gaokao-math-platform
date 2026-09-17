package cn.mathsea.backend.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LocalServerConfig {
  @Bean
  @ConditionalOnProperty(name = "mathsea.local.tomcat-nio2", havingValue = "true")
  WebServerFactoryCustomizer<TomcatServletWebServerFactory> localTomcatNio2() {
    return factory -> factory.setProtocol("org.apache.coyote.http11.Http11Nio2Protocol");
  }
}
