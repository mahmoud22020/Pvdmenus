const express = require('express');
const path = require('path');

// Load JWT_SECRET from environment - venues share the same secret for AY-AD interop
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'your-secret-key-change-this-in-production';
}

// Import backend routes so they read directly from PostgreSQL
// Frontend-compatible intro/simple endpoints
const mosaicoApiRouter = require('./Mosaico/backend/routes/api');
const hikayatApiRouter = require('./Hikayat/backend/routes/api');

// Admin / management endpoints (auth, categories, items, intro-config, day-pricing, translations)
const mosaicoAuthRouter = require('./Mosaico/backend/routes/auth');
const mosaicoCategoriesRouter = require('./Mosaico/backend/routes/categories');
const mosaicoItemsRouter = require('./Mosaico/backend/routes/items');
const mosaicoIntroRouter = require('./Mosaico/backend/routes/intro');
const mosaicoDayPricingRouter = require('./Mosaico/backend/routes/day-pricing');
const mosaicoTranslationsRouter = require('./Mosaico/backend/routes/translations');

const hikayatAuthRouter = require('./Hikayat/backend/routes/auth');
const hikayatCategoriesRouter = require('./Hikayat/backend/routes/categories');
const hikayatItemsRouter = require('./Hikayat/backend/routes/items');
const hikayatIntroRouter = require('./Hikayat/backend/routes/intro');
const hikayatDayPricingRouter = require('./Hikayat/backend/routes/day-pricing');
const hikayatTranslationsRouter = require('./Hikayat/backend/routes/translations');

// Central AY-AD auth (shared users, assigns venues)
const ayadAuthRouter = require('./AY-AD/ayad-auth');

const app = express();
const PORT = 5050;

// Allow JSON bodies for admin APIs
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static assets for the whole workspace (landing + Mosaico + Hikayat + AY-AD)
app.use(express.static(__dirname));

// Root landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Nice short URLs for each venue menu
app.get('/mosaico', (req, res) => {
  res.sendFile(path.join(__dirname, 'Mosaico', 'index.html'));
});

app.get('/hikayat', (req, res) => {
  res.sendFile(path.join(__dirname, 'Hikayat', 'index.html'));
});

// AY-AD admin panel
app.get('/AY-AD', (req, res) => {
  res.sendFile(path.join(__dirname, 'AY-AD', 'index.html'));
});

// AY-AD auth API
app.use('/AY-AD/api/auth', ayadAuthRouter);

// --- API ROUTES ---

// Guest-facing APIs (intro.php + simple.php) backed by PostgreSQL
app.use('/mosaico/api', mosaicoApiRouter);
app.use('/hikayat/api', hikayatApiRouter);

// Mosaico admin APIs (used by AY-AD)
app.use('/mosaico/api/auth', mosaicoAuthRouter);
app.use('/mosaico/api/categories', mosaicoCategoriesRouter);
app.use('/mosaico/api/items', mosaicoItemsRouter);
app.use('/mosaico/api/intro-config', mosaicoIntroRouter);
app.use('/mosaico/api/day-pricing', mosaicoDayPricingRouter);
app.use('/mosaico/api/translations', mosaicoTranslationsRouter);

// Hikayat admin APIs (used by AY-AD)
app.use('/hikayat/api/auth', hikayatAuthRouter);
app.use('/hikayat/api/categories', hikayatCategoriesRouter);
app.use('/hikayat/api/items', hikayatItemsRouter);
app.use('/hikayat/api/intro-config', hikayatIntroRouter);
app.use('/hikayat/api/day-pricing', hikayatDayPricingRouter);
app.use('/hikayat/api/translations', hikayatTranslationsRouter);

// Basic health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'pvd-menus-root', message: 'Root server is running' });
});

// 404 fallback (for now just JSON; can be replaced with a custom page)
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Palazzo Versace Dubai root server`);
  console.log(`📡 Listening on http://0.0.0.0:${PORT}`);
  console.log(`   - Landing:  /`);
  console.log(`   - Mosaico:  /mosaico`);
  console.log(`   - Hikayat:  /hikayat (DB-backed)`);
  console.log(`   - Admin:    /AY-AD (controls both venues)\n`);
});

 