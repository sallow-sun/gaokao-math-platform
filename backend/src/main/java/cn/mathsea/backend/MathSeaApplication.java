package cn.mathsea.backend;

import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan(basePackages = "cn.mathsea.backend", annotationClass = Mapper.class)
public class MathSeaApplication {
    public static void main(String[] args) {
        SpringApplication.run(MathSeaApplication.class, args);
    }
}
