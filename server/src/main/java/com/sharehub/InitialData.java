package com.sharehub;

import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class InitialData implements ApplicationRunner {
    private final EntityManager db;
    private final PasswordEncoder passwords;
    private final Topics topics;
    private final boolean demo;
    private final String adminUser;
    private final String adminPassword;

    InitialData(EntityManager db, PasswordEncoder passwords, Topics topics, @Value("${sharehub.demo}") boolean demo,
        @Value("${sharehub.admin-user}") String adminUser, @Value("${sharehub.admin-password}") String adminPassword) {
        this.db = db;
        this.passwords = passwords;
        this.topics = topics;
        this.demo = demo;
        this.adminUser = adminUser;
        this.adminPassword = adminPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (db.createQuery("select count(m) from Member m", Long.class).getSingleResult() > 0) return;
        if (!demo) {
            if (adminUser.isBlank() || adminPassword.isBlank()) {
                throw new IllegalStateException("Set SHAREHUB_ADMIN_USER and SHAREHUB_ADMIN_PASSWORD before first launch.");
            }
            Accounts.validate(adminUser, adminPassword, "管理员");
            db.persist(new Member(adminUser, passwords.encode(adminPassword), "管理员", "研发部", "green", true));
            return;
        }
        add("demo", "ShareHub123!", "陈晨", "研发部", "green", true);
        Member zhou = add("zhou", "ShareHub123!", "周一帆", "前端组", "amber", false);
        Member lin = add("lin", "ShareHub123!", "林语", "平台组", "lilac", false);
        Member shen = add("shen", "ShareHub123!", "沈言", "后端组", "blue", false);
        Instant now = Instant.now();
        sample(new Post(zhou, "把浏览器里的表格直接复制到 Excel",
            "一个顺手的小技巧：复制时同时写入纯文本和 HTML，粘贴到 Excel 还能保留表格结构。适合做在后台的「复制数据」按钮里。",
            now.minus(4, ChronoUnit.HOURS)), "前端", "效率工具");
        sample(new Post(lin, "", "今天把研发环境的服务启动文档重新走了一遍，补上了环境变量和初始化数据的说明。以后新同事可以少绕几个弯。欢迎大家把自己的踩坑记录也贴上来。",
            now.minus(2, ChronoUnit.HOURS)), "项目经验");
        sample(new Post(shen, "用 Java 21 的虚拟线程简化并发请求", """
            今天在整理一个需要并行请求多个接口的场景，试了下虚拟线程。每个请求直接开一个任务，等结果就好，读起来比手动拼异步回调清楚。

            ```java
            try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
                var profile = executor.submit(() -> fetchProfile(userId));
                var orders = executor.submit(() -> fetchOrders(userId));
                return new Overview(profile.get(), orders.get());
            }
            ```
            """, now.minus(26, ChronoUnit.MINUTES)), "Java", "后端");
    }

    private void sample(Post post, String... labels) {
        db.persist(post);
        topics.replace(post.id, List.of(labels));
    }

    private Member add(String username, String password, String name, String team, String color, boolean admin) {
        var member = new Member(username, passwords.encode(password), name, team, color, admin);
        db.persist(member);
        return member;
    }
}
