package cn.mathsea.backend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI mathSeaOpenApi() {
        return new OpenAPI().info(new Info()
                .title("数海 MathSea API")
                .version("v1")
                .description("Vue 3 + Spring Boot + PostgreSQL + Redis 后端接口"));
    }
}
