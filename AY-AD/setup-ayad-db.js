const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Connect to default postgres DB as superuser to create AY-AD DB
const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Mido2023',
});

async function run() {
  try {
    console.log('🔐 Setting up AY-AD admin database (pvd_admin)...');

    // 1) Create database pvd_admin if it doesn't exist
    await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'pvd_admin'"
    ).then(async (res) => {
      if (res.rowCount === 0) {
        console.log('  • Creating database pvd_admin');
        await adminPool.query('CREATE DATABASE pvd_admin');
      } else {
        console.log('  • Database pvd_admin already exists');
      }
    });

    // 2) Connect to pvd_admin to create ayad_users table + seed user
    const ayadPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: 'pvd_admin',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'Mido2023',
    });

    await ayadPool.query(`
      CREATE TABLE IF NOT EXISTS ayad_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name VARCHAR(150),
        role VARCHAR(20) DEFAULT 'manager',
        can_mosaico BOOLEAN DEFAULT FALSE,
        can_hikayat BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const existing = await ayadPool.query(
      "SELECT id FROM ayad_users WHERE username = 'AYADMIN'"
    );

    if (existing.rowCount === 0) {
      const hash = await bcrypt.hash('Versace@#2026', 10);
      await ayadPool.query(
        `INSERT INTO ayad_users 
          (username, password_hash, full_name, role, can_mosaico, can_hikayat)
         VALUES ($1, $2, $3, 'admin', TRUE, TRUE)`,
        ['AYADMIN', hash, 'Palazzo Versace Super Admin']
      );
      console.log(
        '  • Seeded default AY-AD admin user: AYADMIN / Versace@#2026'
      );
    } else {
      console.log('  • AYADMIN already exists in pvd_admin. No changes.');
    }

    await ayadPool.end();
    await adminPool.end();

    console.log('\n✅ AY-AD admin database (pvd_admin) is ready.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Failed to setup AY-AD database:', err);
    process.exit(1);
  }
}

run();

