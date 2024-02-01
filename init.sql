/*
DROP TABLE user_groups;
DROP TABLE tokens;
DROP TABLE users;
DROP TABLE groups;
*/

CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    /*
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    */
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_username ON users (username);

CREATE TABLE groups (
    group_id INTEGER PRIMARY KEY AUTOINCREMENT,
    groupname VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_groupname ON groups (groupname);

CREATE TABLE user_groups (
    user_id INTERGER,
    group_id INTERGER,
    PRIMARY KEY (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (group_id) REFERENCES groups(group_id)
);

CREATE TABLE tokens (
    token_id VARCHAR(255) PRIMARY KEY NOT NULL,
    user_id INTERGER,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

INSERT INTO users (username) VALUES
    ('linnil1'),
    ('linnil2');

INSERT INTO groups (groupname) VALUES
    ('group1'),
    ('group2');

INSERT INTO user_groups (user_id, group_id) VALUES
    (1, 1),
    (1, 2),
    (2, 2);