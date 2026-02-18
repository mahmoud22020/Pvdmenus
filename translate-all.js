const { Pool } = require('pg');
const https = require('https');

// Function to translate text
async function translateText(text, targetLang) {
  if (!text) return '';
  
  return new Promise((resolve, reject) => {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.responseData && json.responseData.translatedText) {
            resolve(json.responseData.translatedText);
          } else {
            resolve(text); // Fallback to original
          }
        } catch (e) {
          resolve(text);
        }
      });
    }).on('error', () => resolve(text));
  });
}

// Delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Process one database
async function processDatabase(dbName) {
  console.log(`\n========== Processing ${dbName} ==========`);
  
  const pool = new Pool({
    user: 'postgres',
    password: 'Mido2023',
    host: 'localhost',
    database: dbName,
    port: 5432
  });

  try {
    // Get all categories
    const categoriesResult = await pool.query(
      'SELECT id, name FROM categories WHERE name IS NOT NULL AND name != \'\' ORDER BY id'
    );
    const categories = categoriesResult.rows;
    console.log(`Found ${categories.length} categories`);

    // Get all items
    const itemsResult = await pool.query(
      'SELECT id, name, description FROM menu_items WHERE name IS NOT NULL AND name != \'\' ORDER BY id'
    );
    const items = itemsResult.rows;
    console.log(`Found ${items.length} items`);

    let translated = 0;
    let failed = 0;

    // Translate categories
    for (const category of categories) {
      try {
        console.log(`Translating category: ${category.name} (${translated + failed + 1}/${categories.length + items.length})`);
        
        const nameAr = await translateText(category.name, 'ar');
        await delay(300);
        const nameRu = await translateText(category.name, 'ru');
        await delay(300);
        const nameZh = await translateText(category.name, 'zh');
        await delay(300);
        
        // Save translations
        await pool.query(
          `INSERT INTO category_translations (category_id, language_code, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (category_id, language_code)
           DO UPDATE SET name = $3, updated_at = CURRENT_TIMESTAMP`,
          [category.id, 'ar', nameAr]
        );
        
        await pool.query(
          `INSERT INTO category_translations (category_id, language_code, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (category_id, language_code)
           DO UPDATE SET name = $3, updated_at = CURRENT_TIMESTAMP`,
          [category.id, 'ru', nameRu]
        );
        
        await pool.query(
          `INSERT INTO category_translations (category_id, language_code, name)
           VALUES ($1, $2, $3)
           ON CONFLICT (category_id, language_code)
           DO UPDATE SET name = $3, updated_at = CURRENT_TIMESTAMP`,
          [category.id, 'zh', nameZh]
        );
        
        translated++;
      } catch (error) {
        console.error(`Failed to translate category ${category.name}:`, error.message);
        failed++;
      }
    }

    // Translate items
    for (const item of items) {
      try {
        console.log(`Translating item: ${item.name} (${translated + failed + 1}/${categories.length + items.length})`);
        
        const nameAr = await translateText(item.name, 'ar');
        await delay(300);
        const nameRu = await translateText(item.name, 'ru');
        await delay(300);
        const nameZh = await translateText(item.name, 'zh');
        await delay(300);
        
        const descAr = item.description ? await translateText(item.description, 'ar') : '';
        await delay(300);
        const descRu = item.description ? await translateText(item.description, 'ru') : '';
        await delay(300);
        const descZh = item.description ? await translateText(item.description, 'zh') : '';
        await delay(300);
        
        // Save translations
        await pool.query(
          `INSERT INTO item_translations (item_id, language_code, name, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (item_id, language_code)
           DO UPDATE SET name = $3, description = $4, updated_at = CURRENT_TIMESTAMP`,
          [item.id, 'ar', nameAr, descAr]
        );
        
        await pool.query(
          `INSERT INTO item_translations (item_id, language_code, name, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (item_id, language_code)
           DO UPDATE SET name = $3, description = $4, updated_at = CURRENT_TIMESTAMP`,
          [item.id, 'ru', nameRu, descRu]
        );
        
        await pool.query(
          `INSERT INTO item_translations (item_id, language_code, name, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (item_id, language_code)
           DO UPDATE SET name = $3, description = $4, updated_at = CURRENT_TIMESTAMP`,
          [item.id, 'zh', nameZh, descZh]
        );
        
        translated++;
      } catch (error) {
        console.error(`Failed to translate item ${item.name}:`, error.message);
        failed++;
      }
    }

    console.log(`\n${dbName} Complete: ${translated} translated, ${failed} failed`);
    
  } finally {
    await pool.end();
  }
}

// Main execution
async function main() {
  const requestedDbs = process.argv.slice(2);
  const targetDbs = requestedDbs.length ? requestedDbs : ['mosaico_menu', 'hikayat_menu'];

  console.log(`Starting bulk translation for: ${targetDbs.join(', ')}\n`);
  
  try {
    for (const dbName of targetDbs) {
      await processDatabase(dbName);
    }
    
    console.log('\n========== ALL TRANSLATIONS COMPLETE ==========');
    console.log('You can now view the translated menus!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
