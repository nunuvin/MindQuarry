import { db } from "./db";

export async function enqueueJob(jobType: string, payload: unknown) {
    await db.insertInto("background_jobs").values({
        job_type: jobType,
        payload: payload,
    }).execute();
}

/**
 * Call this function somewhere on server start, or inside a dedicated worker process.
 */
export function startWorker() {
    let isShuttingDown = false;

    async function poll() {
        if (isShuttingDown) return;

        try {
            // SKIP LOCKED is critical for concurrency
            const job = await db.transaction().execute(async (trx) => {
                const lockedJob = await trx.selectFrom("background_jobs")
                    .selectAll()
                    .where("status", "=", "pending")
                    .orderBy("created_at", "asc")
                    .limit(1)
                    .forUpdate()
                    .skipLocked()
                    .executeTakeFirst();

                if (!lockedJob) return null;

                // Mark as processing
                await trx.updateTable("background_jobs")
                    .set({
                        status: "processing",
                        locked_at: new Date(),
                        locked_by: "worker_process" // In reality, process.pid or pod id
                    })
                    .where("id", "=", lockedJob.id)
                    .execute();

                return lockedJob;
            });

            if (job) {
                try {
                    // Process the job
                    console.log(`Processing job ${job.id} of type ${job.job_type}`);
                    // Add your job processing logic here...
                    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work

                    // Mark as completed
                    await db.updateTable("background_jobs")
                        .set({ status: "completed" })
                        .where("id", "=", job.id)
                        .execute();
                } catch (err) {
                    console.error(`Job ${job.id} failed:`, err);
                    await db.updateTable("background_jobs")
                        .set({ status: "failed" })
                        .where("id", "=", job.id)
                        .execute();
                }

                // Immediately poll again if we found a job
                setImmediate(poll);
            } else {
                // Sleep if no jobs
                setTimeout(poll, 5000);
            }
        } catch (e) {
            console.error("Worker poll error", e);
            setTimeout(poll, 5000);
        }
    }

    poll();

    return () => {
        isShuttingDown = true;
    };
}
