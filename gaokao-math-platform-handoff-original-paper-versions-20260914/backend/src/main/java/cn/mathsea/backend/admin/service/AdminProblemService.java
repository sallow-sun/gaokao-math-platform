package cn.mathsea.backend.admin.service;

import cn.mathsea.backend.admin.dto.AdminProblemRequest;
import cn.mathsea.backend.admin.vo.AdminProblemVO;
import cn.mathsea.backend.common.api.PageResponse;
import cn.mathsea.backend.common.exception.BusinessException;
import cn.mathsea.backend.common.storage.LocalFileStorageService;
import cn.mathsea.backend.problem.dto.ProblemQuery;
import cn.mathsea.backend.problem.entity.*;
import cn.mathsea.backend.problem.mapper.*;
import cn.mathsea.backend.problem.model.DifficultyLevel;
import cn.mathsea.backend.problem.model.QuestionType;
import cn.mathsea.backend.problem.service.ProblemService;
import cn.mathsea.backend.problem.vo.ProblemAssetVO;
import cn.mathsea.backend.problem.vo.ProblemListVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AdminProblemService {
    private static final long MAX_MARKDOWN_BYTES = 2L * 1024 * 1024;
    private static final Pattern BODY_SECTION = Pattern.compile("(?ms)^(content|solution|answer)\\s*:\\s*(.*?)(?=^(?:content|solution|answer)\\s*:|\\z)");
    private final ProblemMapper problemMapper;
    private final ProblemSourceMapper sourceMapper;
    private final TagMapper tagMapper;
    private final ProblemTagMapper problemTagMapper;
    private final ProblemAssetMapper assetMapper;
    private final ProblemService problemService;
    private final LocalFileStorageService storageService;
    private final AuditLogService auditLogService;
    private final ProblemTrashService trash;

    public PageResponse<ProblemListVO> list(String keyword, int page, int pageSize) {
        return problemService.query(new ProblemQuery(keyword, List.of(), List.of(), List.of(), List.of(), List.of(), "newest", page, pageSize), null);
    }

    public AdminProblemVO detail(String problemNumber) {
        Problem p = requireProblem(problemNumber);
        return toVo(p);
    }

    @Transactional
    public AdminProblemVO create(Long adminId, AdminProblemRequest r) {
        String number = normalizeProblemNumber(r.problemNumber());
        if (problemMapper.findByProblemNumber(number) != null) throw BusinessException.conflict("PROBLEM_NUMBER_TAKEN", "题目编号已存在");
        validate(r);
        Problem p = new Problem();
        apply(p, r);
        p.setCreatorUserId(adminId);
        problemMapper.insert(p);
        replaceTags(p.getId(), r.tags());
        auditLogService.log(adminId, "PROBLEM_CREATE", "PROBLEM", number, null);
        return toVo(problemMapper.selectById(p.getId()));
    }

    @Transactional
    public AdminProblemVO importMarkdown(Long adminId, MultipartFile file) {
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("FILE_REQUIRED", "请选择 Markdown 文件");
        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("problem.md");
        if (!filename.toLowerCase(Locale.ROOT).endsWith(".md")) throw BusinessException.badRequest("INVALID_MARKDOWN_FILE", "仅支持 .md 文件");
        if (file.getSize() > MAX_MARKDOWN_BYTES) throw BusinessException.badRequest("MARKDOWN_TOO_LARGE", "单个 Markdown 文件不能超过 2MB");

        final String raw;
        try {
            raw = new String(file.getBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n").replace("\r", "\n").replace("\uFEFF", "");
        } catch (Exception e) {
            throw BusinessException.badRequest("MARKDOWN_READ_FAILED", "无法读取 Markdown 文件");
        }

        Map<String, String> metadata = parseFrontMatter(raw);
        Map<String, String> sections = parseBodySections(raw);
        String content = sections.getOrDefault("content", "").trim();
        if (content.isEmpty()) throw BusinessException.badRequest("MARKDOWN_CONTENT_REQUIRED", "Markdown 中缺少 content 段落");

        String filenameStem = fileStem(filename);
        String identity = firstNonBlank(metadata.get("id"), filenameStem);
        // Exported question files use `id` as the platform-wide problem number.
        // Keep `problem_number` only as a fallback for older Markdown files.
        String suppliedNumber = firstNonBlank(metadata.get("id"), metadata.get("problem_number"));
        if ((suppliedNumber == null || suppliedNumber.isBlank()) && isProblemNumberCandidate(filenameStem)) {
            suppliedNumber = filenameStem;
        }
        String problemNumber = markdownProblemNumber(suppliedNumber, identity);
        if (problemMapper.findByProblemNumber(problemNumber) != null) throw BusinessException.conflict("PROBLEM_NUMBER_TAKEN", "该 Markdown 已导入或题目编号已存在：" + problemNumber);

        List<String> tags = splitCsv(metadata.get("tags"));
        ensureTags(tags);
        AdminProblemRequest request = new AdminProblemRequest(
                problemNumber,
                firstNonBlank(metadata.get("title"), identity),
                parseInteger(metadata.get("year")),
                blankToNull(metadata.get("source")),
                mapSource(metadata.get("source")),
                mapQuestionType(metadata.get("question_type")),
                mapDifficulty(metadata.get("difficulty")),
                tags,
                content,
                blankToNull(sections.get("answer")),
                blankToNull(sections.get("solution")),
                "markdown-latex-v1"
        );
        AdminProblemVO result = create(adminId, request);
        auditLogService.log(adminId, "PROBLEM_MARKDOWN_IMPORT", "PROBLEM", problemNumber, filename);
        return result;
    }

    @Transactional
    public AdminProblemVO update(Long adminId, String problemNumber, AdminProblemRequest r) {
        Problem p = requireProblem(problemNumber);
        validate(r);
        String newNumber = normalizeProblemNumber(r.problemNumber());
        Problem same = problemMapper.findByProblemNumber(newNumber);
        if (same != null && !same.getId().equals(p.getId())) throw BusinessException.conflict("PROBLEM_NUMBER_TAKEN", "题目编号已存在");
        apply(p, r);
        problemMapper.updateById(p);
        replaceTags(p.getId(), r.tags());
        auditLogService.log(adminId, "PROBLEM_UPDATE", "PROBLEM", newNumber, null);
        return toVo(problemMapper.selectById(p.getId()));
    }

    @Transactional
    public void delete(Long adminId, String problemNumber) {
        Problem p = requireProblem(problemNumber);
        trash.delete(adminId, List.of(p.getProblemNumber()));
        auditLogService.log(adminId, "PROBLEM_DELETE", "PROBLEM", problemNumber, null);
    }

    @Transactional
    public ProblemAssetVO uploadAsset(Long adminId, String problemNumber, MultipartFile file, String altText) {
        Problem p = requireProblem(problemNumber);
        if (altText != null && altText.length() > 255) throw BusinessException.badRequest("ALT_TEXT_TOO_LONG", "图片说明不能超过255个字符");
        validateAssetFilename(p.getProblemNumber(), file);
        var stored = storageService.saveProblemImage(file, problemNumber);
        ProblemAsset asset = new ProblemAsset();
        asset.setProblemId(p.getId());
        asset.setUrl(stored.url());
        asset.setMimeType(stored.mimeType());
        asset.setAltText(altText == null ? "" : altText.trim());
        asset.setSortOrder(assetMapper.findByProblemId(p.getId()).size());
        assetMapper.insert(asset);
        auditLogService.log(adminId, "PROBLEM_ASSET_UPLOAD", "PROBLEM", problemNumber, stored.url());
        return new ProblemAssetVO(asset.getId().toString(), asset.getUrl(), asset.getMimeType(), asset.getAltText(), asset.getSortOrder());
    }

    @Transactional
    public void deleteAsset(Long adminId, String problemNumber, Long assetId) {
        Problem p = requireProblem(problemNumber);
        ProblemAsset asset = assetMapper.selectById(assetId);
        if (asset == null || !asset.getProblemId().equals(p.getId())) throw BusinessException.notFound("ASSET_NOT_FOUND", "图片不存在");
        storageService.deleteUrl(asset.getUrl());
        assetMapper.deleteById(assetId);
        auditLogService.log(adminId, "PROBLEM_ASSET_DELETE", "PROBLEM", problemNumber, asset.getUrl());
    }

    private void validate(AdminProblemRequest r) {
        if (QuestionType.fromCode(r.type()) == null) throw BusinessException.badRequest("INVALID_TYPE", "题型不合法");
        if (DifficultyLevel.fromCode(r.level()) == null) throw BusinessException.badRequest("INVALID_LEVEL", "训练价值不合法");
        if (r.source() != null && !r.source().isBlank()) {
            ProblemSource source = sourceMapper.selectById(r.source().trim());
            if (source == null || !Boolean.TRUE.equals(source.getActive())) throw BusinessException.badRequest("INVALID_SOURCE", "题目来源不存在或已停用");
        }
        validateTags(r.tags());
    }

    private void validateTags(List<String> names) {
        List<String> clean = cleanTags(names);
        if (clean.isEmpty()) return;
        List<Tag> tags = tagMapper.selectList(new LambdaQueryWrapper<Tag>().in(Tag::getName, clean).eq(Tag::getActive, true));
        Set<String> found = new HashSet<>();
        tags.forEach(t -> found.add(t.getName()));
        List<String> missing = clean.stream().filter(n -> !found.contains(n)).toList();
        if (!missing.isEmpty()) throw BusinessException.badRequest("INVALID_TAG", "不存在或已停用的标签：" + String.join("、", missing));
    }

    private void apply(Problem p, AdminProblemRequest r) {
        p.setProblemNumber(normalizeProblemNumber(r.problemNumber()));
        p.setTitle(blankToNull(r.title()));
        p.setYear(r.year());
        p.setRegion(blankToNull(r.region()));
        p.setSourceCode(blankToNull(r.source()));
        p.setQuestionType(r.type());
        p.setDifficulty(r.level());
        p.setContent(r.content());
        p.setAnswer(blankToNull(r.answer()));
        p.setSolution(blankToNull(r.solution()));
        p.setContentFormat(r.contentFormat() == null || r.contentFormat().isBlank() ? "markdown-latex-v1" : r.contentFormat().trim());
    }

    private void replaceTags(Long problemId, List<String> names) {
        problemTagMapper.deleteByProblemId(problemId);
        List<String> clean = cleanTags(names);
        if (clean.isEmpty()) return;
        List<Tag> tags = tagMapper.selectList(new LambdaQueryWrapper<Tag>().in(Tag::getName, clean));
        for (Tag tag : tags) {
            ProblemTag relation = new ProblemTag();
            relation.setProblemId(problemId); relation.setTagId(tag.getId());
            problemTagMapper.insert(relation);
        }
    }

    private AdminProblemVO toVo(Problem p) {
        ProblemSource source = p.getSourceCode() == null ? null : sourceMapper.selectById(p.getSourceCode());
        QuestionType type = QuestionType.fromCode(p.getQuestionType());
        List<ProblemAssetVO> assets = assetMapper.findByProblemId(p.getId()).stream()
                .map(a -> new ProblemAssetVO(a.getId().toString(), a.getUrl(), a.getMimeType(), a.getAltText(), Optional.ofNullable(a.getSortOrder()).orElse(0))).toList();
        return new AdminProblemVO(
                p.getProblemNumber(), p.getTitle(), p.getYear(), p.getRegion(), p.getSourceCode(), source == null ? p.getSourceCode() : source.getLabel(),
                p.getQuestionType(), type == null ? p.getQuestionType() : type.label(), p.getDifficulty(), problemTagMapper.selectNamesByProblemId(p.getId()),
                p.getContent(), p.getAnswer(), p.getSolution(), Optional.ofNullable(p.getContentFormat()).orElse("markdown-latex-v1"),
                Optional.ofNullable(p.getViewCount()).orElse(0L), Optional.ofNullable(p.getFavoriteCount()).orElse(0L), assets, p.getCreatedAt(), p.getUpdatedAt());
    }

    private Problem requireProblem(String number) {
        Problem p = problemMapper.findByProblemNumber(number);
        if (p == null || Boolean.TRUE.equals(p.getDeleted())) throw BusinessException.notFound("PROBLEM_NOT_FOUND", "题目不存在");
        return p;
    }
    private List<String> cleanTags(List<String> names) {
        if (names == null) return List.of();
        return names.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
    }
    private String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
    private String normalizeProblemNumber(String value) { return value.trim().toUpperCase(Locale.ROOT); }

    private Map<String, String> parseFrontMatter(String raw) {
        Map<String, String> result = new LinkedHashMap<>();
        String[] lines = raw.split("\n", -1);
        if (lines.length == 0 || !lines[0].trim().equals("---")) return result;
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i];
            if (line.trim().equals("---")) break;
            int colon = line.indexOf(':');
            if (colon > 0) result.put(line.substring(0, colon).trim().toLowerCase(Locale.ROOT), line.substring(colon + 1).trim());
        }
        return result;
    }

    private Map<String, String> parseBodySections(String raw) {
        int frontEnd = raw.startsWith("---") ? raw.indexOf("\n---", 3) : -1;
        String body = frontEnd >= 0 ? raw.substring(frontEnd + 4) : raw;
        Matcher matcher = BODY_SECTION.matcher(body);
        Map<String, String> result = new LinkedHashMap<>();
        while (matcher.find()) {
            result.put(matcher.group(1), matcher.group(2).trim());
        }
        return result;
    }

    private String markdownProblemNumber(String supplied, String identity) {
        if (supplied != null && supplied.trim().matches("[1-9]\\d*")) return "P" + supplied.trim();
        if (supplied != null) {
            String normalized = supplied.trim().toUpperCase(Locale.ROOT);
            if (normalized.matches("[A-Z0-9][A-Z0-9_-]{0,31}")) return normalized;
            throw BusinessException.badRequest(
                    "INVALID_MARKDOWN_PROBLEM_NUMBER",
                    "题目编号只能包含英文字母、数字、下划线和连字符，且不能超过 32 个字符"
            );
        }
        CRC32 crc = new CRC32();
        crc.update(identity.getBytes(StandardCharsets.UTF_8));
        return "P" + crc.getValue();
    }

    private void validateAssetFilename(String problemNumber, MultipartFile file) {
        if (file == null || file.isEmpty()) return;
        String originalFilename = Optional.ofNullable(file.getOriginalFilename()).orElse("");
        String stem = fileStem(originalFilename);
        if (!stem.equalsIgnoreCase(problemNumber)) {
            throw BusinessException.badRequest(
                    "ASSET_FILENAME_MISMATCH",
                    "图片主文件名必须与题目编号一致，例如 " + problemNumber + ".png"
            );
        }
    }

    private String fileStem(String filename) {
        String clean = Optional.ofNullable(filename).orElse("").replace('\\', '/');
        int slash = clean.lastIndexOf('/');
        if (slash >= 0) clean = clean.substring(slash + 1);
        int dot = clean.lastIndexOf('.');
        return (dot > 0 ? clean.substring(0, dot) : clean).trim();
    }

    private boolean isProblemNumberCandidate(String value) {
        return value != null && value.trim().matches("(?:[1-9]\\d*|[A-Za-z0-9][A-Za-z0-9_-]{0,31})");
    }

    private String mapQuestionType(String value) {
        String normalized = Optional.ofNullable(value).orElse("").trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "单项选择题", "单选题", "single-choice" -> "single-choice";
            case "多项选择题", "多选题", "multiple-choice" -> "multiple-choice";
            case "填空题", "fill-blank" -> "fill-blank";
            case "解答题", "solution" -> "solution";
            default -> throw BusinessException.badRequest("INVALID_MARKDOWN_TYPE", "无法识别题型：" + value);
        };
    }

    private String mapDifficulty(String value) {
        String normalized = Optional.ofNullable(value).orElse("").trim().toLowerCase(Locale.ROOT);
        if (DifficultyLevel.fromCode(normalized) == null) throw BusinessException.badRequest("INVALID_MARKDOWN_DIFFICULTY", "无法识别训练价值：" + value);
        return normalized;
    }

    private String mapSource(String value) {
        String normalized = Optional.ofNullable(value).orElse("").trim();
        if (normalized.isEmpty()) return null;
        ProblemSource byCode = sourceMapper.selectById(normalized);
        if (byCode != null && Boolean.TRUE.equals(byCode.getActive())) return byCode.getCode();
        ProblemSource byLabel = sourceMapper.selectOne(new LambdaQueryWrapper<ProblemSource>().eq(ProblemSource::getLabel, normalized).eq(ProblemSource::getActive, true).last("LIMIT 1"));
        if (byLabel != null) return byLabel.getCode();
        if (normalized.contains("卷")) return "local";
        throw BusinessException.badRequest("INVALID_MARKDOWN_SOURCE", "无法识别题目来源：" + value);
    }

    private void ensureTags(List<String> names) {
        for (String name : names) {
            Tag existing = tagMapper.selectOne(new LambdaQueryWrapper<Tag>().eq(Tag::getName, name).last("LIMIT 1"));
            if (existing == null) {
                Tag tag = new Tag(); tag.setName(name); tag.setSortOrder(0); tag.setActive(true); tagMapper.insert(tag);
            } else if (!Boolean.TRUE.equals(existing.getActive())) {
                existing.setActive(true); tagMapper.updateById(existing);
            }
        }
    }

    private List<String> splitCsv(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split("[,，]")) .map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
    }

    private Integer parseInteger(String value) {
        try { return value == null || value.isBlank() ? null : Integer.valueOf(value.trim()); }
        catch (NumberFormatException e) { throw BusinessException.badRequest("INVALID_MARKDOWN_YEAR", "年份格式不正确：" + value); }
    }

    private String firstNonBlank(String first, String fallback) { return first == null || first.isBlank() ? fallback : first.trim(); }
}
