import dotenv from 'dotenv';
import path from 'path';

// Load env for local/dev first, then fallback to .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  try {
    const { initDb } = await import('../src/lib/initDb');
    const { seedDatabase } = await import('../src/lib/seed');
    const { default: pool } = await import('../src/lib/db');

    const force = String(process.env.SEED_FORCE || '').toLowerCase() === 'true';
    const envName = process.env.NODE_ENV || 'development';

    console.log(`🌱 Starting MySQL seed (${envName})...`);
    console.log(`📦 DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    console.log(`♻️  Force reseed: ${force ? 'ON' : 'OFF'}`);

    await initDb();
    await seedDatabase({ force });

    console.log('✅ Seed completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seed failed:', error?.message || error);
    try {
      const { default: pool } = await import('../src/lib/db');
      await pool.end();
    } catch {
      // ignore close errors
    }
    process.exit(1);
  }
}

run();