package cn.mathsea.backend.problem.mapper;

import cn.mathsea.backend.problem.entity.Problem;
import cn.mathsea.backend.problem.mapper.row.ProblemSummaryRow;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface ProblemMapper extends BaseMapper<Problem> {
    List<ProblemSummaryRow> selectFiltered(
            @Param("keyword") String keyword,
            @Param("years") List<Integer> years,
            @Param("sources") List<String> sources,
            @Param("types") List<String> types,
            @Param("levels") List<String> levels,
            @Param("tags") List<String> tags,
            @Param("tagCount") int tagCount,
            @Param("sort") String sort,
            @Param("limit") int limit,
            @Param("offset") int offset);

    long countFiltered(
            @Param("keyword") String keyword,
            @Param("years") List<Integer> years,
            @Param("sources") List<String> sources,
            @Param("types") List<String> types,
            @Param("levels") List<String> levels,
            @Param("tags") List<String> tags,
            @Param("tagCount") int tagCount);

    @Select("SELECT * FROM problems WHERE problem_number = #{problemNumber} LIMIT 1")
    Problem findByProblemNumber(String problemNumber);

    @Select("SELECT id FROM problems WHERE problem_number = #{problemNumber} LIMIT 1")
    Long findIdByProblemNumber(String problemNumber);

    @Select("SELECT problem_number FROM problems ORDER BY RANDOM() LIMIT 1")
    String randomProblemNumber();

    @Update("UPDATE problems SET view_count = view_count + 1 WHERE id = #{problemId}")
    int incrementViewCount(Long problemId);


    @Select("SELECT DISTINCT year FROM problems WHERE year IS NOT NULL ORDER BY year DESC")
    List<Integer> distinctYears();

    @Select("SELECT COUNT(DISTINCT year) FROM problems WHERE year IS NOT NULL")
    long countDistinctYears();

    @Select("SELECT COUNT(*) FROM problems WHERE creator_user_id = #{userId}")
    long countByCreator(Long userId);

    @Select("SELECT COUNT(*) FROM problems WHERE source_code = #{sourceCode}")
    long countBySource(String sourceCode);

    @Select("""
        <script>
        SELECT id, problem_number, title, year, region, source_code, question_type, difficulty,
               content, content_format, creator_user_id, view_count, favorite_count, created_at, updated_at
        FROM problems WHERE id IN
        <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
        </script>
        """)
    List<ProblemSummaryRow> selectSummariesByIds(@Param("ids") List<Long> ids);
}
