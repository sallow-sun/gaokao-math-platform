package cn.mathsea.backend.admin.service;

import cn.mathsea.backend.admin.dto.*;
import cn.mathsea.backend.admin.vo.*;
import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.problem.entity.ProblemSource;
import cn.mathsea.backend.problem.entity.Tag;
import cn.mathsea.backend.problem.mapper.ProblemMapper;
import cn.mathsea.backend.problem.mapper.ProblemSourceMapper;
import cn.mathsea.backend.problem.mapper.TagMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminCatalogService {
    private final TagMapper tagMapper;
    private final ProblemSourceMapper sourceMapper;
    private final ProblemMapper problemMapper;
    private final AuditLogService auditLogService;

    public List<AdminTagVO> tags() {
        return tagMapper.selectList(new LambdaQueryWrapper<Tag>().orderByAsc(Tag::getSortOrder).orderByAsc(Tag::getId)).stream().map(this::tagVo).toList();
    }

    @Transactional
    public AdminTagVO createTag(Long adminId, AdminTagCreateRequest r) {
        String name = r.name().trim();
        if (tagMapper.selectCount(new LambdaQueryWrapper<Tag>().eq(Tag::getName, name)) > 0) throw BusinessException.conflict("TAG_EXISTS", "标签已存在");
        Tag tag = new Tag(); tag.setName(name); tag.setSortOrder(r.sortOrder()==null?0:r.sortOrder()); tag.setActive(r.active()==null?true:r.active());
        tagMapper.insert(tag); auditLogService.log(adminId,"TAG_CREATE","TAG",tag.getId().toString(),name); return tagVo(tagMapper.selectById(tag.getId()));
    }

    @Transactional
    public AdminTagVO updateTag(Long adminId, Long id, AdminTagUpdateRequest r) {
        Tag tag = tagMapper.selectById(id); if (tag==null) throw BusinessException.notFound("TAG_NOT_FOUND","标签不存在");
        if (r.name()!=null) {
            String name=r.name().trim();
            Tag same=tagMapper.selectOne(new LambdaQueryWrapper<Tag>().eq(Tag::getName,name).last("LIMIT 1"));
            if (same!=null && !same.getId().equals(id)) throw BusinessException.conflict("TAG_EXISTS","标签已存在");
            tag.setName(name);
        }
        if (r.sortOrder()!=null) tag.setSortOrder(r.sortOrder()); if (r.active()!=null) tag.setActive(r.active());
        tagMapper.updateById(tag); auditLogService.log(adminId,"TAG_UPDATE","TAG",id.toString(),tag.getName()); return tagVo(tagMapper.selectById(id));
    }

    @Transactional
    public void deleteTag(Long adminId, Long id) {
        Tag tag=tagMapper.selectById(id); if(tag==null) throw BusinessException.notFound("TAG_NOT_FOUND","标签不存在");
        tagMapper.deleteById(id); auditLogService.log(adminId,"TAG_DELETE","TAG",id.toString(),tag.getName());
    }

    public List<AdminSourceVO> sources() {
        return sourceMapper.selectList(new LambdaQueryWrapper<ProblemSource>().orderByAsc(ProblemSource::getSortOrder).orderByAsc(ProblemSource::getCode)).stream().map(this::sourceVo).toList();
    }

    @Transactional
    public AdminSourceVO createSource(Long adminId, AdminSourceCreateRequest r) {
        if(sourceMapper.selectById(r.code())!=null) throw BusinessException.conflict("SOURCE_EXISTS","来源代码已存在");
        ProblemSource s=new ProblemSource(); s.setCode(r.code()); s.setLabel(r.label().trim()); s.setSortOrder(r.sortOrder()==null?0:r.sortOrder()); s.setActive(r.active()==null?true:r.active());
        sourceMapper.insert(s); auditLogService.log(adminId,"SOURCE_CREATE","SOURCE",s.getCode(),s.getLabel()); return sourceVo(sourceMapper.selectById(s.getCode()));
    }

    @Transactional
    public AdminSourceVO updateSource(Long adminId, String code, AdminSourceUpdateRequest r) {
        ProblemSource s=sourceMapper.selectById(code); if(s==null) throw BusinessException.notFound("SOURCE_NOT_FOUND","来源不存在");
        if(r.label()!=null) s.setLabel(r.label().trim()); if(r.sortOrder()!=null) s.setSortOrder(r.sortOrder()); if(r.active()!=null) s.setActive(r.active());
        sourceMapper.updateById(s); auditLogService.log(adminId,"SOURCE_UPDATE","SOURCE",code,s.getLabel()); return sourceVo(sourceMapper.selectById(code));
    }

    @Transactional
    public void deleteSource(Long adminId, String code) {
        ProblemSource s=sourceMapper.selectById(code); if(s==null) throw BusinessException.notFound("SOURCE_NOT_FOUND","来源不存在");
        if(problemMapper.countBySource(code)>0) throw BusinessException.conflict("SOURCE_IN_USE","该来源仍被题目使用，不能删除；可以先停用");
        sourceMapper.deleteById(code); auditLogService.log(adminId,"SOURCE_DELETE","SOURCE",code,s.getLabel());
    }

    private AdminTagVO tagVo(Tag t){return new AdminTagVO(t.getId().toString(),t.getName(),t.getSortOrder()==null?0:t.getSortOrder(),Boolean.TRUE.equals(t.getActive()));}
    private AdminSourceVO sourceVo(ProblemSource s){return new AdminSourceVO(s.getCode(),s.getLabel(),s.getSortOrder()==null?0:s.getSortOrder(),Boolean.TRUE.equals(s.getActive()));}
}
