import { Pool } from 'pg';
import { config } from '../config.js';

const resetDatabase = async (): Promise<void> => {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL must be set to reset the PostgreSQL database');
  }

  const pool = new Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE
        activity_events,
        chunk_replicas,
        chunks,
        files,
        storage_nodes
      RESTART IDENTITY CASCADE
    `);

    for (const number of [1, 2, 3]) {
      await client.query(
        `INSERT INTO storage_nodes (id, name, status, capacity, used_space)
         VALUES ($1, $2, 'ONLINE', $3, 0)`,
        [`node-${number}`, `Node ${number}`, config.nodeCapacity],
      );
    }

    await client.query('COMMIT');
    console.log('Database reset complete. Metadata tables were cleared and default nodes were restored.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

try {
  await resetDatabase();
} catch (error) {
  console.error('Database reset failed:', error);
  process.exitCode = 1;
}
