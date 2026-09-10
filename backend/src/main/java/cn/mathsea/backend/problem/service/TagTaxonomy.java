package cn.mathsea.backend.problem.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class TagTaxonomy {
  private final JsonNode catalog;
  private final Map<String, Set<String>> descendants = new LinkedHashMap<>();
  private final Map<String, String> aliases = new LinkedHashMap<>();

  public TagTaxonomy(ObjectMapper mapper) throws IOException {
    try (var stream = getClass().getResourceAsStream("/tag-taxonomy.json")) {
      catalog = mapper.readTree(stream);
    }
    for (var node : catalog) index(node);
  }

  private Set<String> index(JsonNode node) {
    String name = node.path("name").asText();
    Set<String> names = new LinkedHashSet<>();
    names.add(name);
    aliases.put(name, name);
    for (var alias : node.path("aliases")) {
      names.add(alias.asText());
      aliases.put(alias.asText(), name);
    }
    for (var child : node.path("children")) names.addAll(index(child));
    descendants.put(name, names);
    return names;
  }

  public JsonNode catalog() { return catalog; }
  public String canonical(String name) { return aliases.getOrDefault(name, name); }
  public List<String> normalize(List<String> names) {
    return names == null ? List.of() : names.stream().filter(Objects::nonNull).map(String::trim)
      .filter(aliases::containsKey).map(aliases::get).distinct().toList();
  }
  public List<String> expand(List<String> tags) {
    Set<String> result = new LinkedHashSet<>();
    for (String tag : tags) result.addAll(descendants.getOrDefault(canonical(tag), Set.of(tag)));
    return new ArrayList<>(result);
  }
}
