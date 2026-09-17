package cn.mathsea.backend.practice.mapper;

import cn.mathsea.backend.practice.entity.PracticeListItem;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface PracticeListItemMapper extends BaseMapper<PracticeListItem> {
    @Select("SELECT COALESCE(MAX(position), -1) FROM practice_list_items WHERE practice_list_id=#{listId}")
    int maxPosition(Long listId);

    @Select("SELECT COUNT(*) FROM practice_list_items WHERE practice_list_id=#{listId}")
    long countForList(Long listId);

    @Select("""
        SELECT COUNT(*) FROM practice_list_items pli
        JOIN user_problem_states ups ON ups.problem_id=pli.problem_id AND ups.user_id=#{userId}
        WHERE pli.practice_list_id=#{listId} AND ups.completed=TRUE
        """)
    long countCompleted(@Param("listId") Long listId, @Param("userId") Long userId);

    @Select("""
        SELECT COUNT(*) > 0 FROM practice_list_items pli
        JOIN practice_lists pl ON pl.id=pli.practice_list_id
        WHERE pl.user_id=#{userId} AND pli.problem_id=#{problemId}
        """)
    boolean existsForUserProblem(@Param("userId") Long userId, @Param("problemId") Long problemId);

    @Select("""
        <script>
        SELECT DISTINCT pli.problem_id FROM practice_list_items pli
        JOIN practice_lists pl ON pl.id=pli.practice_list_id
        WHERE pl.user_id=#{userId} AND pli.problem_id IN
        <foreach collection="problemIds" item="id" open="(" separator="," close=")">#{id}</foreach>
        </script>
        """)
    List<Long> problemIdsInAnyList(@Param("userId") Long userId, @Param("problemIds") List<Long> problemIds);
}
