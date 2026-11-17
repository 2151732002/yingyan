CREATE TABLE IF NOT EXISTS app_user (
  id VARCHAR(36) PRIMARY KEY, username VARCHAR(64) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_session (
  token_hash VARCHAR(64) PRIMARY KEY, owner_id VARCHAR(36) NOT NULL, expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES app_user(id)
);
CREATE TABLE IF NOT EXISTS story_project (
  id VARCHAR(36) PRIMARY KEY, owner_id VARCHAR(36) NOT NULL, title VARCHAR(120) NOT NULL,
  logline VARCHAR(1000) NOT NULL, genre VARCHAR(40) NOT NULL, target_duration INT NOT NULL,
  revision INT NOT NULL, archived BOOLEAN NOT NULL DEFAULT FALSE, document_json LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES app_user(id), INDEX ix_project_owner (owner_id,updated_at)
);
CREATE TABLE IF NOT EXISTS story_revision (
  project_id VARCHAR(36) NOT NULL, revision INT NOT NULL, snapshot_json LONGTEXT NOT NULL,
  summary VARCHAR(200) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(project_id,revision), FOREIGN KEY (project_id) REFERENCES story_project(id)
);
CREATE TABLE IF NOT EXISTS story_asset (
  id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL, owner_id VARCHAR(36) NOT NULL,
  file_name VARCHAR(220) NOT NULL, storage_key VARCHAR(64) NOT NULL, mime_type VARCHAR(40) NOT NULL,
  size_bytes BIGINT NOT NULL, width INT NOT NULL, height INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES story_project(id), FOREIGN KEY (owner_id) REFERENCES app_user(id)
);
CREATE TABLE IF NOT EXISTS story_conversation (
  project_id VARCHAR(36) PRIMARY KEY, owner_id VARCHAR(36) NOT NULL,
  version INT NOT NULL, base_revision INT NOT NULL,
  draft_json LONGTEXT NOT NULL, messages_json LONGTEXT NOT NULL,
  request_id VARCHAR(36), pending_prompt VARCHAR(5000), processing_until TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES story_project(id), FOREIGN KEY (owner_id) REFERENCES app_user(id)
);
CREATE TABLE IF NOT EXISTS story_voice_binding (
  project_id VARCHAR(36) NOT NULL, character_id VARCHAR(64) NOT NULL,
  voice_id VARCHAR(40) NOT NULL, version INT NOT NULL,
  PRIMARY KEY(project_id,character_id), FOREIGN KEY (project_id) REFERENCES story_project(id)
);
CREATE TABLE IF NOT EXISTS story_speech_job (
  id VARCHAR(36) PRIMARY KEY, project_id VARCHAR(36) NOT NULL, owner_id VARCHAR(36) NOT NULL,
  shot_id VARCHAR(80) NOT NULL, dialogue_id VARCHAR(64) NOT NULL, character_id VARCHAR(64) NOT NULL,
  character_name VARCHAR(60) NOT NULL, text VARCHAR(1000) NOT NULL, emotion VARCHAR(200) NOT NULL,
  speed DOUBLE NOT NULL, voice_id VARCHAR(40) NOT NULL, project_revision INT NOT NULL,
  fingerprint VARCHAR(64) NOT NULL, status VARCHAR(20) NOT NULL, error_message VARCHAR(300) NOT NULL,
  storage_key VARCHAR(64) NOT NULL, duration_seconds DOUBLE NOT NULL, claim_token VARCHAR(36), lease_until TIMESTAMP NULL,
  created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL,
  FOREIGN KEY (project_id) REFERENCES story_project(id), FOREIGN KEY (owner_id) REFERENCES app_user(id),
  INDEX ix_speech_queue(status,created_at), INDEX ix_speech_project(project_id,created_at)
);
CREATE TABLE IF NOT EXISTS story_writing_memory (
  project_id VARCHAR(36) PRIMARY KEY, owner_id VARCHAR(36) NOT NULL,
  requirements_json LONGTEXT NOT NULL, summary LONGTEXT NOT NULL,
  suggestions_json LONGTEXT NOT NULL, revoked_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES story_project(id), FOREIGN KEY (owner_id) REFERENCES app_user(id)
);
