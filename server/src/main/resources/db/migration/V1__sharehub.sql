CREATE TABLE members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(40) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    display_name VARCHAR(60) NOT NULL,
    team VARCHAR(60) NOT NULL,
    color VARCHAR(16) NOT NULL,
    admin BOOLEAN NOT NULL
);
CREATE TABLE posts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    author_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    tags VARCHAR(190) NOT NULL,
    published_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT posts_author_fk FOREIGN KEY (author_id) REFERENCES members(id)
);
CREATE INDEX posts_author_id ON posts(author_id, id);
CREATE TABLE comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    body VARCHAR(1000) NOT NULL,
    published_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT comments_author_fk FOREIGN KEY (author_id) REFERENCES members(id),
    CONSTRAINT comments_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX comments_post_id ON comments(post_id, id);
CREATE TABLE reactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    CONSTRAINT reactions_member_fk FOREIGN KEY (member_id) REFERENCES members(id),
    CONSTRAINT reactions_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT unique_reaction UNIQUE (post_id, member_id)
);
CREATE TABLE post_images (
    post_id BIGINT NOT NULL,
    image_position INTEGER NOT NULL,
    filename VARCHAR(48) NOT NULL UNIQUE,
    PRIMARY KEY (post_id, image_position),
    CONSTRAINT images_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
