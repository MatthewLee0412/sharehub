package com.sharehub;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posts")
class Post {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    Member author;
    String title;
    @Column(columnDefinition = "TEXT")
    String body;
    Instant publishedAt;

    @ElementCollection
    @CollectionTable(name = "post_images", joinColumns = @JoinColumn(name = "post_id"))
    @OrderColumn(name = "image_position")
    @Column(name = "filename")
    List<String> images = new ArrayList<>();

    protected Post() {}

    Post(Member author, String title, String body, Instant publishedAt) {
        this.author = author;
        this.title = title;
        this.body = body;
        this.publishedAt = publishedAt;
    }
}
