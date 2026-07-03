/**
 * Admin Password Reset Script
 *
 * Usage (from finders-keepers-api folder):
 *   node scripts/reset-admin-password.js
 *
 * Or to reset directly without prompts:
 *   node scripts/reset-admin-password.js <email> <newPassword>
 *
 * Example:
 *   node scripts/reset-admin-password.js admin@example.com MyNewPass123
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const readline = require('readline');

// ── Config ────────────────────────────────────────────────────────────────────
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:root@localhost:5432/finders_keepers';

// ── Helpers ───────────────────────────────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let password = '';
    stdin.on('data', function handler(ch) {
      if (ch === '\n' || ch === '\r' || ch === '') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(password);
      } else if (ch === '') {
        process.exit();
      } else if (ch === '') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(question + '*'.repeat(password.length));
        }
      } else {
        password += ch;
        process.stdout.write('*');
      }
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('\n✅ Connected to database\n');

    // List all admins
    const { rows: admins } = await client.query(
      `SELECT id, email, "fullName", role, "isActive" FROM "Admin" ORDER BY "createdAt" ASC`
    );

    if (admins.length === 0) {
      console.log('⚠️  No admins found in the database.\n');
      console.log('Creating a new SUPER_ADMIN...\n');

      const email = process.argv[2] || await prompt('Email: ');
      const fullName = await prompt('Full Name: ');
      const password = process.argv[3] || await promptHidden('Password: ');

      const hash = await bcrypt.hash(password, 10);
      const result = await client.query(
        `INSERT INTO "Admin" (id, email, "fullName", password, role, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'SUPER_ADMIN', true, NOW(), NOW())
         RETURNING id, email, "fullName", role`,
        [email.toLowerCase(), fullName, hash]
      );
      console.log('\n✅ SUPER_ADMIN created:');
      console.table(result.rows);
      return;
    }

    console.log('Existing admins:');
    console.table(admins.map((a, i) => ({
      '#': i + 1,
      email: a.email,
      name: a.fullName || '—',
      role: a.role,
      active: a.isActive ? 'Yes' : 'No',
    })));

    // Get target email
    let targetEmail = process.argv[2];
    if (!targetEmail) {
      targetEmail = await prompt('Enter the email of the admin to reset (or press Enter for first): ');
      if (!targetEmail) targetEmail = admins[0].email;
    }

    const target = admins.find(
      (a) => a.email.toLowerCase() === targetEmail.toLowerCase()
    );

    if (!target) {
      console.error(`\n❌ No admin found with email: ${targetEmail}`);
      process.exit(1);
    }

    console.log(`\nResetting password for: ${target.email} (${target.role})`);

    // Get new password
    let newPassword = process.argv[3];
    if (!newPassword) {
      newPassword = await promptHidden('New password (min 6 chars): ');
    }

    if (!newPassword || newPassword.length < 6) {
      console.error('\n❌ Password must be at least 6 characters');
      process.exit(1);
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await client.query(
      `UPDATE "Admin"
       SET password = $1, "refreshToken" = NULL, "updatedAt" = NOW()
       WHERE id = $2`,
      [hash, target.id]
    );

    console.log(`\n✅ Password reset successfully for ${target.email}`);
    console.log('   Refresh token cleared (forces re-login on all devices)\n');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.message.includes('connect')) {
      console.error('   Make sure PostgreSQL is running and DATABASE_URL is correct.');
      console.error(`   Current: ${DATABASE_URL}`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
