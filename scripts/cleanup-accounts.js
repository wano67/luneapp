// Cleanup all personal finance data for a user using raw pg (bypasses Prisma adapter issues)
require('dotenv').config();
const pg = require('pg');

const EMAIL = 'diwano.67@gmail.com';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const poolConfig = { connectionString };

  // Force SSL with self-signed cert acceptance (Railway uses SSL)
  poolConfig.ssl = { rejectUnauthorized: false };

  const pool = new pg.Pool(poolConfig);
  const client = await pool.connect();

  try {
    // Find user
    const { rows: users } = await client.query(
      'SELECT id FROM "User" WHERE email = $1', [EMAIL]
    );
    if (!users.length) { console.log('User not found'); return; }

    const userId = users[0].id;
    console.log('User ID:', userId.toString());

    // Show current data
    const { rows: accounts } = await client.query(
      'SELECT id, name, type, "powensAccountId" FROM "PersonalAccount" WHERE "userId" = $1', [userId]
    );
    const { rows: [{ count: txCount }] } = await client.query(
      'SELECT count(*) FROM "PersonalTransaction" WHERE "userId" = $1', [userId]
    );
    const { rows: powensRows } = await client.query(
      'SELECT id FROM "PowensConnection" WHERE "userId" = $1', [userId]
    );

    console.log('Accounts:', accounts.length);
    for (const a of accounts) {
      console.log(' -', a.id.toString(), '|', a.name, '| type:', a.type, '| powens:', a.powensAccountId ?? 'manual');
    }
    console.log('Transactions:', txCount);
    console.log('Powens connection:', powensRows.length ? 'yes' : 'no');

    // Delete in correct order (foreign keys)
    const del = async (table, label) => {
      const { rowCount } = await client.query(
        `DELETE FROM "${table}" WHERE "userId" = $1`, [userId]
      );
      console.log(`Deleted ${label}: ${rowCount}`);
    };

    await del('PersonalTransaction', 'transactions');
    await del('PersonalBudget', 'budgets');
    await del('PersonalSubscription', 'subscriptions');
    await del('PersonalAccount', 'accounts');
    await del('PersonalCategory', 'categories');
    await del('PowensConnection', 'powens connection');

    console.log(`Done. All personal finance data wiped for ${EMAIL}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
