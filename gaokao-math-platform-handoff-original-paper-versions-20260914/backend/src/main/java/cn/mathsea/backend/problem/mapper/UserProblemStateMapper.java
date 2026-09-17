package cn.mathsea.backend.problem.mapper;

import cn.mathsea.backend.problem.entity.UserProblemState;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import java.util.List;
import cn.mathsea.backend.user.vo.UserDailyStatVO;
import cn.mathsea.backend.user.vo.UserTagLevelStatVO;
import cn.mathsea.backend.user.vo.UserTypeStatVO;

@Mapper
public interface UserProblemStateMapper extends BaseMapper<UserProblemState> {
    @Select("SELECT * FROM user_problem_states WHERE user_id=#{userId} AND problem_id=#{problemId} LIMIT 1")
    UserProblemState find(@Param("userId") Long userId, @Param("problemId") Long problemId);

    @Insert("""
        INSERT INTO user_problem_states(user_id, problem_id, favorite, completed)
        VALUES(#{userId}, #{problemId}, #{favorite}, #{completed})
        ON CONFLICT(user_id, problem_id)
        DO UPDATE SET favorite=EXCLUDED.favorite, completed=EXCLUDED.completed, updated_at=NOW()
        """)
    int upsert(@Param("userId") Long userId, @Param("problemId") Long problemId,
               @Param("favorite") boolean favorite, @Param("completed") boolean completed);

    @Select("""
        <script>
        SELECT * FROM user_problem_states WHERE user_id=#{userId} AND problem_id IN
        <foreach collection="problemIds" item="id" open="(" separator="," close=")">#{id}</foreach>
        </script>
        """)
    List<UserProblemState> findMany(@Param("userId") Long userId, @Param("problemIds") List<Long> problemIds);

    @Select("SELECT COUNT(*) FROM user_problem_states WHERE user_id=#{userId} AND favorite=TRUE")
    long countFavorite(Long userId);

    @Select("SELECT COUNT(*) FROM user_problem_states WHERE user_id=#{userId} AND completed=TRUE")
    long countCompleted(Long userId);

    @Select("""
        SELECT (ups.updated_at AT TIME ZONE 'Asia/Shanghai')::date::text AS date, COUNT(*) AS count
        FROM user_problem_states ups
        WHERE ups.user_id=#{userId} AND ups.completed=TRUE
          AND ups.updated_at >= NOW() - INTERVAL '1 year'
        GROUP BY (ups.updated_at AT TIME ZONE 'Asia/Shanghai')::date
        ORDER BY (ups.updated_at AT TIME ZONE 'Asia/Shanghai')::date
        """)
    List<UserDailyStatVO> completedByDay(Long userId);

    @Select("""
        SELECT p.question_type AS type, COUNT(*) AS count
        FROM user_problem_states ups
        JOIN problems p ON p.id=ups.problem_id
        WHERE ups.user_id=#{userId} AND ups.completed=TRUE
        GROUP BY p.question_type
        ORDER BY p.question_type
        """)
    List<UserTypeStatVO> completedByType(Long userId);

    @Select("""
        SELECT t.name AS tag, p.difficulty AS level, COUNT(*) AS count
        FROM user_problem_states ups
        JOIN problems p ON p.id=ups.problem_id
        JOIN problem_tags pt ON pt.problem_id=p.id
        JOIN tags t ON t.id=pt.tag_id
        WHERE ups.user_id=#{userId} AND ups.completed=TRUE
        GROUP BY t.name, p.difficulty
        ORDER BY t.name, p.difficulty
        """)
    List<UserTagLevelStatVO> completedByTagAndLevel(Long userId);
}
