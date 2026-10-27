import { prisma } from '../config/prisma.js';
import { initDb } from '../config/initDb.js';

// Wipes every table in the public schema, then re-runs initDb() which recreates
// any missing tables/columns and re-seeds the default data.
async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DB_RESET !== 'true') {
    throw new Error('Refusing to reset a production database. Set ALLOW_DB_RESET=true to override.');
  }
  if (!process.argv.includes('--yes')) {
    throw new Error('This deletes ALL data. Re-run with --yes to confirm.');
  }

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  if (tables.length > 0) {
    const list = tables.map(t => `"public"."${t.tablename.replace(/"/g, '""')}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    console.log(`Truncated ${tables.length} tables.`);
  }

  await initDb();

  const [tenants, members, drills] = await Promise.all([
    prisma.customerTenant.count(),
    prisma.clubMember.count(),
    prisma.drill.count()
  ]);
  console.log(`Re-seeded: ${tenants} tenants, ${members} club members, ${drills} drills.`);
}

main()
  .catch(err => {
    console.error('Database reset failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
