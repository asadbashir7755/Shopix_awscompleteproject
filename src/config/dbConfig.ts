/**
 * MySQL Database Connection
 *
 * Re-exports the shared mysql2 connection pool from src/lib/db.ts.
 * All database access in this application uses MySQL via mysql2/promise.
 *
 * Legacy MongoDB/Mongoose code has been fully removed.
 */
export { default as pool, default as connectDB } from "../lib/db";
