package cn.mathsea.backend.problem.controller;

import cn.mathsea.backend.problem.service.TagTaxonomy;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class TagTaxonomyController {
  private final TagTaxonomy taxonomy;
  private final org.springframework.jdbc.core.JdbcTemplate db;
  @GetMapping("/api/v1/problems/tag-taxonomy")
  public Object catalog() {
    var result = (com.fasterxml.jackson.databind.node.ArrayNode) taxonomy.catalog().deepCopy();
    var known = taxonomy.expand(java.util.stream.StreamSupport.stream(taxonomy.catalog().spliterator(), false).map(n -> n.path("name").asText()).toList());
    for (String name : db.queryForList("SELECT name FROM tags WHERE active=true ORDER BY sort_order,id", String.class)) {
      if (!known.contains(name)) result.addObject().put("name", name);
    }
    return result;
  }
}
