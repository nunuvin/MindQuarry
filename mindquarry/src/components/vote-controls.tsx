type VoteControlsProps = {
    score: number | null | undefined;
    action: (formData: FormData) => void | Promise<void>;
    fields?: Record<string, string>;
    compact?: boolean;
};

export function VoteControls({ score, action, fields = {}, compact = false }: VoteControlsProps) {
    const buttonClassName = compact
        ? "w-8 h-8 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-black text-base flex items-center justify-center cursor-pointer transition-colors"
        : "w-10 h-10 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-black text-xl flex items-center justify-center cursor-pointer transition-colors shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]";

    return (
        <div className={`flex flex-col items-center justify-start ${compact ? "gap-1 min-w-[52px]" : "gap-2"}`}>
            <form action={action}>
                {Object.entries(fields).map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={value} />
                ))}
                <input type="hidden" name="value" value="1" />
                <button type="submit" aria-label="Upvote" className={buttonClassName}>
                    ▲
                </button>
            </form>
            <span className={compact ? "font-black text-base" : "text-2xl font-black"}>{score ?? 0}</span>
            <form action={action}>
                {Object.entries(fields).map(([name, value]) => (
                    <input key={name} type="hidden" name={name} value={value} />
                ))}
                <input type="hidden" name="value" value="-1" />
                <button type="submit" aria-label="Downvote" className={`${buttonClassName} text-red-500 hover:text-red-500`}>
                    ▼
                </button>
            </form>
        </div>
    );
}