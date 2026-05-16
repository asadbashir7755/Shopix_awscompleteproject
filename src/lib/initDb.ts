import fs from 'fs';
import path from 'path';
import pool from './db';

let initPromise: Promise<void> | null = null;

export async function initDb() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
  try {
    console.log('🔄 Initializing database...');

    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Remove SQL line comments before splitting statements.
    // This prevents skipping CREATE statements that appear after comment lines.
    const cleanedSQL = schemaSQL
      .split('\n')
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n');

    // Split by semicolon to get individual statements
    const statements = cleanedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      try {
        await pool.execute(statement);
        console.log('✅ Table created successfully');
      } catch (error: any) {
        // Check if it's a "table already exists" error, which is OK
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log('ℹ️  Table already exists, skipping...');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR' || /access denied/i.test(error.message)) {
          // If credentials are invalid, log and stop initialization without throwing to avoid build-time failure
          console.error('❌ Access denied when creating tables:', error.message);
          return;
        } else if (error.code === 'ECONNREFUSED' || /connect.*refused/i.test(error.message)) {
          console.error('❌ Database connection refused:', error.message);
          return;
        } else {
          console.error('❌ Error creating table:', error.message);
          return;
        }
      }
    }

    console.log('✅ Database initialization completed successfully');
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    return;
  }
  })();

  return initPromise;
}