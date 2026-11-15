import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

async function runMigration() {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || !database) {
    console.error(
      'Missing MySQL configuration. Please set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE in your environment.'
    );
    process.exit(1);
  }

  const schemaPath = path.resolve(process.cwd(), 'db', 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user,
    password: process.env.MYSQL_PASSWORD || '',
    database,
    multipleStatements: true,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  });

  try {
    console.log(`Applying MySQL 8 schema to ${host}/${database}...`);
    await connection.query(sql);
    console.log('MySQL 8 schema migration completed successfully.');
  } finally {
    await connection.end();
  }
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
