import { betterAuth } from "better-auth";
import { username, admin } from "better-auth/plugins";
import { db } from "./db";

export const auth = betterAuth({
    database: { db },
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        username()
        , admin()
    ]
});

// export const auth = betterAuth({
//     database: { db },
//     email: {
//         signUp: true, // Enable email/password sign up
//     },
//     plugins: [username(), admin()],
// });

// console.log("Better Auth config (email):", JSON.stringify({ email: { signUp: true } }));