package cn.mathsea.backend.user.mapper;

import cn.mathsea.backend.user.entity.UserAccount;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;

import java.util.List;
import java.util.UUID;

@Mapper
public interface UserMapper extends BaseMapper<UserAccount> {
    @Update("LOCK TABLE users IN SHARE UPDATE EXCLUSIVE MODE")
    void lockRegistrationBootstrap();

    @Select("""
        SELECT * FROM users
        WHERE username = #{account}
           OR uid = #{account}
           OR email = LOWER(#{account})
        LIMIT 1
        """)
    UserAccount findByAccount(String account);

    @Select("SELECT * FROM users WHERE public_id = #{publicId} LIMIT 1")
    UserAccount findByPublicId(UUID publicId);

    @Select("SELECT COUNT(*) FROM users WHERE username = #{username}")
    long countByUsername(String username);

    @Select("SELECT COUNT(*) FROM users WHERE email = LOWER(#{email})")
    long countByEmail(String email);

    @Select("SELECT COUNT(*) FROM users WHERE phone = #{phone}")
    long countByPhone(String phone);

    @Select("SELECT MIN(id) FROM users")
    Long firstUserId();

    @Select("""
        <script>
        SELECT * FROM users
        <where>
          <if test="keyword != null and keyword != ''">
            username ILIKE CONCAT('%', #{keyword}, '%')
            OR uid ILIKE CONCAT('%', #{keyword}, '%')
            OR email ILIKE CONCAT('%', #{keyword}, '%')
            OR COALESCE(phone, '') ILIKE CONCAT('%', #{keyword}, '%')
          </if>
        </where>
        ORDER BY id DESC
        LIMIT #{limit} OFFSET #{offset}
        </script>
        """)
    List<UserAccount> adminSearch(@Param("keyword") String keyword, @Param("limit") int limit, @Param("offset") int offset);

    @Select("""
        <script>
        SELECT COUNT(*) FROM users
        <where>
          <if test="keyword != null and keyword != ''">
            username ILIKE CONCAT('%', #{keyword}, '%')
            OR uid ILIKE CONCAT('%', #{keyword}, '%')
            OR email ILIKE CONCAT('%', #{keyword}, '%')
            OR COALESCE(phone, '') ILIKE CONCAT('%', #{keyword}, '%')
          </if>
        </where>
        </script>
        """)
    long adminCount(@Param("keyword") String keyword);
}
