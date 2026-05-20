-- Core tables for Better Auth in the mq_auth schema

CREATE USER IF NOT EXISTS mqauth_user WITH PASSWORD 'your_strong_password_here';

-- Create schema
CREATE SCHEMA IF NOT EXISTS mq_auth AUTHORIZATION mqauth_user;

-- User table
CREATE TABLE IF NOT EXISTS mq_auth."user" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "emailVerified" BOOLEAN,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "username" VARCHAR(255) UNIQUE,
    "displayUsername" VARCHAR(255),
    "role" VARCHAR(255) DEFAULT 'user',
    "banned" BOOLEAN DEFAULT FALSE,
    "banReason" TEXT,
    "banExpires" TIMESTAMPTZ
);

-- Session table
CREATE UNLOGGED TABLE IF NOT EXISTS mq_auth."session" (
    "id" VARCHAR(255) PRIMARY KEY,
    "userId" VARCHAR(255) NOT NULL REFERENCES mq_auth."user"("id") ON DELETE CASCADE,
    "token" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "ipAddress" VARCHAR(255),
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "impersonatedBy" VARCHAR(255)
);

-- Account table
CREATE TABLE IF NOT EXISTS mq_auth."account" (
    "id" VARCHAR(255) PRIMARY KEY,
    "userId" VARCHAR(255) NOT NULL REFERENCES mq_auth."user"("id") ON DELETE CASCADE,
    "accountId" VARCHAR(255) NOT NULL,
    "providerId" VARCHAR(255) NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ,
    "refreshTokenExpiresAt" TIMESTAMPTZ,
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verification table
CREATE TABLE IF NOT EXISTS mq_auth."verification" (
    "id" VARCHAR(255) PRIMARY KEY,
    "identifier" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Grant privileges
GRANT USAGE ON SCHEMA mq_auth TO mqauth_user;
GRANT CREATE ON SCHEMA mq_auth TO mqauth_user;

-- 3. (Optional) Grant privileges on all tables in schema (run after tables are created)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mq_auth TO mqauth_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA mq_auth GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mqauth_user;

-- 4. (Optional) Make mqauth_user the owner of all tables (run after tables are created)
ALTER TABLE mq_auth."user" OWNER TO mqauth_user;
ALTER TABLE mq_auth."session" OWNER TO mqauth_user;
ALTER TABLE mq_auth."account" OWNER TO mqauth_user;
ALTER TABLE mq_auth."verification" OWNER TO mqauth_user;
