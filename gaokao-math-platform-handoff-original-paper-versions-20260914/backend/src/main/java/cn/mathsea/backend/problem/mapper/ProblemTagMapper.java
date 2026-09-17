package cn.mathsea.backend.problem.mapper;

import cn.mathsea.backend.problem.entity.ProblemTag;
import cn.mathsea.backend.problem.mapper.row.ProblemTagNameRow;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface ProblemTagMapper extends BaseMapper<ProblemTag> {
    @Delete("DELETE FROM problem_tags WHERE problem_id = #{problemId}")
    int deleteByProblemId(Long problemId);

    @Select("""
        SELECT t.name FROM problem_tags pt JOIN tags t ON t.id = pt.tag_id
        WHERE pt.problem_id = #{problemId} ORDER BY t.sort_order, t.id
        """)
    List<String> selectNamesByProblemId(Long problemId);

    @Select("""
        <script>
        SELECT pt.problem_id, t.name AS tag_name
        FROM problem_tags pt JOIN tags t ON t.id = pt.tag_id
        WHERE pt.problem_id IN
        <foreach collection="problemIds" item="id" open="(" separator="," close=")">#{id}</foreach>
        ORDER BY t.sort_order, t.id
        </script>
        """)
    List<ProblemTagNameRow> selectNamesByProblemIds(@Param("problemIds") List<Long> problemIds);
}
