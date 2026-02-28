import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;

const ssl = (process.env.PGSSLMODE || '').toLowerCase() === 'require'
  ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
  : undefined;

const ensureDatabaseExists = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing in server/.env');
  }

  const url = new URL(databaseUrl);
  const targetDb = url.pathname.replace(/^\//, '') || 'chromasnap';
  url.pathname = '/postgres';

  const adminClient = new Client({
    connectionString: url.toString(),
    ssl,
  });

  await adminClient.connect();
  const existsResult = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);

  if ((existsResult.rowCount ?? 0) === 0) {
    const safeDbName = targetDb.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeDbName) {
      throw new Error(`Invalid database name derived from DATABASE_URL: ${targetDb}`);
    }
    await adminClient.query(`CREATE DATABASE "${safeDbName}"`);
    console.log('DATABASE_CREATED', safeDbName);
  } else {
    console.log('DATABASE_ALREADY_EXISTS', targetDb);
  }

  await adminClient.end();
};

const testQuery = async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl,
  });

  await client.connect();
  const result = await client.query('SELECT 1 AS ok');
  console.log('POSTGRES_OK', result.rows[0]?.ok);
  await client.end();
};

const run = async () => {
  await ensureDatabaseExists();
  await testQuery();
};

run().catch((error) => {
  console.error('POSTGRES_TEST_FAIL', error.message);
  process.exit(1);
});
