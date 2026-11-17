package com.sharehub;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class Security {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService accountDetails(JdbcTemplate jdbc) {
        return username -> jdbc.query(
            "SELECT username, password_hash, admin FROM members WHERE username = ?",
            (result, row) -> User.withUsername(result.getString("username"))
                .password(result.getString("password_hash"))
                .roles(result.getBoolean("admin") ? "ADMIN" : "MEMBER").build(),
            username
        ).stream().findFirst().orElseThrow(() -> new UsernameNotFoundException("Unknown account"));
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(rules -> rules.requestMatchers("/api/session", "/api/login", "/error").permitAll()
                .anyRequest().authenticated())
            .formLogin(login -> login.loginProcessingUrl("/api/login")
                .successHandler((request, response, user) -> response.setStatus(HttpServletResponse.SC_NO_CONTENT))
                .failureHandler((request, response, error) -> response.sendError(HttpServletResponse.SC_UNAUTHORIZED)))
            .logout(logout -> logout.logoutUrl("/api/logout")
                .logoutSuccessHandler((request, response, user) -> response.setStatus(HttpServletResponse.SC_NO_CONTENT)))
            .exceptionHandling(errors -> errors.authenticationEntryPoint(
                (request, response, error) -> response.sendError(HttpServletResponse.SC_UNAUTHORIZED)))
            .requestCache(cache -> cache.disable())
            .build();
    }
}
