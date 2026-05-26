import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { generateUUID } from "@/lib/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { seedQuarryDefaultTags } from "@/lib/tags";
import { isRateLimited } from "@/lib/rateLimit";
import { MindQuarryConfig } from "@/lib/config";

export default async function NewQuarryPage() {
    const rawHeaders = await headers();
    const session = await auth.api.getSession({ headers: rawHeaders });
    if (!session?.user) redirect("/login");

    const settings = await getSiteSettings();
    if (settings?.simplified_mode_enabled) {
        redirect("/q");
    }

    async function createQuarry(formData: FormData) {
        "use server";
        const rawHeaders = await headers();
        const session = await auth.api.getSession({ headers: rawHeaders });
        if (!session?.user) return;

        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const visibility = (formData.get("visibility") as string) || "public";
        const is_invite_only = visibility === "members";
        const allow_user_tags = formData.get("allow_user_tags") === "on";

        if (isRateLimited(
            session.user.id,
            "create_quarry",
            MindQuarryConfig.QUARRIES.MAX_NEW_QUARRIES_PER_MIN,
            MindQuarryConfig.RATE_LIMIT_WINDOW_MS,
        )) {
            console.warn(`User ${session.user.id} rate limited on quarry creation.`);
            return;
        }

        if (!name || name.includes(" ")) {
            return; // In real app, return form error
        }

        let newQuarryName: string | null = null;
        try {
            const quarry = await db.insertInto("quarries").values({
                id: generateUUID(),
                name: name.toLowerCase(),
                description,
                is_invite_only,
                visibility,
                allow_user_tags,
            }).returning(["id", "name"]).executeTakeFirst();

            if (quarry) {
                // Assign creator as admin
                await db.insertInto("quarry_members").values({
                    quarry_id: quarry.id,
                    user_id: session.user.id,
                    role: 'admin'
                }).execute();

                await seedQuarryDefaultTags(quarry.id, quarry.name || name.toLowerCase());

                newQuarryName = quarry.name;
            }
        } catch (e) {
            console.error("Failed to create quarry", e);
        }

        if (newQuarryName) {
            redirect(`/q/${newQuarryName}`);
        }
    }

    return (
        <div className="page-shell max-w-3xl">
            <div className="soft-panel p-8 sm:p-10">
                <h1 className="font-display mb-6 border-b border-border/70 pb-3 text-3xl font-semibold tracking-tight">Create a New Quarry</h1>
                <form action={createQuarry} className="space-y-6">
                    <div>
                        <label className="mb-2 block text-sm font-semibold">Quarry Name</label>
                        <input name="name" required pattern="[a-zA-Z0-9_-]+" title="No spaces allowed" className="w-full rounded-2xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" placeholder="e.g. javascript" />
                        <p className="text-xs text-muted-foreground mt-1">No spaces. Will be accessed via /q/name</p>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-semibold">Description</label>
                        <textarea name="description" rows={4} className="w-full rounded-3xl border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500" placeholder="What is this community about?"></textarea>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-semibold">Visibility</label>
                        <select name="visibility" defaultValue="public" className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-sky-500">
                            <option value="public">Public</option>
                            <option value="authenticated">Signed-in users only</option>
                            <option value="members">Members only</option>
                        </select>
                        <p className="mt-2 text-xs text-muted-foreground">Members-only quarries behave like invite-only spaces. Public remains the default.</p>
                    </div>
                    <label className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm font-medium">
                        <input type="checkbox" name="allow_user_tags" className="h-4 w-4" />
                        Allow members to create new tags when posting
                    </label>
                    <button type="submit" className="soft-button-primary w-full justify-center rounded-full py-3">
                        Create Quarry
                    </button>
                </form>
            </div>
        </div>
    );
}
