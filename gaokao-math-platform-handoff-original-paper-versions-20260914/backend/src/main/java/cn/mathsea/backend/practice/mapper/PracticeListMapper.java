package cn.mathsea.backend.practice.mapper;
import cn.mathsea.backend.practice.entity.PracticeList;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import java.util.UUID;
@Mapper
public interface PracticeListMapper extends BaseMapper<PracticeList> {
    String SELECT_FIELDS = """
            id, public_id, user_id, title, description,
            is_default AS default_list,
            is_public AS public_list,
            is_official AS official,
            created_at, updated_at
            """;

    @Select("SELECT " + SELECT_FIELDS + " FROM practice_lists WHERE public_id=#{publicId} AND user_id=#{userId} LIMIT 1")
    PracticeList findOwned(@Param("publicId") UUID publicId, @Param("userId") Long userId);
    @Select("SELECT " + SELECT_FIELDS + " FROM practice_lists WHERE public_id=#{publicId} LIMIT 1")
    PracticeList findByPublicId(@Param("publicId") UUID publicId);
    @Update("UPDATE practice_lists SET is_default=FALSE WHERE user_id=#{userId}")
    int clearDefault(Long userId);
    @Update("UPDATE practice_lists SET updated_at=NOW() WHERE id=#{listId}")
    int touch(Long listId);
}
