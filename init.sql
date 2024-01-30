CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_email ON users (email);

CREATE TABLE groups (
    group_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_group_name ON groups (group_name);

CREATE TABLE user_groups (
    user_id INTERGER,
    group_id INTERGER,
    PRIMARY KEY (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (group_id) REFERENCES groups(group_id)
);

CREATE TABLE tokens (
    token_value VARCHAR(255) PRIMARY KEY NOT NULL,
    user_id INTERGER,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

INSERT INTO users (username, password_hash, email) VALUES
    ('linnil1', 'linnil1_password', 'linnil1@gmail.com'),
    ('linnil2', 'linnil2_password', 'linnil2@gmail.com');

INSERT INTO groups (group_name) VALUES
    ('group1'),
    ('group2');

INSERT INTO user_groups (user_id, group_id) VALUES
    (1, 1),
    (1, 2),
    (2, 2);

INSERT INTO tokens (user_id, token_value, expires_at) VALUES
    (1, 'linnil1_token', '2024-12-31 23:59:59'),
    (2, 'linnil2_token', '2024-12-31 23:59:59');