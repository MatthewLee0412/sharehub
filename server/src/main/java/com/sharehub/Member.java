package com.sharehub;

import jakarta.persistence.*;

@Entity
@Table(name = "members")
class Member {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;
    String username;
    String passwordHash;
    String displayName;
    String team;
    String color;
    boolean admin;

    protected Member() {}

    Member(String username, String passwordHash, String displayName, String team, String color, boolean admin) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.team = team;
        this.color = color;
        this.admin = admin;
    }

    Profile profile() {
        return new Profile(id, displayName, team, color, admin);
    }

    record Profile(long id, String name, String team, String color, boolean admin) {}
}
