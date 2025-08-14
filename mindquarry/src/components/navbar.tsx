import { Input } from "@/components/ui/input";
import { SearchIcon, CornerDownLeft } from "lucide-react";
import UserMenu from "./user-menu";

export default function Navbar() {
    // TODO: Replace with real user session logic
    const user = typeof window !== "undefined" && window.localStorage.getItem("mockUser")
        ? JSON.parse(window.localStorage.getItem("mockUser")!)
        : undefined;

    return (
        <nav className="sticky top-0 z-50 shadow-3xs flex items-center justify-between p-4 border-b">
            <div><a href="/">MindQuarry</a></div>

            <div className="flex-grow px-16">
                <div className="relative flex items-center">
                    {/* Left icon */}
                    <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />

                    {/* Left divider */}
                    <div className="absolute left-8 top-2.5 h-5 w-px bg-muted-foreground opacity-50" />

                    {/* Input field */}
                    <Input
                        type="search"
                        placeholder="Search..."
                        className="pl-10 pr-10"
                    />

                    {/* Right divider */}
                    <div className="absolute right-8 top-2.5 h-5 w-px bg-muted-foreground opacity-50" />

                    {/* Right icon */}
                    <CornerDownLeft className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
            </div>

            <div className="ml-auto pr-4">
                <UserMenu user={user} />
            </div>
        </nav>
    );
}