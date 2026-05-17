// src/lib/authHelpers.ts

import { auth } from "./auth";
import { cookies } from "next/headers";

// Server-side session check
export async function isLoggedIn(): Promise<boolean> {
    const session = await auth.session.get({ cookies });
    return !!session?.user;
}
