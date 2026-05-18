// src/lib/authHelpers.ts

import { auth } from "./auth";
import { headers } from "next/headers";

// Server-side session check
export async function isLoggedIn(): Promise<boolean> {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    return !!session?.user;
}
