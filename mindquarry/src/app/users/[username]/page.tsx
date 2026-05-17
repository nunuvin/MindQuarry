
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function UserProfilePage({ params }: { params: { username: string } }) {
    // Get headers as a plain object for Better Auth
    const rawHeaders = await headers();
    const headerObj: Record<string, string> = {};
    for (const [key, value] of rawHeaders.entries()) {
        headerObj[key] = value;
    }
    const session = await auth.api.getSession({ headers: headerObj });
    if (!session?.user) {
        redirect("/login");
    }

    // Fetch user by username from the database
    const user = await db.selectFrom("user")
        .select(["id", "name", "image", "createdAt", "displayUsername", "username"])
        .where("username", "=", params.username)
        .executeTakeFirst();

    if (!user) return notFound();

    // Dummy stats
    const postCount = 12;
    const upvotes = 42;

    return (
        <div className="max-w-xl mx-auto mt-12 p-6 bg-card rounded-lg shadow flex flex-col gap-6 border">
            <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border overflow-hidden">
                    {user.image ? (
                        <Image src={user.image} alt="avatar" width={80} height={80} className="object-cover h-20 w-20" />
                    ) : (
                        <span className="text-4xl text-muted-foreground">👤</span>
                    )}
                </div>
                <div>
                    <div className="text-2xl font-bold">{user.displayUsername || user.username || user.name}</div>
                    <div className="text-muted-foreground text-sm mt-1">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                </div>
            </div>
            <div className="flex gap-8 mt-4">
                <div className="flex flex-col items-center">
                    <span className="text-lg font-semibold">{postCount}</span>
                    <span className="text-muted-foreground text-xs">Posts</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-lg font-semibold">{upvotes}</span>
                    <span className="text-muted-foreground text-xs">Upvotes</span>
                </div>
            </div>
        </div>
    );
}


