import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

// Define your schema based on mqauth_init.sql
interface UserTable {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean | null;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
    username: string | null;
    displayUsername: string | null;
    role: string | null;
    banned: boolean | null;
    banReason: string | null;
    banExpires: Date | null;
}

interface SessionTable {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
    impersonatedBy: string | null;
}

interface AccountTable {
    id: string;
    userId: string;
    accountId: string;
    providerId: string;
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
    scope: string | null;
    idToken: string | null;
    password: string | null;
    createdAt: Date;
    updatedAt: Date;
}

interface VerificationTable {
    id: string;
    identifier: string;
    value: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface Database {
    user: UserTable;
    session: SessionTable;
    account: AccountTable;
    verification: VerificationTable;
}

const dialect = new PostgresDialect({
    pool: new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: false,
    }),
});

export const db = new Kysely<Database>({
    dialect,
}).withSchema("mqauth");;
