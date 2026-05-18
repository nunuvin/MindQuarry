export default function Home() {
  return (
    <div className="min-h-full p-8 sm:p-12">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <section className="rounded-2xl border bg-card p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            MindQuarry
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            A Q&amp;A workspace modeled after Stack Overflow.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Authentication, typed PostgreSQL access, and user profiles are wired up. The next step is building the core question, answer, voting, and moderation flows.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Auth</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Better Auth is configured with username and admin plugins.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Database</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Kysely is connected to PostgreSQL and typed against the `mqauth` schema.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Current Focus</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Replace scaffolding with the real home feed and question detail routes.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
