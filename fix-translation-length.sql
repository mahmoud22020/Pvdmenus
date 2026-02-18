-- Fix category_translations and item_translations column length

-- Connect to mosaico_menu database
\c mosaico_menu

-- Increase category translation name length
ALTER TABLE category_translations ALTER COLUMN name TYPE VARCHAR(500);

-- Increase item translation name and description length
ALTER TABLE item_translations ALTER COLUMN name TYPE VARCHAR(500);
ALTER TABLE item_translations ALTER COLUMN description TYPE TEXT;

-- Connect to hikayat_menu database
\c hikayat_menu

-- Increase category translation name length
ALTER TABLE category_translations ALTER COLUMN name TYPE VARCHAR(500);

-- Increase item translation name and description length
ALTER TABLE item_translations ALTER COLUMN name TYPE VARCHAR(500);
ALTER TABLE item_translations ALTER COLUMN description TYPE TEXT;

\echo 'Translation column lengths updated successfully!'
