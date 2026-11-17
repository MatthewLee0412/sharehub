package db.migration;

import com.sharehub.Topics;
import java.util.Arrays;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

public class V3__BackfillPostTags extends BaseJavaMigration {
    @Override
    public void migrate(Context context) {
        var jdbc = new JdbcTemplate(new SingleConnectionDataSource(context.getConnection(), true));
        var topics = new Topics(jdbc);
        long cursor = 0;
        while (true) {
            var posts = jdbc.query("SELECT id, tags FROM posts WHERE id > ? ORDER BY id LIMIT 500",
                (row, index) -> new LegacyPost(row.getLong("id"), row.getString("tags")), cursor);
            if (posts.isEmpty()) return;
            for (var post : posts) {
                topics.replace(post.id(), Arrays.stream(post.tags().split("\\|")).filter(tag -> !tag.isBlank()).toList());
                cursor = post.id();
            }
        }
    }

    private record LegacyPost(long id, String tags) {}
}
