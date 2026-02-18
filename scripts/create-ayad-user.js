const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  const [usernameArg, passwordArg, nameArg, venuesArg, roleArg] = process.argv.slice(2);

  if (!usernameArg || !passwordArg) {
    console.log('Usage: node scripts/create-ayad-user.js <username> <password> [fullName] [venues=all|mosaico|hikayat] [role=manager|admin]');
    process.exit(1);
  }

  const username = usernameArg.trim().toUpperCase();
  const password = passwordArg.trim();
  const fullName = nameArg?.trim() || username;
  const venues = (venuesArg || 'all').toLowerCase();
  const role = (roleArg || 'manager').toLowerCase();

  const canMosaico = venues === 'all' || venues === 'both' || venues.includes('mosaico');
  const canHikayat = venues === 'all' || venues === 'both' || venues.includes('hikayat');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.AYAD_DB_NAME || 'pvd_admin',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Mido2023',
  });

  try {
    const hash = await bcrypt.hash(password, 10);
    const existing = await pool.query('SELECT id FROM ayad_users WHERE LOWER(username) = LOWER($1)', [username]);

    if (existing.rowCount > 0) {
      await pool.query(
        `UPDATE ayad_users
         SET password_hash = $1,
             full_name = $2,
             role = $3,
             can_mosaico = $4,
             can_hikayat = $5,
             updated_at = NOW()
         WHERE id = $6`,
        [hash, fullName, role, canMosaico, canHikayat, existing.rows[0].id]
      );
      console.log(`✓ Updated existing AY-AD user ${username}`);
    } else {
      await pool.query(
        `INSERT INTO ayad_users (username, password_hash, full_name, role, can_mosaico, can_hikayat)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [username, hash, fullName, role, canMosaico, canHikayat]
      );
      console.log(`✓ Created new AY-AD user ${username}`);
    }

    console.table([
      {
        username,
        fullName,
        role,
        canMosaico,
        canHikayat,
      },
    ]);
  } catch (err) {
    console.error('Failed to create/update AY-AD user:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
