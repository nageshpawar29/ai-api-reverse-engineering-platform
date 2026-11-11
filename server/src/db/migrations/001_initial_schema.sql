-- AI API Reverse-Engineering Platform Schema
-- Migration 001: Initial Schema

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    framework VARCHAR(100) DEFAULT 'express',
    language VARCHAR(50) DEFAULT 'typescript',
    source_type VARCHAR(50) NOT NULL, -- 'zip' or 'github'
    repository_url TEXT,
    storage_path TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'analyzing', 'completed', 'failed'
    current_step VARCHAR(100),
    progress_percentage INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_sources (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    file_count INT DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    commit_hash VARCHAR(64),
    branch VARCHAR(100),
    archive_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analysis_runs (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed'
    duration_ms INT,
    endpoints_count INT DEFAULT 0,
    models_count INT DEFAULT 0,
    findings_count INT DEFAULT 0,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'route', 'controller', 'middleware', 'model', 'service', 'config', 'other'
    line_count INT DEFAULT 0,
    size_bytes INT DEFAULT 0,
    ast_parsed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_endpoints (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE, PATCH, etc.
    path TEXT NOT NULL,
    summary TEXT,
    description TEXT,
    purpose TEXT,
    controller_name VARCHAR(255),
    handler_function VARCHAR(255),
    source_file TEXT NOT NULL,
    line_start INT,
    line_end INT,
    auth_required BOOLEAN DEFAULT FALSE,
    auth_type VARCHAR(100), -- 'bearer', 'jwt', 'apiKey', 'basic', 'none'
    detection_type VARCHAR(20) DEFAULT 'DETECTED', -- 'DETECTED', 'INFERRED', 'UNKNOWN'
    confidence_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parameters (
    id VARCHAR(36) PRIMARY KEY,
    endpoint_id VARCHAR(36) REFERENCES api_endpoints(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    param_in VARCHAR(50) NOT NULL, -- 'path', 'query', 'header', 'body'
    data_type VARCHAR(50) DEFAULT 'string',
    required BOOLEAN DEFAULT FALSE,
    description TEXT,
    default_value TEXT,
    schema_definition JSONB,
    detection_type VARCHAR(20) DEFAULT 'DETECTED'
);

CREATE TABLE IF NOT EXISTS responses (
    id VARCHAR(36) PRIMARY KEY,
    endpoint_id VARCHAR(36) REFERENCES api_endpoints(id) ON DELETE CASCADE,
    status_code INT NOT NULL,
    description TEXT,
    content_type VARCHAR(100) DEFAULT 'application/json',
    schema_definition JSONB,
    example_payload JSONB,
    detection_type VARCHAR(20) DEFAULT 'DETECTED'
);

CREATE TABLE IF NOT EXISTS models (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    table_name VARCHAR(255),
    orm_type VARCHAR(50), -- 'prisma', 'sequelize', 'mongoose', 'typeorm'
    source_file TEXT,
    description TEXT,
    detection_type VARCHAR(20) DEFAULT 'DETECTED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_fields (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(36) REFERENCES models(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    field_type VARCHAR(100) NOT NULL,
    is_primary_key BOOLEAN DEFAULT FALSE,
    is_nullable BOOLEAN DEFAULT TRUE,
    is_unique BOOLEAN DEFAULT FALSE,
    default_value TEXT,
    foreign_key_target VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS dependencies (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- 'route', 'controller', 'service', 'model'
    source_id VARCHAR(255) NOT NULL,
    target_type VARCHAR(50) NOT NULL, -- 'controller', 'service', 'model', 'external'
    target_id VARCHAR(255) NOT NULL,
    relation_type VARCHAR(50) NOT NULL, -- 'calls', 'uses', 'queries', 'imports'
    details TEXT
);

CREATE TABLE IF NOT EXISTS security_findings (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    endpoint_id VARCHAR(36) REFERENCES api_endpoints(id) ON DELETE SET NULL,
    severity VARCHAR(20) NOT NULL, -- 'critical', 'high', 'medium', 'low', 'info'
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    source_file TEXT NOT NULL,
    line_number INT,
    recommendation TEXT NOT NULL,
    detection_type VARCHAR(20) DEFAULT 'DETECTED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generated_artifacts (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL, -- 'openapi_json', 'openapi_yaml', 'postman_json', 'jest_tests'
    content TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    citations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default user
INSERT INTO users (id, name, email) 
VALUES ('default-user-id', 'Lead Developer', 'developer@reverse-api.local')
ON CONFLICT (id) DO NOTHING;

-- Auxiliary columns for 100% full-fidelity JSON object persistence
ALTER TABLE api_endpoints ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE models ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE dependencies ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE security_findings ADD COLUMN IF NOT EXISTS raw_data JSONB;

