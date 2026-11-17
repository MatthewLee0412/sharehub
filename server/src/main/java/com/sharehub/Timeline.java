package com.sharehub;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.sql.Statement;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
class Timeline {
    private final EntityManager db;
    private final JdbcTemplate jdbc;
    private final Media media;
    private final Topics topics;
    private final NamedParameterJdbcTemplate namedJdbc;

    Timeline(EntityManager db, JdbcTemplate jdbc, Media media, Topics topics) {
        this.db = db;
        this.jdbc = jdbc;
        this.media = media;
        this.topics = topics;
        this.namedJdbc = new NamedParameterJdbcTemplate(jdbc);
    }

    Member member(String username) {
        return db.createQuery("from Member m where m.username = :name", Member.class)
            .setParameter("name", username).getSingleResult();
    }

    List<Entry> feed(String username, String search, String tag, Long before, boolean mine, boolean favorites) {
        Member viewer = member(username);
        Long topicId = tag.isBlank() ? null : topics.find(tag);
        if (!tag.isBlank() && topicId == null) return List.of();

        String order = favorites ? "f.id" : "p.id";
        String favoriteJoin = favorites ? " JOIN favorites f ON f.post_id = p.id AND f.member_id = :viewer" : "";
        String ownFilter = mine ? " AND p.author_id = :viewer" : "";
        String tagFilter = topicId == null ? "" : " AND EXISTS (SELECT 1 FROM post_tags pt WHERE pt.post_id = p.id AND pt.topic_id = :topic)";
        String sql = """
            SELECT p.id FROM posts p%s
            WHERE %s < :before
              AND (:search = '' OR LOCATE(:search, LOWER(p.title)) > 0 OR LOCATE(:search, LOWER(p.body)) > 0)
            %s%s ORDER BY %s DESC LIMIT 15
            """.formatted(favoriteJoin, order, ownFilter, tagFilter, order);
        var params = Map.of("viewer", viewer.profile().id(), "before", before == null ? Long.MAX_VALUE : before,
            "search", search.strip().toLowerCase(Locale.ROOT), "topic", topicId == null ? 0L : topicId);
        List<Long> ids = namedJdbc.queryForList(sql, params, Long.class);
        if (ids.isEmpty()) return List.of();

        var posts = new HashMap<Long, Post>();
        db.createQuery("select p from Post p join fetch p.author where p.id in :ids", Post.class)
            .setParameter("ids", ids).getResultList().forEach(post -> posts.put(post.id, post));
        var labels = topics.names(ids);
        var stats = engagement(ids, viewer.profile().id());
        return ids.stream().map(posts::get).filter(Objects::nonNull)
            .filter(post -> stats.containsKey(post.id))
            .map(post -> entry(post, labels.getOrDefault(post.id, List.of()), stats.get(post.id))).toList();
    }

    Entry detail(long id, String username) {
        return entry(post(id), member(username));
    }

    @Transactional
    Entry create(String username, Draft draft, List<MultipartFile> files) {
        if (files.size() > 4) throw bad("最多添加 4 张图片");
        Member author = member(username);
        Post post = new Post(author, "", "", Instant.now());
        List<String> labels = applyDraft(post, draft, files.size());
        List<String> saved = new ArrayList<>();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) saved.forEach(media::delete);
            }
        });
        for (MultipartFile file : files) saved.add(media.save(file));
        post.images.addAll(saved);
        db.persist(post);
        topics.replace(post.id, labels);
        return entry(post, author);
    }

    @Transactional
    Entry edit(long id, String username, Draft draft) {
        Member viewer = member(username);
        Post post = lockedPost(id);
        if (post.author.profile().id() != viewer.profile().id()) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        topics.replace(post.id, applyDraft(post, draft, post.images.size()));
        return entry(post, viewer);
    }

    @Transactional
    void delete(long id, String username) {
        Member viewer = member(username);
        Post post = lockedPost(id);
        if (!viewer.profile().admin() && post.author.profile().id() != viewer.profile().id()) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        List<String> files = List.copyOf(post.images);
        db.remove(post);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { files.forEach(media::delete); }
        });
    }

    @Transactional
    Entry react(long id, String username, boolean liked) {
        Post post = lockedPost(id);
        Member member = member(username);
        if (liked) {
            jdbc.update("""
                INSERT INTO reactions (post_id, member_id)
                SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM reactions WHERE post_id = ? AND member_id = ?)
                """, id, member.profile().id(), id, member.profile().id());
        } else {
            jdbc.update("DELETE FROM reactions WHERE post_id = ? AND member_id = ?", id, member.profile().id());
        }
        return entry(post, member);
    }

    @Transactional
    Entry saveFavorite(long id, String username, boolean saved) {
        Post post = lockedPost(id);
        Member member = member(username);
        if (saved) {
            jdbc.update("""
                INSERT INTO favorites (post_id, member_id)
                SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM favorites WHERE post_id = ? AND member_id = ?)
                """, id, member.profile().id(), id, member.profile().id());
        } else {
            jdbc.update("DELETE FROM favorites WHERE post_id = ? AND member_id = ?", id, member.profile().id());
        }
        return entry(post, member);
    }

    private static final String COMMENT_FIELDS = """
        SELECT c.id, c.body, c.published_at, c.parent_id, c.reply_to_id, target.display_name AS reply_to_name,
            m.id AS author_id, m.display_name, m.team, m.color, m.admin,
            CASE WHEN c.parent_id IS NULL THEN (SELECT COUNT(*) FROM comments replies
                WHERE replies.post_id = c.post_id AND replies.parent_id = c.id) ELSE 0 END AS reply_count
        FROM comments c JOIN members m ON c.author_id = m.id
        LEFT JOIN comments target_comment ON c.reply_to_id = target_comment.id
        LEFT JOIN members target ON target_comment.author_id = target.id
        """;

    private static final RowMapper<Comment> COMMENT_ROW = (row, index) -> new Comment(
        row.getLong("id"), row.getString("body"), row.getTimestamp("published_at").toInstant(),
        new Member.Profile(row.getLong("author_id"), row.getString("display_name"),
            row.getString("team"), row.getString("color"), row.getBoolean("admin")),
        row.getObject("parent_id", Long.class), row.getObject("reply_to_id", Long.class),
        row.getString("reply_to_name"), row.getLong("reply_count"));

    List<Comment> comments(long id, Long before, Long after) {
        post(id);
        if (after != null) {
            return jdbc.query(COMMENT_FIELDS + " WHERE c.post_id = ? AND c.parent_id IS NULL AND c.id > ? ORDER BY c.id LIMIT 30",
                COMMENT_ROW, id, after);
        }
        return jdbc.query(COMMENT_FIELDS + " WHERE c.post_id = ? AND c.parent_id IS NULL AND c.id < ? ORDER BY c.id DESC LIMIT 30",
            COMMENT_ROW, id, before == null ? Long.MAX_VALUE : before);
    }

    List<Comment> replies(long id, long parent, Long before) {
        post(id);
        if (commentTarget(id, parent).parentId() != null) throw bad("请指定一级评论");
        return jdbc.query(COMMENT_FIELDS + " WHERE c.post_id = ? AND c.parent_id = ? AND c.id < ? ORDER BY c.id DESC LIMIT 30",
            COMMENT_ROW, id, parent, before == null ? Long.MAX_VALUE : before);
    }

    @Transactional
    PublishedComment comment(long id, String username, String input, Long replyTo) {
        String body = input == null ? "" : input.strip();
        if (body.isEmpty() || body.length() > 1000) throw bad("评论需要 1 到 1000 个字符");
        lockedPost(id);
        Member author = member(username);
        Long thread = null;
        if (replyTo != null) {
            var target = commentTarget(id, replyTo);
            thread = target.parentId() == null ? target.id() : target.parentId();
        }

        var keys = new GeneratedKeyHolder();
        Long parent = thread;
        jdbc.update(connection -> {
            var statement = connection.prepareStatement("""
                INSERT INTO comments (post_id, author_id, body, published_at, parent_id, reply_to_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """, Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, id);
            statement.setLong(2, author.profile().id());
            statement.setString(3, body);
            statement.setObject(4, OffsetDateTime.now(java.time.ZoneOffset.UTC));
            statement.setObject(5, parent, java.sql.Types.BIGINT);
            statement.setObject(6, replyTo, java.sql.Types.BIGINT);
            return statement;
        }, keys);
        long commentId = Objects.requireNonNull(keys.getKey()).longValue();
        Comment comment = jdbc.queryForObject(COMMENT_FIELDS + " WHERE c.id = ?", COMMENT_ROW, commentId);
        long count = jdbc.queryForObject("SELECT COUNT(*) FROM comments WHERE post_id = ?", Long.class, id);
        long threadCount = parent == null ? 0 : jdbc.queryForObject(
            "SELECT COUNT(*) FROM comments WHERE post_id = ? AND parent_id = ?", Long.class, id, parent);
        return new PublishedComment(comment, count, threadCount);
    }

    private CommentTarget commentTarget(long id, long commentId) {
        return jdbc.query("SELECT id, parent_id FROM comments WHERE post_id = ? AND id = ?",
            (row, index) -> new CommentTarget(row.getLong(1), row.getObject(2, Long.class)), id, commentId)
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "这条评论不存在"));
    }

    private Post post(long id) {
        Post post = db.find(Post.class, id);
        if (post == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "这条动态已删除或不存在");
        return post;
    }

    private Post lockedPost(long id) {
        Post post = db.find(Post.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (post == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "这条动态已删除或不存在");
        return post;
    }

    private Map<Long, Engagement> engagement(List<Long> ids, long viewerId) {
        var result = new HashMap<Long, Engagement>();
        namedJdbc.query("""
            SELECT p.id,
                (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS likes,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS replies,
                (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id AND r.member_id = :viewer) AS liked,
                f.id AS favorite_id
            FROM posts p LEFT JOIN favorites f ON f.post_id = p.id AND f.member_id = :viewer
            WHERE p.id IN (:ids)
            """, Map.of("viewer", viewerId, "ids", ids), row -> {
                result.put(row.getLong("id"), new Engagement(row.getLong("likes"), row.getLong("replies"),
                    row.getBoolean("liked"), row.getObject("favorite_id", Long.class)));
            });
        return result;
    }

    private Entry entry(Post post, Member viewer) {
        var ids = List.of(post.id);
        return entry(post, topics.names(ids).getOrDefault(post.id, List.of()), engagement(ids, viewer.profile().id()).get(post.id));
    }

    private Entry entry(Post post, List<String> labels, Engagement stats) {
        return new Entry(post.id, post.author.profile(), post.title, post.body, labels,
            List.copyOf(post.images), post.publishedAt, stats.likes(), stats.replies(), stats.liked(), stats.favoriteId());
    }

    private List<String> applyDraft(Post post, Draft draft, int imageCount) {
        String title = draft.title() == null ? "" : draft.title().strip();
        String body = draft.body() == null ? "" : draft.body().strip();
        if (title.length() > 120 || body.length() > 12000) throw bad("标题最多 120 字，正文最多 12000 字");
        if (title.isEmpty() && body.isEmpty() && imageCount == 0) throw bad("请添加文字或图片");
        var labels = new LinkedHashMap<String, String>();
        for (String raw : draft.tags() == null ? List.<String>of() : draft.tags()) {
            if (raw == null || !raw.strip().matches("[\\p{L}\\p{N}_+.#-]{1,24}")) {
                throw bad("标签需要 1 到 24 个字符，可使用文字、数字和常见技术符号");
            }
            labels.putIfAbsent(Topics.normalize(raw), raw.strip());
        }
        if (labels.size() > 6) throw bad("每条动态最多添加 6 个标签");
        post.title = title;
        post.body = body;
        return List.copyOf(labels.values());
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    record Draft(String title, String body, List<String> tags) {}
    record Entry(long id, Member.Profile author, String title, String body, List<String> tags,
                 List<String> images, Instant publishedAt, long likes, long replies, boolean liked, Long favoriteId) {}
    record Engagement(long likes, long replies, boolean liked, Long favoriteId) {}
    record Comment(long id, String body, Instant publishedAt, Member.Profile author,
                   Long parentId, Long replyToId, String replyToName, long replyCount) {}
    record CommentTarget(long id, Long parentId) {}
    record PublishedComment(Comment comment, long commentCount, long threadCount) {}
}
