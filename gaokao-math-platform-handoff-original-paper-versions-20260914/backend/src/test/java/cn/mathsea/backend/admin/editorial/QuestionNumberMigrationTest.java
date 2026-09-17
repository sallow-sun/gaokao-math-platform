package cn.mathsea.backend.admin.editorial;

import static org.junit.jupiter.api.Assertions.*;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class QuestionNumberMigrationTest {
  @Test
  void upgradesExistingRecordsAndAllocatesOneTransactionalSequence() throws Exception {
    try (var pg = EmbeddedPostgres.builder().setPort(0).start()) {
      String url = pg.getJdbcUrl("postgres", "postgres");
      Flyway.configure().dataSource(url, "postgres", "").target("5").load().migrate();
      try (var c = DriverManager.getConnection(url, "postgres", "");
          var s = c.createStatement()) {
        s.execute("TRUNCATE users,problems RESTART IDENTITY CASCADE");
        s.execute(
            "INSERT INTO problems(problem_number,title,question_type,difficulty,content) VALUES"
                + " ('P-old-1','2026新高考Ⅱ卷T2','single-choice','red','题干'),"
                + " ('P-old-2','期末考试','multiple-choice','red','题干'),"
                + " ('P-old-3','课本习题','fill-blank','red','题干')");
        s.execute(
            "INSERT INTO users(public_id,uid,username,email,password_hash) VALUES"
                + " ('00000000-0000-0000-0000-000000000001','test','test','test@example.test','unused')");
        s.execute("INSERT INTO user_problem_states(user_id,problem_id,favorite) VALUES (1,1,true)");
        s.execute(
            "INSERT INTO practice_lists(public_id,user_id,title) VALUES"
                + " ('00000000-0000-0000-0000-000000000002',1,'test')");
        s.execute(
            "INSERT INTO practice_list_items(practice_list_id,problem_id) VALUES (1,1) ON CONFLICT"
                + " DO NOTHING");
        s.execute(
            "INSERT INTO editorial_items(id,original_number,problem_number,payload) VALUES"
                + " ('00000000-0000-0000-0000-000000000003','2','P-old-1','{}')");
      }
      Flyway.configure().dataSource(url, "postgres", "").load().migrate();
      try (var c = DriverManager.getConnection(url, "postgres", "");
          var s = c.createStatement()) {
        assertEquals(
            "GC000001,EM000002,TF000003",
            scalar(s, "SELECT string_agg(problem_number,',' ORDER BY id) FROM problems"));
        assertEquals(
            "1",
            scalar(s, "SELECT problem_id FROM problem_number_aliases WHERE old_number='P-old-1'"));
        assertEquals("GC000001", scalar(s, "SELECT problem_number FROM editorial_items"));
        assertEquals(
            "1",
            scalar(
                s,
                "SELECT count(*) FROM user_problem_states u JOIN practice_list_items l"
                    + " USING(problem_id) WHERE u.favorite"));
        assertEquals("N", scalar(s, "SELECT question_source_category('自编习题')"));
        assertEquals("E", scalar(s, "SELECT question_source_category('新高考模拟卷')"));
        c.setAutoCommit(false);
        assertEquals("NS000004", scalar(s, "SELECT allocate_question_number('N','solution')"));
        c.rollback();
        assertEquals("GC000004", scalar(s, "SELECT allocate_question_number('G','single-choice')"));
        c.commit();
      }
      // Separate connections exercise the same allocator used by simultaneous publications.
      try (var pool = Executors.newFixedThreadPool(4)) {
        List<Callable<String>> jobs = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
          String prefix = List.of("G", "E", "T", "N").get(i % 4);
          jobs.add(
              () -> {
                try (var c = DriverManager.getConnection(url, "postgres", "");
                    var s = c.createStatement()) {
                  return scalar(
                      s, "SELECT allocate_question_number('" + prefix + "','single-choice')");
                }
              });
        }
        Set<Integer> numbers = new TreeSet<>();
        for (var result : pool.invokeAll(jobs))
          numbers.add(Integer.valueOf(result.get().substring(2)));
        assertEquals(
            new TreeSet<>(java.util.stream.IntStream.rangeClosed(5, 16).boxed().toList()), numbers);
      }
      try (var c = DriverManager.getConnection(url, "postgres", "");
          var s = c.createStatement()) {
        s.execute("UPDATE question_number_counter SET last_number=999998");
        assertEquals("NS999999", scalar(s, "SELECT allocate_question_number('N','solution')"));
        assertThrows(
            SQLException.class, () -> scalar(s, "SELECT allocate_question_number('N','solution')"));
      }
    }
  }

  private static String scalar(Statement s, String sql) throws SQLException {
    try (var r = s.executeQuery(sql)) {
      assertTrue(r.next());
      return r.getString(1);
    }
  }
}
