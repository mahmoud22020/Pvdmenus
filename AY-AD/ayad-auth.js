const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Shared AY-AD user store uses dedicated admin database
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  // Dedicated AY-AD admin DB for ALL restaurants (you asked for a separate DB)
  database: process.env.AYAD_DB_NAME || 'pvd_admin',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Mido2023',
  max: 5,
});

const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

const router = express.Router();

let schemaReady = false;

async function ensureSchemaAndSeed() {
  if (schemaReady) return;
  try {
    // Create table if not exists
    await pool.query(`
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

    // Seed a default super admin if missing
    const existing = await pool.query(
      'SELECT id FROM ayad_users WHERE username = $1',
      ['AYADMIN']
    );

    if (existing.rows.length === 0) {
      const defaultPassword = 'Versace@#2026';
      const hash = await bcrypt.hash(defaultPassword, 10);
      await pool.query(
        `INSERT INTO ayad_users 
          (username, password_hash, full_name, role, can_mosaico, can_hikayat)
         VALUES ($1, $2, $3, 'admin', TRUE, TRUE)`,
        ['AYADMIN', hash, 'Palazzo Versace Super Admin']
      );
      console.log(
        '\n[AY-AD] Seeded default admin user AYADMIN / Versace@#2026 (can manage Mosaico & Hikayat)\n'
      );
    }

    schemaReady = true;
  } catch (err) {
    console.error('[AY-AD] Error ensuring schema:', err);
  }
}

// POST /AY-AD/api/auth/login
router.post('/login', async (req, res) => {
  try {
    await ensureSchemaAndSeed();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Username and password are required',
      });
    }

    const result = await pool.query(
      'SELECT * FROM ayad_users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid credentials',
      });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid credentials',
      });
    }

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role || 'manager',
      can_mosaico: user.can_mosaico,
      can_hikayat: user.can_hikayat,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.json({
      ok: true,
      token,
      user: payload,
    });
  } catch (err) {
    console.error('AY-AD login error:', err);
    res.status(500).json({
      ok: false,
      error: 'Login failed',
    });
  }
});

module.exports = router;

 