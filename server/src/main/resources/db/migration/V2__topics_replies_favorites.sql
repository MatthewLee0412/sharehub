CREATE TABLE topics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tag_key VARBINARY(256) NOT NULL UNIQUE,
    display_name VARCHAR(40) NOT NULL
);
CREATE TABLE post_tags (
    post_id BIGINT NOT NULL,
    topic_id BIGINT NOT NULL,
    tag_position INTEGER NOT NULL,
    PRIMARY KEY (post_id, topic_id),
    CONSTRAINT post_tags_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT post_tags_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id)
);
CREATE INDEX post_tags_topic_id ON post_tags(topic_id, post_id);

ALTER TABLE comments ADD COLUMN parent_id BIGINT;
ALTER TABLE comments ADD COLUMN reply_to_id BIGINT;
CREATE INDEX comments_thread_id ON comments(post_id, parent_id, id);

CREATE TABLE favorites (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    CONSTRAINT favorites_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT favorites_member_fk FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    CONSTRAINT unique_favorite UNIQUE (post_id, member_id)
);
CREATE INDEX favorites_member_id ON favorites(member_id, id);
