const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Connect to pvd_admin database
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'pvd_admin',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Mido2023',
});

async function createManagers() {
  try {
    console.log('🔐 Creating manager users in AY-AD system...\n');

    // Create PVDADMIN (Super Admin - Both Restaurants)
    const pvdadminExists = await pool.query(
      "SELECT id FROM ayad_users WHERE username = 'PVDADMIN'"
    );

    if (pvdadminExists.rowCount === 0) {
      const pvdadminHash = await bcrypt.hash('Versace@#2026', 10);
      await pool.query(
        `INSERT INTO ayad_users 
          (username, password_hash, full_name, role, can_mosaico, can_hikayat)
         VALUES ($1, $2, $3, 'admin', TRUE, TRUE)`,
        ['PVDADMIN', pvdadminHash, 'Palazzo Versace Super Admin']
      );
      console.log('✅ Created PVDADMIN user:');
      console.log('   Username: PVDADMIN');
      console.log('   Password: Versace@#2026');
      console.log('   Access: Both Mosaico & Hikayat (Super Admin)\n');
    } else {
      console.log('⚠️  PVDADMIN already exists\n');
    }

    // Create MOSMGR (Mosaico Manager)
    const mosmgrExists = await pool.query(
      "SELECT id FROM ayad_users WHERE username = 'MOSMGR'"
    );

    if (mosmgrExists.rowCount === 0) {
      const mosmgrHash = await bcrypt.hash('Versace@#2026', 10);
      await pool.query(
        `INSERT INTO ayad_users 
          (username, password_hash, full_name, role, can_mosaico, can_hikayat)
         VALUES ($1, $2, $3, 'manager', TRUE, FALSE)`,
        ['MOSMGR', mosmgrHash, 'Mosaico Restaurant Manager']
      );
      console.log('✅ Created MOSMGR user:');
      console.log('   Username: MOSMGR');
      console.log('   Password: Versace@#2026');
      console.log('   Access: Mosaico only\n');
    } else {
      console.log('⚠️  MOSMGR already exists\n');
    }

    // Create HIKMGR (Hikayat Manager)
    const hikmgrExists = await pool.query(
      "SELECT id FROM ayad_users WHERE username = 'HIKMGR'"
    );

    if (hikmgrExists.rowCount === 0) {
      const hikmgrHash = await bcrypt.hash('Versace@#2026', 10);
      await pool.query(
        `INSERT INTO ayad_users 
          (username, password_hash, full_name, role, can_mosaico, can_hikayat)
         VALUES ($1, $2, $3, 'manager', FALSE, TRUE)`,
        ['HIKMGR', hikmgrHash, 'Hikayat Restaurant Manager']
      );
      console.log('✅ Created HIKMGR user:');
      console.log('   Username: HIKMGR');
      console.log('   Password: Versace@#2026');
      console.log('   Access: Hikayat only\n');
    } else {
      console.log('⚠️  HIKMGR already exists\n');
    }

    console.log('📋 Summary of all AY-AD users:');
    const allUsers = await pool.query(
      'SELECT username, full_name, role, can_mosaico, can_hikayat FROM ayad_users ORDER BY id'
    );
    console.table(allUsers.rows);

    await pool.end();
    console.log('\n✅ Manager users setup complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error creating managers:', err);
    process.exit(1);
  }
}

createManagers();
