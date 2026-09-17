package cn.mathsea.backend.admin.editorial;
import static org.junit.jupiter.api.Assertions.*;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class SimpleTagMigrationTest {
  @Test void mergesExistingAliasesWithoutChangingContentOrLosingOriginalAssignments() throws Exception {
    try(var pg=EmbeddedPostgres.builder().setPort(0).start()) {
      String url=pg.getJdbcUrl("postgres","postgres");
      Flyway.configure().dataSource(url,"postgres","").target("9").load().migrate();
      try(var c=DriverManager.getConnection(url,"postgres","");var s=c.createStatement()) {
        s.execute("INSERT INTO problems(problem_number,title,question_type,difficulty,content) VALUES ('GC999998','迁移测试','single-choice','red','保留原文')");
        s.execute("INSERT INTO tags(name) VALUES ('双曲线'),('抛物线'),('无法识别的旧标签') ON CONFLICT(name) DO NOTHING");
        s.execute("INSERT INTO problem_tags(problem_id,tag_id) SELECT p.id,t.id FROM problems p CROSS JOIN tags t WHERE p.problem_number='GC999998' AND t.name IN ('双曲线','抛物线','无法识别的旧标签')");
        s.execute("INSERT INTO editorial_items(id,original_number,problem_number,payload) VALUES ('00000000-0000-0000-0000-000000000010','1','GC999998','{\"tags\":[\"双曲线\",\"抛物线\",\"无法识别的旧标签\"],\"originalMetadata\":{},\"content\":\"保留原文\"}')");
      }
      Flyway.configure().dataSource(url,"postgres","").load().migrate();
      try(var c=DriverManager.getConnection(url,"postgres","");var s=c.createStatement()) {
        assertEquals("10",scalar(s,"SELECT count(*) FROM tags WHERE active"));
        assertEquals("解析几何",scalar(s,"SELECT string_agg(t.name,',') FROM problem_tags pt JOIN tags t ON t.id=pt.tag_id JOIN problems p ON p.id=pt.problem_id WHERE p.problem_number='GC999998'"));
        assertEquals("3",scalar(s,"SELECT count(*) FROM tag_assignment_archive a JOIN problems p ON p.id=a.problem_id WHERE p.problem_number='GC999998'"));
        assertEquals("保留原文",scalar(s,"SELECT content FROM problems WHERE problem_number='GC999998'"));
        assertEquals("[\"解析几何\"]",scalar(s,"SELECT payload->'tags' FROM editorial_items WHERE problem_number='GC999998'"));
        assertEquals("true",scalar(s,"SELECT tag_mapping_blocked::text FROM problems WHERE problem_number='GC999998'"));
        assertEquals("0",scalar(s,"SELECT count(*) FROM effective_problem_chapters e JOIN problems p ON p.id=e.problem_id WHERE p.problem_number='GC999998'"));
      }
    }
  }
  private String scalar(Statement s,String query)throws SQLException {try(var result=s.executeQuery(query)){result.next();return result.getString(1);}}
}
