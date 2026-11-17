package com.sharehub;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.PathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
class Api {
    private final Timeline timeline;
    private final Media media;
    private final Accounts accounts;
    private final Topics topics;
    private final boolean demo;

    Api(Timeline timeline, Media media, Accounts accounts, Topics topics, @Value("${sharehub.demo}") boolean demo) {
        this.timeline = timeline;
        this.media = media;
        this.accounts = accounts;
        this.topics = topics;
        this.demo = demo;
    }

    @GetMapping("/session")
    Session session(Principal user, CsrfToken csrf) {
        return new Session(user == null ? null : timeline.member(user.getName()).profile(),
            csrf.getHeaderName(), csrf.getToken(), demo);
    }

    @GetMapping("/posts")
    List<Timeline.Entry> feed(Principal user, @RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "") String tag, @RequestParam(required = false) Long before,
        @RequestParam(defaultValue = "false") boolean mine, @RequestParam(defaultValue = "false") boolean favorites) {
        return timeline.feed(user.getName(), q, tag, before, mine, favorites);
    }

    @GetMapping("/members")
    List<Member.Profile> members(Principal user) {
        return accounts.list(user.getName());
    }

    @PostMapping("/members")
    @ResponseStatus(HttpStatus.CREATED)
    Member.Profile createMember(@RequestBody Accounts.NewAccount member, Principal user) {
        return accounts.create(user.getName(), member);
    }

    @GetMapping("/topics")
    List<Topics.Topic> topics(@RequestParam(defaultValue = "") String q) {
        return topics.suggest(q);
    }

    @GetMapping("/posts/{id}")
    Timeline.Entry detail(@PathVariable long id, Principal user) {
        return timeline.detail(id, user.getName());
    }

    @PostMapping(value = "/posts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    Timeline.Entry create(@RequestPart Timeline.Draft draft,
        @RequestPart(required = false) List<MultipartFile> images, Principal user) {
        return timeline.create(user.getName(), draft, images == null ? List.of() : images);
    }

    @PutMapping("/posts/{id}")
    Timeline.Entry edit(@PathVariable long id, @RequestBody Timeline.Draft draft, Principal user) {
        return timeline.edit(id, user.getName(), draft);
    }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable long id, Principal user) {
        timeline.delete(id, user.getName());
    }

    @PutMapping("/posts/{id}/like")
    Timeline.Entry like(@PathVariable long id, @RequestBody Like request, Principal user) {
        return timeline.react(id, user.getName(), request.liked());
    }

    @PutMapping("/posts/{id}/favorite")
    Timeline.Entry favorite(@PathVariable long id, @RequestBody Favorite request, Principal user) {
        return timeline.saveFavorite(id, user.getName(), request.saved());
    }

    @GetMapping("/posts/{id}/comments")
    List<Timeline.Comment> comments(@PathVariable long id, @RequestParam(required = false) Long before,
        @RequestParam(required = false) Long after) {
        return timeline.comments(id, before, after);
    }

    @GetMapping("/posts/{id}/comments/{commentId}/replies")
    List<Timeline.Comment> replies(@PathVariable long id, @PathVariable long commentId,
        @RequestParam(required = false) Long before) {
        return timeline.replies(id, commentId, before);
    }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    Timeline.PublishedComment comment(@PathVariable long id, @RequestBody Reply reply, Principal user) {
        return timeline.comment(id, user.getName(), reply.body(), reply.replyToId());
    }

    @GetMapping("/media/{name}")
    ResponseEntity<PathResource> image(@PathVariable String name) {
        var path = media.file(name);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .contentType(MediaType.parseMediaType("image/" + name.substring(name.lastIndexOf('.') + 1)))
            .body(new PathResource(path));
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> error(ResponseStatusException error) {
        String message = error.getReason() == null ? "无法完成此操作" : error.getReason();
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("message", message));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String, String>> tooLarge() {
        return ResponseEntity.status(413).body(Map.of("message", "每张图片不能超过 5 MB"));
    }

    record Session(Member.Profile user, String csrfHeader, String csrfToken, boolean demo) {}
    record Like(boolean liked) {}
    record Favorite(boolean saved) {}
    record Reply(String body, Long replyToId) {}
}
