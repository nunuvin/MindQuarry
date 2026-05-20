import { Client } from "pg";
import { EventEmitter } from "events";

export const chatEventEmitter = new EventEmitter();
chatEventEmitter.setMaxListeners(0); // Allow many clients

let pgClient: Client | null = null;
let isConnecting = false;

export async function getSharedPgListener() {
    if (pgClient) return pgClient;
    if (isConnecting) {
        // Wait briefly for connection to establish
        await new Promise(r => setTimeout(r, 100));
        if (pgClient) return pgClient;
    }

    isConnecting = true;
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false,
    });

    try {
        await client.connect();

        client.on("notification", (msg) => {
            if (msg.channel === "new_message_event" || msg.channel === "read_receipt_event") {
                chatEventEmitter.emit(msg.channel, msg.payload);
            }
        });

        await client.query("LISTEN new_message_event");
        await client.query("LISTEN read_receipt_event");

        client.on("error", (err) => {
            console.error("Shared PG listener error:", err);
            pgClient = null; // Reset to reconnect on next request
        });

        pgClient = client;
    } catch (e) {
        console.error("Failed to connect shared PG listener:", e);
    } finally {
        isConnecting = false;
    }

    return pgClient;
}
