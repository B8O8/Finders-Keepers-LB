import { execSync } from 'node:child_process';
import { Client } from 'pg';

/**
 * Creates a disposable database for the e2e suite and applies the real
 * migrations to it.
 *
 * The suite needs a genuinely empty database each run, but "drop the database"
 * is exactly the operation that must never touch development or production
 * data. So the target name is pinned: this refuses to run against anything not
 * named `finders_keepers_e2e`, and that is a hard error rather than a
 * convention someone can quietly break later.
 *
 * Migrations are applied with `prisma migrate deploy` - the same command the
 * container runs on boot - and never `migrate reset` or `db push`. That means
 * the suite exercises the actual migration files, so a broken migration fails
 * here rather than in production.
 */
const E2E_DB_NAME = 'finders_keepers_e2e';

export default async function globalSetup() {
  const target = process.env.E2E_DATABASE_URL;

  if (!target) {
    throw new Error(
      'E2E_DATABASE_URL is not set.\n\n' +
        'Start the test database and point the suite at it:\n' +
        '  docker compose -f docker-compose.yml -f docker-compose.test.yml up -d postgres\n' +
        `  set E2E_DATABASE_URL=postgresql://<user>:<password>@localhost:15432/${E2E_DB_NAME}\n\n` +
        'Use your LOCAL database credentials. Never point this at production.',
    );
  }

  const url = new URL(target);
  const dbName = decodeURIComponent(url.pathname).replace(/^\//, '');

  if (dbName !== E2E_DB_NAME) {
    throw new Error(
      `Refusing to run: E2E_DATABASE_URL points at database "${dbName}".\n` +
        `This setup DROPS its target database, so it only accepts "${E2E_DB_NAME}".`,
    );
  }

  // Connect to the maintenance database - you cannot drop a database you are
  // currently connected to.
  const maintenanceUrl = new URL(target);
  maintenanceUrl.pathname = '/postgres';

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();

  try {
    // FORCE terminates any leftover connection from a previous crashed run,
    // which would otherwise make DROP hang indefinitely. Requires PG 13+.
    await client.query(`DROP DATABASE IF EXISTS "${E2E_DB_NAME}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${E2E_DB_NAME}"`);
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: target },
  });

  // Inherited by the Jest workers, which are forked after this runs.
  process.env.DATABASE_URL = target;
}
