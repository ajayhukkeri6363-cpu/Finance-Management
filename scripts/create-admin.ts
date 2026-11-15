import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import mysql from 'mysql2/promise';
import { hashPassword } from '../server/auth.ts';

async function main() {
  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || !database) {
    console.error(
      'MySQL environment variables (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE) must be configured before creating an admin in MySQL.'
    );
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });
  try {
    const name = process.env.ADMIN_NAME || (await rl.question('Admin full name: '));
    const email = (process.env.ADMIN_EMAIL || (await rl.question('Admin email: '))).trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || (await rl.question('Admin password (min 10 chars): '));

    if (!name.trim() || !email.includes('@') || password.length < 10) {
      console.error('Invalid input: provide a name, valid email, and password of at least 10 characters.');
      process.exit(1);
    }

    const passwordHash = hashPassword(password);
    const connection = await mysql.createConnection({
      host,
      port: Number(process.env.MYSQL_PORT || 3306),
      user,
      password: process.env.MYSQL_PASSWORD || '',
      database,
      ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    });

    try {
      const [existing] = await connection.query<mysql.RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [email]
      );
      if (existing.length > 0) {
        console.error(`A user with email "${email}" already exists.`);
        process.exit(1);
      }

      const [res] = await connection.query<mysql.ResultSetHeader>(
        `INSERT INTO users (name, email, password_hash, role, department_id, is_active, is_demo)
         VALUES (?, ?, ?, 'admin', NULL, 1, 0)`,
        [name.trim(), email, passwordHash]
      );

      await connection.query(
        `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, department_id, action, entity_type, entity_id, summary)
         VALUES (?, ?, 'admin', NULL, 'CREATE_ADMIN_CLI', 'user', ?, ?)`,
        [res.insertId, name.trim(), res.insertId, `Initial admin account provisioned via CLI for ${email}`]
      );

      console.log(`Admin user "${email}" created successfully (user ID ${res.insertId}).`);
    } finally {
      await connection.end();
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Failed to create admin user:', err);
  process.exit(1);
});
