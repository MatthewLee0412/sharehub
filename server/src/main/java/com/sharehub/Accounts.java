package com.sharehub;

import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class Accounts {
    private final EntityManager db;
    private final Timeline timeline;
    private final PasswordEncoder passwords;

    Accounts(EntityManager db, Timeline timeline, PasswordEncoder passwords) {
        this.db = db;
        this.timeline = timeline;
        this.passwords = passwords;
    }

    @Transactional(readOnly = true)
    List<Member.Profile> list(String administrator) {
        requireAdmin(administrator);
        return db.createQuery("from Member order by id", Member.class)
            .getResultList().stream().map(Member::profile).toList();
    }

    @Transactional
    Member.Profile create(String administrator, NewAccount input) {
        requireAdmin(administrator);
        validate(input.username(), input.password(), input.name());
        if (input.team() != null && input.team().strip().length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "团队名称最多 60 个字符");
        }
        String team = input.team() == null || input.team().isBlank() ? "研发部" : input.team().strip();
        try {
            var member = new Member(input.username(), passwords.encode(input.password()), input.name().strip(), team, "green", false);
            db.persist(member);
            db.flush();
            return member.profile();
        } catch (DataIntegrityViolationException | org.hibernate.exception.ConstraintViolationException error) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "这个账号已存在");
        }
    }

    private void requireAdmin(String username) {
        if (!timeline.member(username).admin) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }

    static void validate(String username, String password, String name) {
        if (username == null || !username.matches("[a-z0-9._-]{3,40}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "账号需要 3 到 40 个字符，使用小写字母、数字或 ._-");
        }
        if (password == null || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "密码至少 12 个字符，最多 72 字节");
        }
        if (name == null || name.isBlank() || name.strip().length() > 60) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写不超过 60 个字符的姓名");
        }
    }

    record NewAccount(String username, String password, String name, String team) {}
}
