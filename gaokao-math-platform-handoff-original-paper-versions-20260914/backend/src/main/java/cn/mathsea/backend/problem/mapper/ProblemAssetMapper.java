package cn.mathsea.backend.problem.mapper;
import cn.mathsea.backend.problem.entity.ProblemAsset;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import java.util.List;
@Mapper
public interface ProblemAssetMapper extends BaseMapper<ProblemAsset> {
    @Select("SELECT * FROM problem_assets WHERE problem_id=#{problemId} ORDER BY sort_order,id")
    List<ProblemAsset> findByProblemId(Long problemId);
}
