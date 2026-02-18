const VENUES = {
  mosaico: {
    key: 'mosaico',
    name: 'Mosaico',
    base: '/mosaico/api',
  },
  hikayat: {
    key: 'hikayat',
    name: 'Hikayat',
    base: '/hikayat/api',
  },
};

let currentVenue = VENUES.mosaico;
let ayadToken = null;
let venuePermissions = {
  mosaico: false,
  hikayat: false,
};

const state = {
  items: [],
};

const bulkState = {
  mode: 'categories',
  parsed: { categories: [], items: [] },
  fileName: '',
};

const toastEl = document.getElementById('ayad-toast');
const userNameEl = document.getElementById('ayad-user-name');
const logoutBtnEl = document.getElementById('ayad-logout');
const appShellEl = document.getElementById('ayad-app');
const loginOverlayEl = document.getElementById('ayad-login-overlay');
const venueListEl = document.getElementById('venue-list');
const venueDetailEl = document.getElementById('venue-detail');
const venueNameLabelEl = document.getElementById('venue-name-label');

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3000);
}

function apiBase() {
  return currentVenue.base;
}

function authHeaders() {
  return ayadToken
    ? {
        Authorization: `Bearer ${ayadToken}`,
        'Content-Type': 'application/json',
      }
    : { 'Content-Type': 'application/json' };
}

// --- Login overlay ---
async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit');
  const errorEl = document.getElementById('login-error');

  if (!username || !password) {
    errorEl.textContent = 'Enter username and password';
    return;
  }

  btn.disabled = true;
  errorEl.textContent = 'Authenticating…';

  try {
    const res = await fetch('/AY-AD/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok || !data.token) {
      errorEl.textContent = 'Login failed – check username or password';
      btn.disabled = false;
      return;
    }

    ayadToken = data.token;
    const user = data.user || {};
    userNameEl.textContent = user.username || 'Manager';

    venuePermissions.mosaico = !!user.can_mosaico;
    venuePermissions.hikayat = !!user.can_hikayat;

    // Hide login, show app
    if (loginOverlayEl) loginOverlayEl.style.display = 'none';
    if (appShellEl) appShellEl.classList.remove('ayad-app-hidden');

    showToast('AY-AD logged in – select a restaurant to manage');
    showVenueList();
  } catch (e) {
    console.error(e);
    errorEl.textContent = 'Error talking to server';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// --- Venue selection & tabs ---
function setupVenueSelection() {
  document.querySelectorAll('.venue-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-venue');
      openVenue(key);
    });
  });

  const backBtn = document.getElementById('back-to-venues');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      showVenueList();
    });
  }
}

function showVenueList() {
  if (venueListEl) venueListEl.classList.remove('hidden');
  if (venueDetailEl) venueDetailEl.classList.add('hidden');
  const subtitleEl = document.getElementById('ayad-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = 'Admin panel – select a restaurant to manage';
  }
}

function openVenue(key) {
  const venue = VENUES[key];
  if (!venue) return;
  if (!venuePermissions[key]) {
    showToast('You are not assigned to manage this restaurant');
    return;
  }
  currentVenue = venue;
  if (venueNameLabelEl) {
    venueNameLabelEl.textContent = venue.name;
  }
  const subtitleEl = document.getElementById('ayad-subtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `${venue.name} – admin settings`;
  }
  if (venueListEl) venueListEl.classList.add('hidden');
  if (venueDetailEl) venueDetailEl.classList.remove('hidden');
  reloadAll();
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      document
        .querySelectorAll('.tab-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document
        .querySelectorAll('.tab-panel')
        .forEach((p) => p.classList.remove('active'));
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add('active');
    });
  });
}

// --- Data loading helpers ---
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = data.error || data.message || 'Request failed';
    throw new Error(err);
  }
  return data;
}

async function loadOverview() {
  if (!ayadToken) {
    const statsEl = document.getElementById('overview-stats');
    statsEl.innerHTML =
      '<div class="stat-pill">Login above to load live stats</div>';
    return;
  }
  try {
    const [categoriesRes, itemsRes] = await Promise.all([
      fetchJson(`${apiBase()}/categories`),
      fetchJson(`${apiBase()}/items`),
    ]);

    const categories = categoriesRes.categories || [];
    const items = itemsRes.items || [];
    state.items = items;

    const activeItems = items.filter((i) => i.is_available).length;
    const dayPricingItems = items.filter((i) => i.use_day_pricing).length;

    const statsEl = document.getElementById('overview-stats');
    statsEl.innerHTML = `
      <div class="stat-pill">${currentVenue.name.toUpperCase()}</div>
      <div class="stat-pill">CATEGORIES: ${categories.length}</div>
      <div class="stat-pill">ITEMS: ${items.length}</div>
      <div class="stat-pill">ACTIVE ITEMS: ${activeItems}</div>
      <div class="stat-pill">DAY PRICING: ${dayPricingItems}</div>
    `;
  } catch (e) {
    console.error(e);
    showToast(`Failed to load overview for ${currentVenue.name}`);
  }
}

async function loadItemsTable() {
  const tableEl = document.getElementById('items-table');
  if (!ayadToken) {
    tableEl.innerHTML =
      '<div class="table-row">Login above to load items from database…</div>';
    return;
  }
  tableEl.innerHTML =
    '<div class="table-row">Loading items from database…</div>';
  try {
    const res = await fetchJson(`${apiBase()}/items`);
    const items = res.items || [];
    state.items = items;

    const header = `
      <div class="table-row header">
        <div>Item</div>
        <div>Category</div>
        <div>Price</div>
        <div>Status</div>
      </div>
    `;

    const rows = items
      .map((item) => {
        const price =
          item.price != null ? `${item.currency_symbol || ''} ${item.price}` : '-';
        const statusBadge = item.is_available
          ? '<span class="badge green">Available</span>'
          : '<span class="badge red">Hidden</span>';
        return `
          <div class="table-row">
            <div>${item.name}</div>
            <div>${item.category_name || '-'}</div>
            <div>${price}</div>
            <div>${statusBadge}</div>
          </div>
        `;
      })
      .join('');

    tableEl.innerHTML = `<div class="table">${header}${rows}</div>`;
  } catch (e) {
    console.error(e);
    tableEl.innerHTML =
      '<div class="table-row">Failed to load items from database.</div>';
  }
}

async function loadDayPricing() {
  const listEl = document.getElementById('day-pricing-list');
  if (!ayadToken) {
    listEl.innerHTML =
      '<div class="table-row">Login above to see day pricing configuration…</div>';
    return;
  }
  listEl.innerHTML =
    '<div class="table-row">Loading items & day pricing…</div>';
  try {
    if (!state.items.length) {
      const res = await fetchJson(`${apiBase()}/items`);
      state.items = res.items || [];
    }
    const items = state.items;

    const header = `
      <div class="table-row header">
        <div>Item</div>
        <div>Base Price</div>
        <div>Day Pricing</div>
        <div></div>
      </div>
    `;

    const rows = await Promise.all(
      items.map(async (item) => {
        if (!item.use_day_pricing) {
          return `
            <div class="table-row">
              <div>${item.name}</div>
              <div>${item.price || '-'} ${item.currency_symbol || ''}</div>
              <div><span class="badge">Disabled</span></div>
              <div></div>
            </div>
          `;
        }
        try {
          const dp = await fetchJson(`${apiBase()}/day-pricing/${item.id}`);
          const activeDays = (dp.dayPricing || []).filter((d) => d.is_active)
            .length;
          return `
            <div class="table-row">
              <div>${item.name}</div>
              <div>${item.price || '-'} ${item.currency_symbol || ''}</div>
              <div><span class="badge gold">${activeDays} days</span></div>
              <div></div>
            </div>
          `;
        } catch {
          return `
            <div class="table-row">
              <div>${item.name}</div>
              <div>${item.price || '-'} ${item.currency_symbol || ''}</div>
              <div><span class="badge red">Error</span></div>
              <div></div>
            </div>
          `;
        }
      })
    );

    listEl.innerHTML = `<div class="table">${header}${rows.join('')}</div>`;
  } catch (e) {
    console.error(e);
    listEl.innerHTML =
      '<div class="table-row">Failed to load day pricing information.</div>';
  }
}

async function loadAppearance() {
  const form = document.getElementById('appearance-form');
  if (!form) return;
  if (!ayadToken) {
    showToast('Login to edit appearance settings');
    return;
  }

  try {
    const res = await fetchJson(`${apiBase()}/intro-config`);
    const cfg = res.config || {};

    document.getElementById('app-brand-name').value = cfg.brand_name || '';
    document.getElementById('app-logo-url').value = cfg.logo_url || '';
    document.getElementById('app-hero-url').value = cfg.hero_image_url || '';
    document.getElementById('app-headline-top').value =
      cfg.headline_top || '';
    document.getElementById('app-headline-main').value =
      cfg.headline_main || '';
    document.getElementById('app-subtitle').value = cfg.subtitle || '';
    document.getElementById('app-bg1').value = cfg.theme_bg1 || '#0b7b8a';
    document.getElementById('app-bg2').value = cfg.theme_bg2 || '#0a6776';
    document.getElementById('app-bg3').value = cfg.theme_bg3 || '#0a5162';
    document.getElementById('app-accent').value =
      cfg.theme_accent || '#ff7a3b';
  } catch (e) {
    console.error(e);
    showToast(`Failed to load appearance for ${currentVenue.name}`);
  }
}

async function saveAppearance(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  const payload = {
    brand_name: document.getElementById('app-brand-name').value,
    logo_url: document.getElementById('app-logo-url').value,
    hero_image_url: document.getElementById('app-hero-url').value,
    headline_top: document.getElementById('app-headline-top').value,
    headline_main: document.getElementById('app-headline-main').value,
    subtitle: document.getElementById('app-subtitle').value,
    theme_bg1: document.getElementById('app-bg1').value,
    theme_bg2: document.getElementById('app-bg2').value,
    theme_bg3: document.getElementById('app-bg3').value,
    theme_accent: document.getElementById('app-accent').value,
  };

  try {
    const res = await fetchJson(`${apiBase()}/intro-config`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    showToast(
      res.message ||
        `Appearance updated for ${currentVenue.name}. Guests see it on next refresh.`
    );
  } catch (e) {
    console.error(e);
    showToast(
      `Failed to save appearance – make sure you are logged in as admin/manager.`
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function reloadAll() {
  await Promise.all([
    loadOverview(),
    loadItemsTable(),
    loadDayPricing(),
    loadAppearance(),
  ]);
}

// Quick actions
function setupQuickActions() {
  const refreshBtn = document.getElementById('qa-refresh-menu');
  const toggleBtn = document.getElementById('qa-toggle-all-available');
  const translateAllBtn = document.getElementById('qa-translate-all');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Frontends already auto-refresh when menu_version changes; here we just reload admin view.
      reloadAll();
      showToast('Admin view refreshed from database');
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      if (!state.items.length) {
        await loadItemsTable();
      }
      const hasToken = !!ayadToken;
      if (!hasToken) {
        showToast('Login first to change availability');
        return;
      }
      try {
        const anyActive = state.items.some((i) => i.is_available);
        const target = !anyActive;
        await Promise.all(
          state.items.map((item) =>
            fetchJson(`${apiBase()}/items/${item.id}`, {
              method: 'PUT',
              headers: authHeaders(),
              body: JSON.stringify({ is_available: target }),
            }).catch(() => null)
          )
        );
        showToast(
          target
            ? `All items set to available for ${currentVenue.name}`
            : `All items hidden for ${currentVenue.name}`
        );
        await reloadAll();
      } catch (e) {
        console.error(e);
        showToast('Failed to toggle availability');
      }
    });
  }
  
  if (translateAllBtn) {
    translateAllBtn.addEventListener('click', async () => {
      if (!ayadToken) {
        showToast('Login first to translate');
        return;
      }
      await translateAllItemsAndCategories();
    });
  }
}

// Items search
function setupItemSearch() {
  const searchInput = document.getElementById('items-search');
  if (!searchInput) return;
  searchInput.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase();
    const tableEl = document.getElementById('items-table');
    const rows = tableEl.querySelectorAll('.table-row:not(.header)');
    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupVenueSelection();
  setupTabs();
  setupQuickActions();
  setupItemSearch();

  const loginForm = document.getElementById('ayad-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (logoutBtnEl) {
    logoutBtnEl.addEventListener('click', () => {
      ayadToken = null;
      venuePermissions = { mosaico: false, hikayat: false };
      userNameEl.textContent = 'Guest';
      showToast('Logged out from AY-AD');

      // Hide app, show login again
      if (appShellEl) appShellEl.classList.add('ayad-app-hidden');
      if (loginOverlayEl) loginOverlayEl.style.display = 'flex';

      // Clear password field
      const pw = document.getElementById('login-password');
      if (pw) pw.value = '';
      const err = document.getElementById('login-error');
      if (err) err.textContent = '';
    });
  }

  // Initial state: app hidden, login visible; no auto-login
  if (appShellEl) appShellEl.classList.add('ayad-app-hidden');
  if (loginOverlayEl) loginOverlayEl.style.display = 'flex';
});

// ============================================================================
// MODAL FUNCTIONALITY - Category & Item Edit with Translations and Day Pricing
// ============================================================================

let currentDayPricing = [];
let categories = [];
let allCategories = [];  // Store all categories
let allItems = [];        // Store all items
let filteredCategories = [];
let filteredItems = [];
let languages = [
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' }
];

// Load categories for dropdowns
async function loadCategories() {
  try {
    const res = await fetchJson(`${apiBase()}/categories`);
    categories = res.categories || [];
    allCategories = [...categories];  // Store all categories
    
    // Sort by sort_order then name
    categories.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return (a.name || '').localeCompare(b.name || '');
    });
    
    updateCategorySelects();
    renderCategoriesTable();
  } catch (e) {
    console.error('Error loading categories:', e);
  }
}

function updateCategorySelects() {
  const parentSelect = document.getElementById('categoryParent');
  const itemCategorySelect = document.getElementById('itemCategory');
  
  if (parentSelect) {
    const currentValue = parentSelect.value;
    parentSelect.innerHTML = '<option value="">-- Root Category --</option>';
    categories.filter(c => !c.parent_id).forEach(cat => {
      parentSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
    parentSelect.value = currentValue;
  }
  
  if (itemCategorySelect) {
    const currentValue = itemCategorySelect.value;
    itemCategorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    categories.forEach(cat => {
      const prefix = cat.parent_id ? '→ ' : '';
      itemCategorySelect.innerHTML += `<option value="${cat.id}">${prefix}${cat.name}</option>`;
    });
    itemCategorySelect.value = currentValue;
  }
}

// Render categories table
function renderCategoriesTable() {
  const tableEl = document.getElementById('categories-table');
  if (!tableEl) return;
  
  // Use filtered categories if filter/search is active, otherwise use all
  const categoriesToShow = filteredCategories.length > 0 ? filteredCategories : categories;
  
  if (!categoriesToShow.length) {
    tableEl.innerHTML = '<div class="empty-state">No categories found.</div>';
    return;
  }
  
  let html = '';
  categoriesToShow.forEach(cat => {
    const badge = cat.is_visible ? '<span class="badge active">Active</span>' : '<span class="badge inactive">Hidden</span>';
    const timeInfo = cat.has_time_availability ? 
      `<div class="item-desc">⏰ ${cat.available_from} - ${cat.available_to}</div>` : '';
    
    html += `
      <div class="category-row">
        <div class="category-header">
          <div>
            <div class="category-name">${cat.name}</div>
            <div class="category-meta">Sort: ${cat.sort_order}${cat.parent_id ? ` • Parent: ${categories.find(c => c.id === cat.parent_id)?.name || 'N/A'}` : ''}</div>
            ${timeInfo}
          </div>
          <div>${badge}</div>
        </div>
        <div class="category-actions">
          <button class="btn-edit" onclick="editCategory(${cat.id})">Edit</button>
          <button class="btn-delete" onclick="deleteCategory(${cat.id}, '${cat.name.replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </div>
    `;
  });
  
  tableEl.innerHTML = html;
}

// Render items table with edit buttons
async function loadItemsTableEnhanced() {
  const tableEl = document.getElementById('items-table');
  if (!ayadToken) {
    tableEl.innerHTML = '<div class="loading">Login to load items from database…</div>';
    return;
  }
  tableEl.innerHTML = '<div class="loading">Loading items from database…</div>';
  try {
    const res = await fetchJson(`${apiBase()}/items`);
    const items = res.items || [];
    
    // Create a map of category_id to category for sorting
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.id] = cat;
    });
    
    // Sort items by: 1) category sort_order, 2) item sort_order, 3) item name
    items.sort((a, b) => {
      const catA = categoryMap[a.category_id] || { sort_order: 9999 };
      const catB = categoryMap[b.category_id] || { sort_order: 9999 };
      
      // First sort by category sort_order
      if (catA.sort_order !== catB.sort_order) {
        return catA.sort_order - catB.sort_order;
      }
      
      // Then by item sort_order within the same category
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      
      // Finally by item name
      return (a.name || '').localeCompare(b.name || '');
    });
    
    state.items = items;
    allItems = [...items];  // Store all items

    if (!items.length) {
      tableEl.innerHTML = '<div class="empty-state">No items yet. Add one to get started!</div>';
      return;
    }

    renderItemsTable();
  } catch (e) {
    console.error(e);
    tableEl.innerHTML = '<div class="loading">Failed to load items from database.</div>';
  }
}

function renderItemsTable() {
  const tableEl = document.getElementById('items-table');
  if (!tableEl) return;
  
  // Use filtered items if filter/search is active, otherwise use all
  const itemsToShow = filteredItems.length > 0 ? filteredItems : state.items;

  if (!itemsToShow.length) {
    tableEl.innerHTML = '<div class="empty-state">No items found.</div>';
    return;
  }

  let html = '';
  itemsToShow.forEach(item => {
    const price = item.price != null ? `${item.currency_symbol || ''} ${item.price}` : '-';
    const badge = item.is_available ? '<span class="badge active">Available</span>' : '<span class="badge inactive">Hidden</span>';
    const dayPricingBadge = item.use_day_pricing ? '<span class="badge" style="background: var(--cream-dark); color: var(--gold);">Day Pricing</span>' : '';
    
    html += `
      <div class="item-row">
        <div class="item-header">
          <div>
            <div class="item-name">${item.name}</div>
            <div class="item-desc">${item.description || ''}</div>
            <div class="category-meta">${item.category_name || 'No category'} • ${price}</div>
          </div>
          <div>${badge} ${dayPricingBadge}</div>
        </div>
        <div class="item-actions">
          <button class="btn-edit" onclick="editItem(${item.id})">Edit</button>
          <button class="btn-delete" onclick="deleteItem(${item.id}, '${item.name.replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </div>
    `;
  });
  
  tableEl.innerHTML = html;
}

// Toggle category time fields
function toggleCategoryTimeFields() {
  const enabled = document.getElementById('categoryHasTimeAvailability').checked;
  const timeFields = document.getElementById('categoryTimeFields');
  if (timeFields) {
    timeFields.style.display = enabled ? 'block' : 'none';
  }
}

// Open category modal
async function openCategoryModal(categoryId = null) {
  const modal = document.getElementById('categoryModal');
  const form = document.getElementById('categoryForm');
  
  form.reset();
  document.getElementById('categoryId').value = '';
  document.getElementById('categoryModalTitle').textContent = 'Add Category';
  document.getElementById('categoryActive').checked = true;
  document.getElementById('categoryHasTimeAvailability').checked = false;
  document.getElementById('categoryTimeFields').style.display = 'none';
  
  // Clear translation fields
  document.getElementById('categoryNameAr').value = '';
  document.getElementById('categoryNameRu').value = '';
  document.getElementById('categoryNameZh').value = '';
  
  if (categoryId) {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      document.getElementById('categoryId').value = category.id;
      document.getElementById('categoryName').value = category.name;
      document.getElementById('categoryParent').value = category.parent_id || '';
      document.getElementById('categorySortOrder').value = category.sort_order;
      document.getElementById('categoryActive').checked = category.is_visible;
      document.getElementById('categoryHasTimeAvailability').checked = category.has_time_availability || false;
      if (category.has_time_availability) {
        document.getElementById('categoryTimeFields').style.display = 'block';
        document.getElementById('categoryAvailableFrom').value = category.available_from || '';
        document.getElementById('categoryAvailableTo').value = category.available_to || '';
      }
      document.getElementById('categoryModalTitle').textContent = 'Edit Category';
      
      // Load translations
      await loadCategoryTranslations(categoryId);
    }
  }
  
  updateCategorySelects();
  modal.classList.add('show');
}

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('show');
}

// Load category translations
async function loadCategoryTranslations(categoryId) {
  try {
    const res = await fetchJson(`${apiBase()}/translations/categories/${categoryId}`);
    const translations = res.translations || [];
    
    translations.forEach(t => {
      if (t.language === 'ar') document.getElementById('categoryNameAr').value = t.name || '';
      if (t.language === 'ru') document.getElementById('categoryNameRu').value = t.name || '';
      if (t.language === 'zh') document.getElementById('categoryNameZh').value = t.name || '';
    });
  } catch (e) {
    console.log('No translations found or error loading');
  }
}

// Save category translations
async function saveCategoryTranslations(categoryId) {
  const translations = [
    { language: 'ar', name: document.getElementById('categoryNameAr').value },
    { language: 'ru', name: document.getElementById('categoryNameRu').value },
    { language: 'zh', name: document.getElementById('categoryNameZh').value }
  ];
  
  for (const trans of translations) {
    if (trans.name) {
      try {
        await fetchJson(`${apiBase()}/translations/categories`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ category_id: categoryId, language_code: trans.language, name: trans.name })
        });
      } catch (e) {
        console.error('Failed to save translation:', e);
      }
    }
  }
}

// Handle category form submit
document.addEventListener('DOMContentLoaded', () => {
  const catForm = document.getElementById('categoryForm');
  if (catForm) {
    catForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('categoryId').value;
      const hasTimeAvailability = document.getElementById('categoryHasTimeAvailability').checked;
      const data = {
        name: document.getElementById('categoryName').value,
        parent_id: document.getElementById('categoryParent').value || null,
        sort_order: parseInt(document.getElementById('categorySortOrder').value) || 0,
        is_visible: document.getElementById('categoryActive').checked,
        has_time_availability: hasTimeAvailability,
        available_from: hasTimeAvailability ? document.getElementById('categoryAvailableFrom').value || null : null,
        available_to: hasTimeAvailability ? document.getElementById('categoryAvailableTo').value || null : null
      };

      try {
        const url = id ? `${apiBase()}/categories/${id}` : `${apiBase()}/categories`;
        const method = id ? 'PUT' : 'POST';
        
        const result = await fetchJson(url, {
          method,
          headers: authHeaders(),
          body: JSON.stringify(data)
        });
        
        const categoryId = id || result.category?.id;
        
        // Save translations
        if (categoryId) {
          await saveCategoryTranslations(categoryId);
        }
        
        showToast(result.message || 'Category saved successfully');
        closeCategoryModal();
        await loadCategories();
      } catch (error) {
        console.error('Error saving category:', error);
        showToast('Failed to save category: ' + error.message);
      }
    });
  }
});

function editCategory(id) {
  openCategoryModal(id);
}

async function deleteCategory(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"?`)) {
    return;
  }

  try {
    await fetchJson(`${apiBase()}/categories/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    
    showToast('Category deleted successfully');
    // Also refresh items because deleting a category cascades and removes its items
    await Promise.all([
      loadCategories(),
      loadItemsTableEnhanced(),
    ]);
  } catch (error) {
    console.error('Error deleting category:', error);
    showToast('Failed to delete category: ' + error.message);
  }
}

// ============ ITEM MODAL FUNCTIONS ============

// Toggle day pricing section
function toggleDayPricing() {
  const enabled = document.getElementById('useDayPricing').checked;
  const section = document.getElementById('dayPricingSection');
  const priceInput = document.getElementById('itemPrice');
  
  if (enabled) {
    section.style.display = 'block';
    priceInput.disabled = true;
    priceInput.style.opacity = '0.5';
    
    // Pre-fill all days with current price if not already set
    const currentPrice = parseFloat(priceInput.value) || 0;
    if (currentDayPricing.length === 0 && currentPrice > 0) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      currentDayPricing = days.map(day => ({
        day: day,
        price: currentPrice,
        enabled: true
      }));
    }
    
    renderDayPricingGrid();
  } else {
    section.style.display = 'none';
    priceInput.disabled = false;
    priceInput.style.opacity = '1';
    currentDayPricing = [];
  }
}

function renderDayPricingGrid() {
  const grid = document.getElementById('dayPricingGrid');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  let html = '';
  days.forEach((day, dayIndex) => {
    // Find existing pricing by day_of_week (0=Sunday, 1=Monday, etc.)
    const existing = currentDayPricing.find(d => d.day_of_week === dayIndex);
    const isActive = existing ? existing.is_active : false;
    const price = existing ? existing.price : '';
    
    html += `
      <div class="day-pricing-item ${isActive ? '' : 'inactive'}">
        <label class="day-name">
          <input type="checkbox" class="day-checkbox" data-day="${day}" ${isActive ? 'checked' : ''} onchange="toggleDayPricingItem('${day}')">
          ${day}
        </label>
        <input type="number" step="0.01" min="0" class="day-price-input" data-day="${day}" value="${price}" placeholder="0.00" ${!isActive ? 'disabled' : ''}>
      </div>
    `;
  });
  
  grid.innerHTML = html;
}

function toggleDayPricingItem(day) {
  const checkbox = document.querySelector(`.day-checkbox[data-day="${day}"]`);
  const input = document.querySelector(`.day-price-input[data-day="${day}"]`);
  const container = checkbox.closest('.day-pricing-item');
  
  if (checkbox.checked) {
    input.disabled = false;
    container.classList.remove('inactive');
  } else {
    input.disabled = true;
    container.classList.add('inactive');
  }
}

function getDayPricingData() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const data = [];
  
  days.forEach((day, index) => {
    const checkbox = document.querySelector(`.day-checkbox[data-day="${day}"]`);
    const input = document.querySelector(`.day-price-input[data-day="${day}"]`);
    
    if (checkbox && input) {
      data.push({
        day_of_week: index, // 0 = Sunday, 1 = Monday, etc.
        price: parseFloat(input.value) || 0,
        is_active: checkbox.checked
      });
    }
  });
  
  return data;
}

// Open item modal
async function openItemModal(itemId = null) {
  const modal = document.getElementById('itemModal');
  const form = document.getElementById('itemForm');
  
  form.reset();
  document.getElementById('itemId').value = '';
  document.getElementById('itemModalTitle').textContent = 'Add Menu Item';
  document.getElementById('itemCurrency').value = 'AED';
  document.getElementById('itemActive').checked = true;
  document.getElementById('useDayPricing').checked = false;
  document.getElementById('dayPricingSection').style.display = 'none';
  document.getElementById('itemPrice').disabled = false;
  document.getElementById('itemPrice').style.opacity = '1';
  currentDayPricing = [];
  
  // Clear translation fields
  document.getElementById('itemNameAr').value = '';
  document.getElementById('itemDescriptionAr').value = '';
  document.getElementById('itemNameRu').value = '';
  document.getElementById('itemDescriptionRu').value = '';
  document.getElementById('itemNameZh').value = '';
  document.getElementById('itemDescriptionZh').value = '';
  
  if (itemId) {
    const item = state.items.find(i => i.id === itemId);
    if (item) {
      document.getElementById('itemId').value = item.id;
      document.getElementById('itemCategory').value = item.category_id;
      document.getElementById('itemName').value = item.name;
      document.getElementById('itemDescription').value = item.description || '';
      document.getElementById('itemPrice').value = item.price || '';
      document.getElementById('itemCurrency').value = item.currency_symbol || 'AED';
      document.getElementById('itemSortOrder').value = item.sort_order || 0;
      document.getElementById('itemActive').checked = item.is_available;
      document.getElementById('itemModalTitle').textContent = 'Edit Menu Item';
      
      // Load translations
      await loadItemTranslations(itemId);
      
      // Load day pricing if exists
      if (item.use_day_pricing) {
        document.getElementById('useDayPricing').checked = true;
        await loadDayPricingForItem(itemId);
        toggleDayPricing();
      }
    }
  }
  
  updateCategorySelects();
  modal.classList.add('show');
}

function closeItemModal() {
  document.getElementById('itemModal').classList.remove('show');
}

// Load item translations
async function loadItemTranslations(itemId) {
  try {
    const res = await fetchJson(`${apiBase()}/translations/items/${itemId}`);
    const translations = res.translations || [];
    
    translations.forEach(t => {
      if (t.language === 'ar') {
        document.getElementById('itemNameAr').value = t.name || '';
        document.getElementById('itemDescriptionAr').value = t.description || '';
      }
      if (t.language === 'ru') {
        document.getElementById('itemNameRu').value = t.name || '';
        document.getElementById('itemDescriptionRu').value = t.description || '';
      }
      if (t.language === 'zh') {
        document.getElementById('itemNameZh').value = t.name || '';
        document.getElementById('itemDescriptionZh').value = t.description || '';
      }
    });
  } catch (e) {
    console.log('No translations found or error loading');
  }
}

// Save item translations
async function saveItemTranslations(itemId) {
  const translations = [
    { 
      language: 'ar', 
      name: document.getElementById('itemNameAr').value,
      description: document.getElementById('itemDescriptionAr').value
    },
    { 
      language: 'ru', 
      name: document.getElementById('itemNameRu').value,
      description: document.getElementById('itemDescriptionRu').value
    },
    { 
      language: 'zh', 
      name: document.getElementById('itemNameZh').value,
      description: document.getElementById('itemDescriptionZh').value
    }
  ];
  
  for (const trans of translations) {
    if (trans.name || trans.description) {
      try {
        await fetchJson(`${apiBase()}/translations/items`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ item_id: itemId, language_code: trans.language, name: trans.name, description: trans.description })
        });
      } catch (e) {
        console.error('Failed to save translation:', e);
      }
    }
  }
}

// Load day pricing for an item
async function loadDayPricingForItem(itemId) {
  try {
    const res = await fetchJson(`${apiBase()}/day-pricing/${itemId}`);
    currentDayPricing = res.dayPricing || [];
    console.log('Loaded day pricing:', currentDayPricing);
  } catch (e) {
    console.log('No day pricing found');
    currentDayPricing = [];
  }
}

// Save day pricing
async function saveDayPricing(itemId, dayPricingData) {
  try {
    console.log('Saving day pricing for item:', itemId);
    console.log('Day pricing data:', JSON.stringify(dayPricingData, null, 2));
    console.log('API URL:', `${apiBase()}/day-pricing/${itemId}`);
    
    const response = await fetchJson(`${apiBase()}/day-pricing/${itemId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ dayPricing: dayPricingData })
    });
    
    console.log('Day pricing save response:', response);
    return response;
  } catch (e) {
    console.error('Failed to save day pricing:', e);
    throw e;
  }
}

// Handle item form submit
document.addEventListener('DOMContentLoaded', () => {
  const itemForm = document.getElementById('itemForm');
  if (itemForm) {
    itemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('itemId').value;
      const useDayPricing = document.getElementById('useDayPricing').checked;
      
      const data = {
        category_id: parseInt(document.getElementById('itemCategory').value),
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDescription').value || null,
        price: parseFloat(document.getElementById('itemPrice').value) || null,
        currency_symbol: document.getElementById('itemCurrency').value,
        sort_order: parseInt(document.getElementById('itemSortOrder').value) || 0,
        is_available: document.getElementById('itemActive').checked,
        use_day_pricing: useDayPricing
      };

      try {
        const url = id ? `${apiBase()}/items/${id}` : `${apiBase()}/items`;
        const method = id ? 'PUT' : 'POST';
        
        // Debug: Check token before sending
        console.log('Saving item with token:', ayadToken ? 'Token present' : 'NO TOKEN');
        console.log('API URL:', url);
        
        const result = await fetchJson(url, {
          method,
          headers: authHeaders(),
          body: JSON.stringify(data)
        });
        
        const itemId = id || result.item?.id;
        
        // Auto-translate and save translations
        if (itemId) {
          await autoTranslateAndSaveItem(itemId, data.name, data.description);
          
          // Save day pricing if enabled
          if (useDayPricing) {
            const dayPricingData = getDayPricingData();
            await saveDayPricing(itemId, dayPricingData);
          }
        }
        
        showToast(result.message || 'Item saved successfully');
        closeItemModal();
        await loadItemsTableEnhanced();
      } catch (error) {
        console.error('Error saving item:', error);
        showToast('Failed to save item: ' + error.message);
      }
    });
  }
});

function editItem(id) {
  openItemModal(id);
}

async function deleteItem(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"?`)) {
    return;
  }

  try {
    await fetchJson(`${apiBase()}/items/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    
    showToast('Item deleted successfully');
    await loadItemsTableEnhanced();
  } catch (error) {
    console.error('Error deleting item:', error);
    showToast('Failed to delete item: ' + error.message);
  }
}

// Update reloadAll to use enhanced version
async function reloadAllEnhanced() {
  await Promise.all([
    loadOverview(),
    loadCategories(),
    loadItemsTableEnhanced(),
    loadAppearance(),
  ]);
}

// Override the reloadAll function
window.addEventListener('DOMContentLoaded', () => {
  // When switching venues or tabs, load categories and items with enhanced modals
  const originalReloadAll = reloadAll;
  reloadAll = reloadAllEnhanced;
});

// ============================================================================
// SEARCH & FILTER FUNCTIONALITY
// ============================================================================

function toggleSearch(type) {
  const searchPanel = document.getElementById(`${type === 'categories' ? 'category' : 'item'}Search`);
  const filterPanel = document.getElementById(`${type === 'categories' ? 'category' : 'item'}Filter`);
  const searchBtn = event.target.closest('.btn-icon');
  
  // Toggle search panel
  searchPanel.classList.toggle('show');
  
  // Toggle active state
  if (searchPanel.classList.contains('show')) {
    searchBtn.classList.add('active');
    filterPanel.classList.remove('show');
    // Remove filter button active state
    const filterBtns = document.querySelectorAll('.btn-icon');
    filterBtns.forEach(btn => {
      if (btn.getAttribute('onclick')?.includes('toggleFilter')) {
        btn.classList.remove('active');
      }
    });
  } else {
    searchBtn.classList.remove('active');
  }
  
  // Clear search if closing
  if (!searchPanel.classList.contains('show')) {
    const input = document.getElementById(`${type === 'categories' ? 'category' : 'item'}SearchInput`);
    input.value = '';
    if (type === 'categories') {
      filteredCategories = [];
      renderCategoriesTable();
    } else {
      filteredItems = [];
      renderItemsTable();
    }
  }
}

function toggleFilter(type) {
  const filterPanel = document.getElementById(`${type === 'categories' ? 'category' : 'item'}Filter`);
  const searchPanel = document.getElementById(`${type === 'categories' ? 'category' : 'item'}Search`);
  const filterBtn = event.target.closest('.btn-icon');
  
  // Toggle filter panel
  filterPanel.classList.toggle('show');
  
  // Toggle active state
  if (filterPanel.classList.contains('show')) {
    filterBtn.classList.add('active');
    searchPanel.classList.remove('show');
    // Remove search button active state
    const searchBtns = document.querySelectorAll('.btn-icon');
    searchBtns.forEach(btn => {
      if (btn.getAttribute('onclick')?.includes('toggleSearch')) {
        btn.classList.remove('active');
      }
    });
    // Populate category filter for items
    if (type === 'items') {
      populateItemCategoryFilter();
    }
  } else {
    filterBtn.classList.remove('active');
  }
  
  // Reset filters if closing
  if (!filterPanel.classList.contains('show')) {
    if (type === 'categories') {
      resetCategoryFilters();
    } else {
      resetItemFilters();
    }
  }
}

function searchCategories() {
  const searchTerm = document.getElementById('categorySearchInput').value.toLowerCase();
  
  if (searchTerm === '') {
    filteredCategories = [];
    renderCategoriesTable();
    return;
  }
  
  filteredCategories = allCategories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm)
  );
  
  renderCategoriesTable();
}

function searchItems() {
  const searchTerm = document.getElementById('itemSearchInput').value.toLowerCase();
  
  if (searchTerm === '') {
    filteredItems = [];
    renderItemsTable();
    return;
  }
  
  filteredItems = allItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm) ||
    (item.description && item.description.toLowerCase().includes(searchTerm))
  );
  
  renderItemsTable();
}

function filterCategories() {
  const visibilityFilter = document.getElementById('categoryVisibilityFilter').value;
  const typeFilter = document.getElementById('categoryTypeFilter').value;
  
  filteredCategories = allCategories.filter(cat => {
    let matchesVisibility = true;
    let matchesType = true;
    
    if (visibilityFilter === 'visible') {
      matchesVisibility = cat.is_visible;
    } else if (visibilityFilter === 'hidden') {
      matchesVisibility = !cat.is_visible;
    }
    
    if (typeFilter === 'root') {
      matchesType = !cat.parent_id;
    } else if (typeFilter === 'sub') {
      matchesType = !!cat.parent_id;
    }
    
    return matchesVisibility && matchesType;
  });
  
  renderCategoriesTable();
}

function filterItems() {
  const categoryFilter = document.getElementById('itemCategoryFilter').value;
  const availabilityFilter = document.getElementById('itemAvailabilityFilter').value;
  
  filteredItems = allItems.filter(item => {
    let matchesCategory = true;
    let matchesAvailability = true;
    
    if (categoryFilter !== 'all') {
      matchesCategory = item.category_id == categoryFilter;
    }
    
    if (availabilityFilter === 'available') {
      matchesAvailability = item.is_available;
    } else if (availabilityFilter === 'unavailable') {
      matchesAvailability = !item.is_available;
    }
    
    return matchesCategory && matchesAvailability;
  });
  
  renderItemsTable();
}

function resetCategoryFilters() {
  document.getElementById('categoryVisibilityFilter').value = 'all';
  document.getElementById('categoryTypeFilter').value = 'all';
  filteredCategories = [];
  renderCategoriesTable();
}

function resetItemFilters() {
  document.getElementById('itemCategoryFilter').value = 'all';
  document.getElementById('itemAvailabilityFilter').value = 'all';
  filteredItems = [];
  renderItemsTable();
}

function populateItemCategoryFilter() {
  const select = document.getElementById('itemCategoryFilter');
  const currentValue = select.value;
  
  select.innerHTML = '<option value="all">All Categories</option>';
  
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    select.appendChild(option);
  });
  
  select.value = currentValue;
}

// Auto-translate function using MyMemory Translation API (free)
async function autoTranslateItem() {
  const nameEn = document.getElementById('itemName').value.trim();
  const descEn = document.getElementById('itemDescription').value.trim();
  
  if (!nameEn) {
    showToast('Please enter an English name first');
    return;
  }
  
  showToast('Translating... Please wait');
  
  try {
    // Translate to Arabic
    const nameAr = await translateText(nameEn, 'ar');
    const descAr = descEn ? await translateText(descEn, 'ar') : '';
    
    // Translate to Russian
    const nameRu = await translateText(nameEn, 'ru');
    const descRu = descEn ? await translateText(descEn, 'ru') : '';
    
    // Translate to Chinese
    const nameZh = await translateText(nameEn, 'zh');
    const descZh = descEn ? await translateText(descEn, 'zh') : '';
    
    // Fill in the translation fields
    document.getElementById('itemNameAr').value = nameAr;
    document.getElementById('itemDescriptionAr').value = descAr;
    document.getElementById('itemNameRu').value = nameRu;
    document.getElementById('itemDescriptionRu').value = descRu;
    document.getElementById('itemNameZh').value = nameZh;
    document.getElementById('itemDescriptionZh').value = descZh;
    
    showToast('✓ Translations completed successfully!');
  } catch (error) {
    console.error('Translation error:', error);
    showToast('Translation failed. Please try again or enter manually.');
  }
}

// Auto-translate (if needed) and persist translations right after saving an item
async function autoTranslateAndSaveItem(itemId, englishName, englishDescription) {
  if (!itemId) return;

  const fieldMap = [
    { code: 'ar', nameId: 'itemNameAr', descId: 'itemDescriptionAr' },
    { code: 'ru', nameId: 'itemNameRu', descId: 'itemDescriptionRu' },
    { code: 'zh', nameId: 'itemNameZh', descId: 'itemDescriptionZh' }
  ];

  for (const field of fieldMap) {
    const nameInput = document.getElementById(field.nameId);
    const descInput = document.getElementById(field.descId);
    if (!nameInput || !descInput) continue;

    let translatedName = nameInput.value.trim();
    let translatedDesc = descInput.value.trim();

    // Only auto-translate when the manager left the translation blank
    if (!translatedName && englishName) {
      translatedName = await translateText(englishName, field.code);
      nameInput.value = translatedName;
    }

    if (!translatedDesc && englishDescription) {
      translatedDesc = await translateText(englishDescription, field.code);
      descInput.value = translatedDesc;
    }

    if (!translatedName && !translatedDesc) continue;

    try {
      await fetchJson(`${apiBase()}/translations/items`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          item_id: itemId,
          language_code: field.code,
          name: translatedName,
          description: translatedDesc || null
        })
      });
    } catch (err) {
      console.error(`Failed to save ${field.code} translation:`, err);
    }
  }
}

// Translate text using MyMemory API (free, no API key required)
async function translateText(text, targetLang) {
  if (!text) return '';
  
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
    );
    const data = await response.json();
    
    if (data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    
    throw new Error('Translation failed');
  } catch (error) {
    console.error(`Failed to translate to ${targetLang}:`, error);
    // Fallback: return original text if translation fails
    return text;
  }
}

// Auto-translate function for categories
async function autoTranslateCategory() {
  const nameEn = document.getElementById('categoryName').value.trim();
  
  if (!nameEn) {
    showToast('Please enter an English name first');
    return;
  }
  
  showToast('Translating... Please wait');
  
  try {
    // Translate to Arabic
    const nameAr = await translateText(nameEn, 'ar');
    
    // Translate to Russian
    const nameRu = await translateText(nameEn, 'ru');
    
    // Translate to Chinese
    const nameZh = await translateText(nameEn, 'zh');
    
    // Fill in the translation fields
    document.getElementById('categoryNameAr').value = nameAr;
    document.getElementById('categoryNameRu').value = nameRu;
    document.getElementById('categoryNameZh').value = nameZh;
    
    showToast('✓ Translations completed successfully!');
  } catch (error) {
    console.error('Translation error:', error);
    showToast('Translation failed. Please try again or enter manually.');
  }
}

// Bulk translate all items and categories
async function translateAllItemsAndCategories() {
  if (!confirm('This will translate all categories and items to Arabic, Russian, and Chinese. This may take a few minutes. Continue?')) {
    return;
  }
  
  showToast('Starting bulk translation... Please wait and do not close this page.');
  
  let translated = 0;
  let failed = 0;
  
  try {
    // Translate all categories
    const categoriesToTranslate = categories.filter(cat => cat.name && cat.name.trim());
    const totalItems = categoriesToTranslate.length + state.items.length;
    
    for (const category of categoriesToTranslate) {
      try {
        showToast(`Translating category: ${category.name} (${translated + failed + 1}/${totalItems})`);
        
        // Translate to each language
        const nameAr = await translateText(category.name, 'ar');
        const nameRu = await translateText(category.name, 'ru');
        const nameZh = await translateText(category.name, 'zh');
        
        // Save each translation separately (same format as saveCategoryTranslations)
        const translations = [
          { language: 'ar', name: nameAr },
          { language: 'ru', name: nameRu },
          { language: 'zh', name: nameZh }
        ];
        
        for (const trans of translations) {
          if (trans.name) {
            await fetchJson(`${apiBase()}/translations/categories`, {
              method: 'PUT',
              headers: authHeaders(),
              body: JSON.stringify({ category_id: category.id, language_code: trans.language, name: trans.name })
            });
          }
        }
        
        translated++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to translate category ${category.name}:`, error);
        failed++;
      }
    }
    
    // Translate all items
    const itemsToTranslate = state.items.filter(item => item.name && item.name.trim());
    
    for (const item of itemsToTranslate) {
      try {
        showToast(`Translating item: ${item.name} (${translated + failed + 1}/${totalItems})`);
        
        // Translate name
        const nameAr = await translateText(item.name, 'ar');
        const nameRu = await translateText(item.name, 'ru');
        const nameZh = await translateText(item.name, 'zh');
        
        // Translate description if exists
        const descAr = item.description ? await translateText(item.description, 'ar') : '';
        const descRu = item.description ? await translateText(item.description, 'ru') : '';
        const descZh = item.description ? await translateText(item.description, 'zh') : '';
        
        // Save each translation separately (same format as saveItemTranslations)
        const translations = [
          { language: 'ar', name: nameAr, description: descAr },
          { language: 'ru', name: nameRu, description: descRu },
          { language: 'zh', name: nameZh, description: descZh }
        ];
        
        for (const trans of translations) {
          if (trans.name || trans.description) {
            await fetchJson(`${apiBase()}/translations/items`, {
              method: 'PUT',
              headers: authHeaders(),
              body: JSON.stringify({ item_id: item.id, language_code: trans.language, name: trans.name, description: trans.description })
            });
          }
        }
        
        translated++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to translate item ${item.name}:`, error);
        failed++;
      }
    }
    
    showToast(`✓ Bulk translation complete! Translated: ${translated}, Failed: ${failed}`);
    await reloadAll();
  } catch (error) {
    console.error('Bulk translation error:', error);
    showToast('Bulk translation failed. Please try again.');
  }
}

// ============================================================================
// BULK UPLOAD (Categories & Items)
// ============================================================================

function openBulkModal(mode = 'categories') {
  if (!ayadToken) {
    showToast('Login to use bulk update');
    return;
  }
  const modal = document.getElementById('bulkModal');
  if (!modal) return;
  bulkState.parsed = { categories: [], items: [] };
  bulkState.fileName = '';
  const fileInput = document.getElementById('bulkFileInput');
  if (fileInput) fileInput.value = '';
  const label = document.getElementById('bulkFileLabel');
  if (label) label.textContent = 'Select Excel File';
  const preview = document.getElementById('bulkPreview');
  if (preview) preview.textContent = 'Upload the Excel template to see a summary here.';
  const summary = document.getElementById('bulkSummary');
  if (summary) summary.innerHTML = '';
  setBulkMode(mode);
  modal.classList.add('show');
}

function closeBulkModal() {
  const modal = document.getElementById('bulkModal');
  if (modal) modal.classList.remove('show');
}

function setBulkMode(mode) {
  bulkState.mode = mode;
  document.querySelectorAll('.bulk-tab').forEach((btn) => {
    const target = btn.getAttribute('data-mode');
    btn.classList.toggle('active', target === mode);
  });
  document.querySelectorAll('.instruction-block').forEach((block) => {
    const target = block.getAttribute('data-mode');
    block.classList.toggle('active', target === mode);
  });
}

function downloadBulkTemplate() {
  window.location.href = '/bulk-template.xlsx';
}

function handleBulkFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    showToast('Spreadsheet parser is not available');
    return;
  }
  bulkState.fileName = file.name;
  const label = document.getElementById('bulkFileLabel');
  if (label) label.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const nextParsed = { categories: [], items: [] };

      const categorySheet = workbook.Sheets.Categories || workbook.Sheets.Category || workbook.Sheets['Sheet1'];
      const itemSheet = workbook.Sheets.Items || workbook.Sheets['Sheet2'];
      const options = { defval: '', raw: false };

      if (categorySheet) {
        nextParsed.categories = XLSX.utils
          .sheet_to_json(categorySheet, options)
          .map((row, idx) => ({ __row: idx + 2, ...row }));
      }

      if (itemSheet) {
        nextParsed.items = XLSX.utils
          .sheet_to_json(itemSheet, options)
          .map((row, idx) => ({ __row: idx + 2, ...row }));
      }

      bulkState.parsed = nextParsed;
      updateBulkPreview();
      const summary = document.getElementById('bulkSummary');
      if (summary) summary.innerHTML = '';
    } catch (err) {
      console.error('Failed to parse bulk file:', err);
      showToast('Failed to read Excel file. Please use the provided template.');
    }
  };
  reader.readAsArrayBuffer(file);
}

function updateBulkPreview() {
  const preview = document.getElementById('bulkPreview');
  if (!preview) return;
  if (!bulkState.fileName) {
    preview.textContent = 'Upload the Excel template to see a summary here.';
    return;
  }
  const catCount = bulkState.parsed.categories.length;
  const itemCount = bulkState.parsed.items.length;
  preview.textContent = `${bulkState.fileName}: ${catCount} category rows • ${itemCount} item rows`;
}

async function processBulkUpload() {
  if (!ayadToken) {
    showToast('Login to run bulk update');
    return;
  }
  const mode = bulkState.mode;
  const rows = bulkState.parsed[mode] || [];
  if (!rows.length) {
    showToast('Upload the Excel template before running bulk update');
    return;
  }

  const summaryEl = document.getElementById('bulkSummary');
  if (summaryEl) summaryEl.textContent = 'Processing...';
  const btn = document.getElementById('bulkProcessBtn');
  if (btn) btn.disabled = true;

  try {
    let summary;
    if (mode === 'categories') {
      summary = await runCategoryBulk(rows);
      await loadCategories();
      await loadItemsTableEnhanced();
    } else {
      summary = await runItemBulk(rows);
      await loadItemsTableEnhanced();
    }
    if (summaryEl) summaryEl.innerHTML = renderBulkSummary(summary);
    showToast('Bulk update finished');
  } catch (err) {
    console.error('Bulk update failed:', err);
    if (summaryEl) summaryEl.textContent = `Failed: ${err.message}`;
    showToast('Bulk update failed');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runCategoryBulk(rows) {
  const summary = { created: 0, updated: 0, deleted: 0, skipped: 0, errors: [] };
  const lookup = buildCategoryLookup();

  for (const row of rows) {
    if (isSpreadsheetRowEmpty(row)) {
      summary.skipped++;
      continue;
    }
    const rowLabel = row.__row || '?';
    const action = normalizeAction(row.Action);

    try {
      if (action === 'delete') {
        const id = parseNumberCell(row['Category ID']);
        if (!id) throw new Error('Category ID is required for delete');
        await fetchJson(`${apiBase()}/categories/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        summary.deleted++;
        lookup.delete(String(id));
        continue;
      }

      const name = (row['Category Name'] || '').toString().trim();
      if (!name) throw new Error('Category Name is required');

      let parentId = parseNumberCell(row['Parent ID']);
      if (!parentId && row['Parent Name']) {
        const parent = lookup.get(row['Parent Name'].toString().trim().toLowerCase());
        if (parent) parentId = parent.id;
      }

      const payload = {
        name,
        parent_id: parentId || null,
        sort_order: parseNumberCell(row['Sort Order']) ?? 0,
        is_visible: parseBooleanCell(row['Is Visible'], true),
        has_time_availability: parseBooleanCell(row['Has Time Availability'], false),
        available_from: row['Available From'] || null,
        available_to: row['Available To'] || null,
      };

      if (action === 'update') {
        const id = parseNumberCell(row['Category ID']);
        if (!id) throw new Error('Category ID is required for update');
        const res = await fetchJson(`${apiBase()}/categories/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        const updated = res.category;
        if (updated) {
          lookup.set(String(updated.id), updated);
          if (updated.name) {
            lookup.set(updated.name.toLowerCase(), updated);
          }
        }
        summary.updated++;
      } else {
        const res = await fetchJson(`${apiBase()}/categories`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        const created = res.category;
        if (created) {
          lookup.set(String(created.id), created);
          if (created.name) {
            lookup.set(created.name.toLowerCase(), created);
          }
        }
        summary.created++;
      }
    } catch (err) {
      summary.errors.push(`Row ${rowLabel}: ${err.message}`);
    }
  }

  return summary;
}

async function runItemBulk(rows) {
  if (!categories.length) {
    await loadCategories();
  }
  if (!state.items.length) {
    await loadItemsTableEnhanced();
  }

  const summary = { created: 0, updated: 0, deleted: 0, skipped: 0, errors: [] };
  const categoryLookup = buildCategoryLookup();

  for (const row of rows) {
    if (isSpreadsheetRowEmpty(row)) {
      summary.skipped++;
      continue;
    }
    const rowLabel = row.__row || '?';
    const action = normalizeAction(row.Action);

    try {
      if (action === 'delete') {
        const id = parseNumberCell(row['Item ID']);
        if (!id) throw new Error('Item ID is required for delete');
        await fetchJson(`${apiBase()}/items/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        summary.deleted++;
        continue;
      }

      const name = (row['Item Name'] || '').toString().trim();
      if (!name) throw new Error('Item Name is required');

      let categoryId = parseNumberCell(row['Category ID']);
      if (!categoryId && row['Category Name']) {
        const parent = categoryLookup.get(row['Category Name'].toString().trim().toLowerCase());
        if (parent) categoryId = parent.id;
      }
      if (!categoryId) throw new Error('Category ID or Category Name is required');

      const payload = {
        category_id: categoryId,
        name,
        description: row.Description || null,
        price: parseNumberCell(row.Price),
        currency_symbol: row.Currency || 'AED',
        sort_order: parseNumberCell(row['Sort Order']) ?? 0,
        is_available: parseBooleanCell(row['Is Available'], true),
        use_day_pricing: parseBooleanCell(row['Use Day Pricing'], false),
      };

      if (action === 'update') {
        const id = parseNumberCell(row['Item ID']);
        if (!id) throw new Error('Item ID is required for update');
        await fetchJson(`${apiBase()}/items/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        summary.updated++;
      } else {
        await fetchJson(`${apiBase()}/items`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        summary.created++;
      }
    } catch (err) {
      summary.errors.push(`Row ${rowLabel}: ${err.message}`);
    }
  }

  return summary;
}

function renderBulkSummary(summary) {
  if (!summary) return '';
  let html = `<p><strong>Created:</strong> ${summary.created} &nbsp; <strong>Updated:</strong> ${summary.updated} &nbsp; <strong>Deleted:</strong> ${summary.deleted} &nbsp; <strong>Skipped:</strong> ${summary.skipped}</p>`;
  if (summary.errors?.length) {
    const list = summary.errors
      .slice(0, 10)
      .map((err) => `<li>${err}</li>`)
      .join('');
    html += `<p><strong>Errors (${summary.errors.length}):</strong></p><ul>${list}</ul>`;
    if (summary.errors.length > 10) {
      html += '<p>Only first 10 errors are shown. Please fix them and retry.</p>';
    }
  }
  return html;
}

function buildCategoryLookup() {
  const map = new Map();
  categories.forEach((cat) => {
    if (!cat) return;
    map.set(String(cat.id), cat);
    if (cat.name) {
      map.set(cat.name.toLowerCase(), cat);
    }
  });
  return map;
}

function normalizeAction(value) {
  const normalized = (value || '').toString().trim().toLowerCase();
  if (['update', 'edit', 'change'].includes(normalized)) return 'update';
  if (['delete', 'remove'].includes(normalized)) return 'delete';
  return 'create';
}

function parseBooleanCell(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = value.toString().trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'on'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parseNumberCell(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function isSpreadsheetRowEmpty(row) {
  return Object.keys(row).every((key) => key === '__row' || row[key] === '' || row[key] === null || row[key] === undefined);
}

