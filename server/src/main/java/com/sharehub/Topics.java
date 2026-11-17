package com.sharehub;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class Topics {
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate namedJdbc;

    public Topics(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.namedJdbc = new NamedParameterJdbcTemplate(jdbc);
    }

    Long find(String name) {
        return jdbc.query("SELECT id FROM topics WHERE tag_key = ?", (row, index) -> row.getLong(1),
            key(normalize(name))).stream().findFirst().orElse(null);
    }

    List<Topic> suggest(String search) {
        String query = normalize(search);
        return jdbc.query("""
            SELECT t.id, t.display_name, COUNT(*) AS usage_count
            FROM topics t JOIN post_tags pt ON pt.topic_id = t.id
            WHERE ? = '' OR LOCATE(?, LOWER(t.display_name)) > 0
            GROUP BY t.id, t.tag_key, t.display_name
            ORDER BY CASE WHEN t.tag_key = ? THEN 0 ELSE 1 END, usage_count DESC, t.display_name ASC, t.id ASC
            LIMIT 8
            """, (row, index) -> new Topic(row.getLong("id"), row.getString("display_name"), row.getLong("usage_count")),
            query, query, key(query));
    }

    Map<Long, List<String>> names(List<Long> postIds) {
        var result = new HashMap<Long, List<String>>();
        namedJdbc.query("""
            SELECT pt.post_id, t.display_name FROM post_tags pt JOIN topics t ON t.id = pt.topic_id
            WHERE pt.post_id IN (:postIds) ORDER BY pt.post_id, pt.tag_position
            """, Map.of("postIds", postIds), row -> {
                result.computeIfAbsent(row.getLong("post_id"), id -> new ArrayList<>()).add(row.getString("display_name"));
            });
        return result;
    }

    public void replace(long postId, List<String> labels) {
        var unique = new LinkedHashMap<String, String>();
        for (String label : labels) unique.putIfAbsent(normalize(label), label.strip());

        // Use a consistent lock order when concurrent posts introduce the same set of tags.
        var ids = new HashMap<String, Long>();
        for (var item : new TreeMap<>(unique).entrySet()) {
            Long topicId = find(item.getValue());
            if (topicId == null) {
                byte[] tagKey = key(item.getKey());
                jdbc.update("INSERT INTO topics (tag_key, display_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id",
                    tagKey, item.getValue());
                topicId = jdbc.queryForObject("SELECT id FROM topics WHERE tag_key = ? FOR UPDATE", Long.class, tagKey);
            }
            ids.put(item.getKey(), topicId);
        }

        jdbc.update("DELETE FROM post_tags WHERE post_id = ?", postId);
        int position = 0;
        for (String label : unique.keySet()) {
            jdbc.update("INSERT INTO post_tags (post_id, topic_id, tag_position) VALUES (?, ?, ?)",
                postId, ids.get(label), position++);
        }
    }

    static String normalize(String name) {
        return name.strip().toLowerCase(Locale.ROOT);
    }

    private static byte[] key(String normalized) {
        return normalized.getBytes(StandardCharsets.UTF_8);
    }

    record Topic(long id, String name, long count) {}
}
