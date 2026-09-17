package cn.mathsea.backend.curriculum;

import cn.mathsea.backend.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CurriculumService {
  private final JdbcTemplate db;
  private final ObjectMapper json;

  public Map<String, Object> catalog() {
    var presets = db.queryForList("SELECT * FROM curriculum_presets ORDER BY sort_order,id");
    for (var p : presets) p.put("chapters", strings(p.remove("chapter_codes").toString()));
    return Map.of(
        "version",
        CurriculumAnnotation.VERSION,
        "label",
        "人教A版（2019）",
        "chapters",
        db.queryForList(
            "SELECT code,book,book_order,title,sort_order FROM curriculum_chapters WHERE"
                + " curriculum_code=? ORDER BY sort_order",
            CurriculumAnnotation.VERSION),
        "presets",
        presets);
  }

  public List<String> validateCodes(List<String> codes) {
    if (codes == null) return List.of();
    if (codes.size() > 50 || codes.stream().anyMatch(Objects::isNull))
      throw BusinessException.badRequest("CHAPTERS", "章节列表不合法");
    var known =
        db.queryForList(
            "SELECT code FROM curriculum_chapters WHERE curriculum_code=?",
            String.class,
            CurriculumAnnotation.VERSION);
    var clean =
        codes.stream().map(String::trim).map(s -> s.toUpperCase(Locale.ROOT)).distinct().toList();
    if (!known.containsAll(clean))
      throw BusinessException.badRequest("CHAPTERS", "存在未知章节代码，请使用教材目录中的代码");
    return clean;
  }

  public void validate(CurriculumAnnotation annotation) {
    if (annotation == null
        || !CurriculumAnnotation.VERSION.equals(annotation.version())
        || annotation.chapters() == null)
      throw BusinessException.badRequest("CURRICULUM", "请选择支持的教材版本及章节");
    var codes = validateCodes(annotation.chapters());
    if (annotation.confirmed() && codes.isEmpty())
      throw BusinessException.badRequest("CHAPTERS_EMPTY", "请先选择做题必需的章节，再确认标注");
  }

  public CurriculumAnnotation fromMetadata(Map<String, String> meta) {
    String version = meta.getOrDefault("curriculum", CurriculumAnnotation.VERSION);
    String raw = meta.getOrDefault("chapters", "").trim();
    var codes =
        raw.isBlank()
            ? List.<String>of()
            : Arrays.stream(raw.split("[,，]"))
                .map(String::trim)
                .map(s -> s.toUpperCase(Locale.ROOT))
                .toList();
    var annotation = new CurriculumAnnotation(version, codes, false);
    validate(annotation);
    return annotation;
  }

  // Suggestions are never confirmations: ambiguous knowledge tags deliberately suggest multiple
  // chapters.
  public List<String> suggest(List<String> tags) {
    if (tags == null || tags.isEmpty()) return List.of();
    String slots = String.join(",", Collections.nCopies(tags.size(), "?"));
    return db.queryForList("SELECT DISTINCT m.chapter_code FROM tag_chapter_mapping m JOIN tag_aliases a ON a.canonical=m.tag_name WHERE a.alias IN ("+slots+") ORDER BY m.chapter_code",String.class,tags.toArray());
  }

  @Transactional
  public void publish(Long problemId, CurriculumAnnotation a) {
    validate(a);
    db.update("DELETE FROM problem_chapters WHERE problem_id=?", problemId);
    db.update(
        "INSERT INTO problem_curriculum(problem_id,curriculum_code,confirmed) VALUES (?,?,?) ON"
            + " CONFLICT(problem_id) DO UPDATE SET"
            + " curriculum_code=excluded.curriculum_code,confirmed=excluded.confirmed",
        problemId,
        a.version(),
        a.confirmed());
    for (String code : validateCodes(a.chapters()))
      db.update("INSERT INTO problem_chapters VALUES (?,?,?)", problemId, a.version(), code);
  }

  public Map<Long, CurriculumAnnotation> forProblems(List<Long> ids) {
    if (ids.isEmpty()) return Map.of();
    String slots = String.join(",", Collections.nCopies(ids.size(), "?"));
    var rows =
        db.queryForList(
            "SELECT c.problem_id,c.curriculum_code,c.confirmed,coalesce(json_agg(p.chapter_code"
                + " ORDER BY p.chapter_code) FILTER(WHERE p.chapter_code IS NOT NULL),'[]') AS"
                + " chapters FROM problem_curriculum c LEFT JOIN problem_chapters p"
                + " USING(problem_id,curriculum_code) WHERE c.problem_id IN ("
                + slots
                + ") GROUP BY c.problem_id",
            ids.toArray());
    Map<Long, CurriculumAnnotation> result = new HashMap<>();
    for (var r : rows)
      result.put(
          ((Number) r.get("problem_id")).longValue(),
          new CurriculumAnnotation(
              r.get("curriculum_code").toString(),
              strings(r.get("chapters").toString()),
              Boolean.TRUE.equals(r.get("confirmed"))));
    return result;
  }

  public CurriculumAnnotation forProblem(Long id) {
    return forProblems(List.of(id)).getOrDefault(id, CurriculumAnnotation.unknown());
  }

  public record PresetUpdate(long version, List<String> chapters) {}

  @Transactional
  public void updatePreset(Long actor, String id, PresetUpdate update) {
    var codes = validateCodes(update.chapters());
    if (codes.isEmpty()) throw BusinessException.badRequest("PRESET", "学期预设至少包含一个章节");
    if (db.update(
            "UPDATE curriculum_presets SET chapter_codes=?::jsonb,version=version+1 WHERE id=? AND"
                + " version=?",
            encode(codes),
            id,
            update.version())
        != 1) throw BusinessException.conflict("PRESET_VERSION", "学期预设已变化，请刷新后再修改");
    db.update(
        "INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,details) VALUES"
            + " (?,'CURRICULUM_PRESET','CURRICULUM',?,?)",
        actor,
        id,
        encode(codes));
  }

  private List<String> strings(String value) {
    try {
      return json.readValue(value, new TypeReference<List<String>>() {});
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
