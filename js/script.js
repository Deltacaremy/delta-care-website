/* =========================================================
   DELTACARE website script
   Data produk  -> js/products.js
   Terjemahan   -> js/i18n.js
   Bahagian:
    1. Tetapan & helper
    2. Bahasa (BM / EN)
    3. Navigasi (#hash) & header
    4. Produk: kad, featured, page Products (carian, susun, kategori)
    5. Detail produk, COA popup, produk berkaitan
    6. Troli (drawer)
    7. Kalkulator dos
    8. Animasi & lain-lain
    9. Mula
   ========================================================= */

/* ---------- 1. TETAPAN & HELPER ---------- */
const WHATSAPP_NUMBER = '601139771606';
const CART_KEY = 'deltacare_cart';
const LANG_KEY = 'deltacare_lang';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function whatsappLink(text, number = WHATSAPP_NUMBER) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
function storageGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storageSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* abaikan */ } }
function storageRemove(key) { try { localStorage.removeItem(key); } catch (e) { /* abaikan */ } }

/* ---------- AGENT (kod rujukan) ----------
   Link agent: ?ref=KOD -> disimpan 30 hari dalam browser pelanggan.
   Order & bayaran -> WhatsApp DeltaCare. Soalan -> WhatsApp agent (jika ada nombor). */
const REF_KEY = 'deltacare_ref';
const REF_DAYS = 30;
function cleanCode(code) { return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''); }
function findAgent(code) {
  const c = cleanCode(code);
  if (!c || typeof AGENTS === 'undefined') return null;
  return AGENTS.find(a => cleanCode(a.code) === c) || null;
}
// Kod yang disimpan (mungkin agent baru yang belum dimuat dari database)
function getStoredRef() {
  try {
    const r = JSON.parse(storageGet(REF_KEY));
    if (r && Date.now() - r.ts < REF_DAYS * 864e5) return cleanCode(r.code);
  } catch (e) { /* abaikan */ }
  return '';
}
function getAgent() { return findAgent(getStoredRef()); }
function saveRef(code) {
  const c = cleanCode(code).slice(0, 20);
  if (c) storageSet(REF_KEY, JSON.stringify({ code: c, ts: Date.now() }));
  else storageRemove(REF_KEY);
}
// Nombor untuk soalan / panduan: agent (jika ada nombor) atau DeltaCare
function supportNumber() {
  const a = getAgent();
  return (a && String(a.phone || '').replace(/\D/g, '')) || WHATSAPP_NUMBER;
}
function updateSupportLinks() {
  const num = supportNumber();
  $$('a[href^="https://wa.me/"]').forEach(a => { a.href = a.href.replace(/wa\.me\/\d+/, 'wa.me/' + num); });
}
// Baca ?ref=KOD dari link, kemudian buang dari alamat supaya kemas
(function captureRef() {
  const params = new URLSearchParams(location.search);
  if (!params.has('ref')) return;
  saveRef(params.get('ref'));
  params.delete('ref');
  const qs = params.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
})();
function refreshIcons() { if (window.lucide) lucide.createIcons(); }

function getProduct(id) { return PRODUCTS.find(p => p.id === Number(id)) || null; }

// Harga & promosi. Produk boleh ada sale (harga promo) dan saleEnds ('YYYY-MM-DD', hari terakhir, pilihan).
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function onSale(p) { return p.sale != null && p.sale > 0 && p.sale < p.price && (!p.saleEnds || p.saleEnds >= todayStr()); }
function priceOf(p) { return onSale(p) ? p.sale : p.price; }
function salePct(p) { return Math.round((1 - p.sale / p.price) * 100); }
function money(n) { const v = Math.round(n * 100) / 100; return v % 1 ? v.toFixed(2) : String(v); }
// Harga untuk kad/page produk: harga promo + harga asal dipotong
function priceHTML(p) {
  return onSale(p)
    ? `<span class="price-now">RM ${money(p.sale)}</span> <s class="price-was">RM ${money(p.price)}</s>`
    : `RM ${money(p.price)}`;
}
function saleBadge(p, extra = '') { return onSale(p) ? `<span class="sale-badge ${extra}">-${salePct(p)}%</span>` : ''; }

/* ---------- DATA DARI DATABASE (Supabase) ----------
   Jika js/config.js diisi, produk / pengumuman / agent dibaca dari database
   (diurus melalui dashboard /admin). Jika tidak, data js/products.js digunakan. */
const DATA_CACHE_KEY = 'deltacare_data_v1';
const DB = (() => {
  const c = window.DELTACARE_CONFIG || {};
  const url = String(c.supabaseUrl || '').trim().replace(/\/+$/, '');
  const key = String(c.supabaseAnonKey || '').trim();
  return url && key ? { url, key } : null;
})();
function dbHeaders(extra = {}) { return { apikey: DB.key, Authorization: 'Bearer ' + DB.key, ...extra }; }
function mapDbProduct(r) {
  return {
    id: Number(r.id), name: r.name, price: Number(r.price), status: r.status,
    sale: r.sale_price != null ? Number(r.sale_price) : null, saleEnds: r.sale_ends || null,
    cats: r.cats || [], img: r.img || '', strength: r.strength ? Number(r.strength) : null,
    coa: r.coa || null, desc: r.description || { en: '', ms: '' },
    benefits: r.benefits || { en: [], ms: [] }, faq: r.faq || { en: [], ms: [] }
  };
}
function applyData(d) {
  if (!d || !Array.isArray(d.products)) return false;
  PRODUCTS.splice(0, PRODUCTS.length, ...d.products);
  Object.assign(ANNOUNCEMENT, d.announcement || { enabled: false });
  if (Array.isArray(d.agents)) AGENTS.splice(0, AGENTS.length, ...d.agents);
  return true;
}
async function fetchRemoteData() {
  const get = (path) => fetch(`${DB.url}/rest/v1/${path}`, { headers: dbHeaders() })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`${path.split('?')[0]} ${r.status}`)));
  const [products, settings, agents] = await Promise.all([
    get('products?select=*&active=eq.true&order=sort_order.asc,id.asc'),
    get('settings?select=key,value'),
    get('agents?select=code,name,phone&active=eq.true')
  ]);
  const ann = settings.find(s => s.key === 'announcement');
  return { products: products.map(mapDbProduct), announcement: ann ? ann.value : null, agents };
}
// Pelawat lama: terus guna data terakhir yang disimpan (laju), kemudian semak yang terbaru
let usedDataCache = false;
if (DB) { try { usedDataCache = applyData(JSON.parse(storageGet(DATA_CACHE_KEY))); } catch (e) { /* abaikan */ } }

// Simpan order dalam database (untuk rekod & komisen). Tidak menghalang WhatsApp.
function saveOrderToDb(orderNo, lines, agentCode) {
  if (!DB) return;
  try {
    fetch(`${DB.url}/rest/v1/rpc/create_order`, {
      method: 'POST', keepalive: true,
      headers: dbHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ p_order_no: orderNo, p_items: lines.map(({ p, qty }) => ({ id: p.id, qty })), p_agent_code: agentCode || null, p_lang: lang })
    }).catch(() => { /* abaikan */ });
  } catch (e) { /* abaikan */ }
}

/* ---------- 2. BAHASA ---------- */
let lang = storageGet(LANG_KEY) === 'ms' ? 'ms' : 'en';

function t(key, vars = {}) {
  let s = (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
  Object.keys(vars).forEach(k => { s = s.replace(`{${k}}`, vars[k]); });
  return s;
}
// Ambil teks ikut bahasa dari objek {en, ms}
function L(obj) { return obj ? (obj[lang] ?? obj.en) : ''; }

// Simpan teks English asal dari HTML (sekali sahaja)
function captureDefaultTexts() {
  $$('[data-i18n]').forEach(el => { el.dataset.en = el.textContent; });
  $$('[data-i18n-html]').forEach(el => { el.dataset.enHtml = el.innerHTML; });
  $$('[data-i18n-placeholder]').forEach(el => { el.dataset.enPh = el.placeholder; });
}

function applyStaticTexts() {
  const dict = lang === 'ms' ? I18N.ms : {};
  $$('[data-i18n]').forEach(el => { el.textContent = dict[el.dataset.i18n] ?? el.dataset.en; });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = dict[el.dataset.i18nHtml] ?? el.dataset.enHtml; });
  $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = dict[el.dataset.i18nPlaceholder] ?? el.dataset.enPh; });
  document.documentElement.lang = lang === 'ms' ? 'ms' : 'en';
  $$('.lang-label').forEach(el => { el.textContent = t('lang.switchTo'); });
}

function setLanguage(newLang) {
  lang = newLang;
  storageSet(LANG_KEY, lang);
  applyStaticTexts();
  renderAllDynamic();
}

$$('.lang-toggle').forEach(btn => btn.addEventListener('click', () => setLanguage(lang === 'en' ? 'ms' : 'en')));

/* ---------- 3. NAVIGASI & HEADER ---------- */
// Alamat: #home #products #visualizer #faq #about #product-6 #calc-0
function navigateTo(target) {
  closeCart();
  if (location.hash === '#' + target) route(false);
  else location.hash = target;
}

function route(instant) {
  const hash = decodeURIComponent(location.hash.slice(1)) || 'home';
  let page = 'home';
  let m;
  if ((m = hash.match(/^product-(\d+)$/))) {
    page = fillProductDetail(Number(m[1])) ? 'detail' : 'products';
  } else if ((m = hash.match(/^calc-(\d+)$/))) {
    applyCalcPreset(Number(m[1]));
    page = 'visualizer';
  } else if (hash === 'cart') {
    page = $('.page.active')?.id.replace('page-', '') || 'home';
    openCart();
  } else if (['home', 'products', 'visualizer', 'faq', 'about'].includes(hash)) {
    page = hash;
    if (hash === 'visualizer') clearCalcFor(false);
  }
  instant ? showPage(page) : transitionTo(page);
}

function transitionTo(page) {
  const current = $('.page.active');
  if (!current || reduceMotion) return showPage(page);
  current.classList.remove('active');
  current.classList.add('leaving');
  setTimeout(() => { current.classList.remove('leaving'); showPage(page); }, 250);
}

function showPage(page) {
  $$('.page').forEach(p => p.classList.remove('active', 'leaving'));
  $('#page-' + page).classList.add('active');
  document.body.dataset.current = page;
  const navPage = page === 'detail' ? 'products' : page;
  $$('.nav-link, .mobile-link').forEach(l => l.classList.toggle('active', l.dataset.page === navPage));
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  if (page === 'products') renderProducts();
  setTimeout(observeReveals, 50);
  updateBackgroundBlur();
}

window.addEventListener('hashchange', () => route(false));

// Klik pada apa-apa elemen dengan data-page / data-go / data-add (termasuk kad yang dijana JS)
document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('[data-add]');
  if (addBtn) { e.stopPropagation(); addToCart(Number(addBtn.dataset.add), 1, addBtn); return; }
  const go = e.target.closest('[data-go]');
  if (go) { navigateTo(go.dataset.go); return; }
  const pageBtn = e.target.closest('[data-page]');
  if (pageBtn) navigateTo(pageBtn.dataset.page);
});
// Kad yang boleh ditekan juga boleh dibuka dengan papan kekunci (Enter)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[data-go][tabindex]')) navigateTo(e.target.dataset.go);
  if (e.key === 'Escape') { closeCart(); closeCoa(); closeMobileMenu(); }
});

// Menu telefon
const mobileMenu = $('#mobile-menu');
const mobileMenuBtn = $('#mobile-menu-btn');
function closeMobileMenu() { mobileMenu.classList.add('hidden'); mobileMenuBtn.setAttribute('aria-expanded', 'false'); }
mobileMenuBtn.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('hidden') === false;
  mobileMenuBtn.setAttribute('aria-expanded', String(open));
});

// Ketinggian header -> ruang atas kandungan (header berubah bila ada pengumuman / scroll)
const header = $('#site-header');
function updateHeaderHeight() { document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px'); }
if ('ResizeObserver' in window) new ResizeObserver(updateHeaderHeight).observe(header);

// Menu jadi kaca lutsinar bila scroll
function onScrollHeader() { $('#main-nav').classList.toggle('scrolled', window.scrollY > 12); }

// Bar pengumuman
function renderAnnouncement() {
  const bar = $('#announce-bar');
  let closed = null;
  try { closed = sessionStorage.getItem('deltacare_announce_closed'); } catch (e) { /* abaikan */ }
  const show = typeof ANNOUNCEMENT !== 'undefined' && ANNOUNCEMENT.enabled && closed !== ANNOUNCEMENT.text.en;
  bar.classList.toggle('hidden', !show);
  if (!show) return;
  const txt = $('#announce-text');
  txt.textContent = L(ANNOUNCEMENT.text);
  txt.disabled = !ANNOUNCEMENT.link;
  txt.onclick = () => { if (ANNOUNCEMENT.link) navigateTo(ANNOUNCEMENT.link); };
}
$('#announce-close').addEventListener('click', () => {
  try { sessionStorage.setItem('deltacare_announce_closed', ANNOUNCEMENT.text.en); } catch (e) { /* abaikan */ }
  $('#announce-bar').classList.add('hidden');
  updateHeaderHeight();
});

/* ---------- 4. PRODUK ---------- */
const STATUS_BG = { ready: 'bg-emerald-500', preorder: 'bg-amber-500', outofstock: 'bg-red-500' };

function statusBadge(p, extra = '') {
  return `<span class="status-badge ${STATUS_BG[p.status]} ${extra}">${t('status.' + p.status)}</span>`;
}
function coaBadge(extra = '') {
  return `<span class="coa-badge ${extra}"><i data-lucide="badge-check" class="w-3.5 h-3.5"></i>${t('badge.coa')}</span>`;
}

// Kad produk (page Products & "You may also like")
function productCardHTML(p, i) {
  const addBtn = p.status === 'outofstock'
    ? `<button disabled class="flex-1 bg-gray-300 text-white text-sm font-medium py-2.5 rounded-full cursor-not-allowed">${t('btn.unavailable')}</button>`
    : `<button data-add="${p.id}" class="btn-premium flex-1 bg-brand hover:bg-brand-dark text-white text-sm font-medium py-2.5 rounded-full transition-colors">${t('btn.add')}</button>`;
  return `
  <article class="product-card card-enter group" style="--i:${i}" data-go="product-${p.id}" tabindex="0" role="link" aria-label="${escapeHtml(p.name)}">
    <div class="relative overflow-hidden aspect-[3/2] bg-gray-100">
      <img src="${p.img}" alt="DELTACARE ${escapeHtml(p.name)}" class="card-img img-fade w-full h-full object-cover" loading="lazy">
      ${statusBadge(p, 'absolute top-3 right-3')}
      ${p.coa ? coaBadge('absolute top-3 left-3') : ''}
      ${saleBadge(p, 'sale-badge-card')}
    </div>
    <div class="p-5 flex flex-col flex-1">
      <h3 class="font-semibold text-lg text-navy">${escapeHtml(p.name)}</h3>
      <p class="text-sm text-gray-500 mt-1 flex-1">${escapeHtml(L(p.desc))}</p>
      <p class="text-lg font-bold text-brand mt-3 price-line">${priceHTML(p)}</p>
      ${p.status === 'preorder' ? `<p class="text-xs text-amber-600 mt-1 font-medium">${t('card.preorderNote')}</p>` : ''}
      <div class="flex gap-2 mt-4">
        <button data-go="product-${p.id}" class="flex-1 border border-gray-200 text-sm font-medium py-2.5 rounded-full hover:bg-gray-50 transition">${t('btn.viewDetails')}</button>
        ${addBtn}
      </div>
    </div>
  </article>`;
}

// Kad Featured di Home (tanpa harga & stok, seluruh kad boleh ditekan)
function renderFeatured() {
  $('#featured-grid').innerHTML = FEATURED.filter(f => getProduct(f.id)).map((f, i) => `
    <article class="featured-card reveal" style="--i:${i}" data-go="product-${f.id}" tabindex="0" role="link" aria-label="${escapeHtml(f.title)}">
      <div class="overflow-hidden aspect-[4/3] bg-gray-100">
        <img src="${f.img}" alt="DELTACARE ${escapeHtml(f.title)}" class="card-img img-fade w-full h-full object-cover" loading="lazy">
      </div>
      <div class="p-5">
        <h3 class="font-semibold text-lg text-navy">${escapeHtml(f.title)}</h3>
        <p class="text-sm text-gray-500 mt-1">${escapeHtml(L(f.desc))}</p>
        <span class="featured-link mt-4">${t('featured.view')} <i data-lucide="arrow-right" class="w-4 h-4"></i></span>
      </div>
    </article>`).join('');
}

// Page Products: kategori + carian + susunan
let currentCategory = 'all';
let searchTerm = '';
let sortMode = 'default';

function renderCategoryButtons() {
  $('#cat-buttons').innerHTML = CATEGORIES.map(c =>
    `<button class="cat-btn ${c.id === currentCategory ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c[lang] || c.en)}</button>`).join('');
  $('#footer-cats').innerHTML = CATEGORIES.filter(c => c.id !== 'all').map(c =>
    `<li><button class="footer-link" data-footer-cat="${c.id}">${escapeHtml(c[lang] || c.en)}</button></li>`).join('');
}

function setCategory(cat, animate = true) {
  currentCategory = cat;
  $$('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  const grid = $('#products-grid');
  if (!animate || reduceMotion) return renderProducts();
  grid.classList.add('fading');
  setTimeout(() => { renderProducts(); grid.classList.remove('fading'); }, 200);
}

$('#cat-buttons').addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-btn');
  if (btn) setCategory(btn.dataset.cat);
});
$('#footer-cats').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-footer-cat]');
  if (!btn) return;
  setCategory(btn.dataset.footerCat, false);
  navigateTo('products');
});

let searchTimer;
$('#product-search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { searchTerm = e.target.value.trim().toLowerCase(); renderProducts(); }, 150);
});
$('#product-sort').addEventListener('change', (e) => { sortMode = e.target.value; renderProducts(); });

function renderProducts() {
  let list = PRODUCTS.filter(p => currentCategory === 'all' || p.cats.includes(currentCategory));
  if (searchTerm) {
    list = list.filter(p => (p.name + ' ' + p.desc.en + ' ' + (p.desc.ms || '')).toLowerCase().includes(searchTerm));
  }
  if (sortMode === 'price-asc') list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  if (sortMode === 'price-desc') list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
  if (sortMode === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  $('#products-grid').innerHTML = list.map(productCardHTML).join('');
  $('#products-empty').classList.toggle('hidden', list.length > 0);
  afterRender($('#products-grid'));
}

/* ---------- 5. DETAIL PRODUK ---------- */
let detailId = null;
let detailQty = 1;

function fillProductDetail(id) {
  const p = getProduct(id);
  if (!p) return false;
  const changed = detailId !== id;
  detailId = id;
  if (changed) detailQty = 1;

  const img = $('#detail-img');
  if (img.getAttribute('src') !== p.img) { img.classList.remove('loaded'); img.src = p.img; }
  img.alt = 'DELTACARE ' + p.name;
  const badge = $('#detail-status-badge');
  badge.className = `status-badge ${STATUS_BG[p.status]} absolute top-4 left-4`;
  badge.textContent = t('status.' + p.status);

  $('#detail-name').textContent = p.name;
  $('#detail-price').innerHTML = priceHTML(p) + saleBadge(p, 'sale-badge-inline');
  const saleNote = $('#detail-sale-note');
  saleNote.classList.toggle('hidden', !onSale(p));
  if (onSale(p)) saleNote.textContent = p.saleEnds
    ? t('sale.until', { save: money(p.price - p.sale), date: new Date(p.saleEnds + 'T00:00:00').toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'long' }) })
    : t('sale.save', { save: money(p.price - p.sale) });
  $('#detail-desc').textContent = L(p.desc);
  $('#detail-coa-btn').classList.toggle('hidden', !p.coa);
  $('#detail-calc-btn').classList.toggle('hidden', !p.strength);

  $('#detail-benefits').innerHTML = L(p.benefits).map(b =>
    `<li class="flex items-start gap-2.5 text-gray-600"><i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-500 shrink-0"></i><span>${escapeHtml(b)}</span></li>`).join('');

  $('#detail-faq').innerHTML = L(p.faq).map(([q, a]) =>
    `<details class="faq-item faq-compact"><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join('');

  updateQtyDisplay();
  const addBtn = $('#detail-add-cart');
  const out = p.status === 'outofstock';
  addBtn.disabled = out;
  addBtn.classList.toggle('is-disabled', out);
  addBtn.innerHTML = `<span>${out ? t('btn.unavailable') : p.status === 'preorder' ? t('btn.addPreorder') : t('btn.add')}</span>`;
  $('#detail-preorder-note').classList.toggle('hidden', p.status !== 'preorder');

  renderRelated(p);
  afterRender($('#page-detail'));
  return true;
}

function updateQtyDisplay() { $('#qty-value').textContent = detailQty; }
$('#qty-minus').addEventListener('click', () => { detailQty = Math.max(1, detailQty - 1); updateQtyDisplay(); });
$('#qty-plus').addEventListener('click', () => { detailQty = Math.min(99, detailQty + 1); updateQtyDisplay(); });

$('#detail-add-cart').addEventListener('click', (e) => addToCart(detailId, detailQty, e.currentTarget));
$('#detail-whatsapp').addEventListener('click', () => {
  const p = getProduct(detailId);
  if (p) window.open(whatsappLink(t('wa.interest', { name: p.name, qty: detailQty, price: money(priceOf(p) * detailQty) }), supportNumber()), '_blank');
});
$('#detail-calc-btn').addEventListener('click', () => navigateTo('calc-' + detailId));
$('#detail-coa-btn').addEventListener('click', () => openCoa(detailId));

// "You may also like": produk kategori sama dulu, kemudian lain-lain
function renderRelated(p) {
  const same = PRODUCTS.filter(o => o.id !== p.id && o.cats.some(c => p.cats.includes(c)));
  const others = PRODUCTS.filter(o => o.id !== p.id && !same.includes(o));
  const list = [...same, ...others].slice(0, 3);
  $('#related-grid').innerHTML = list.map(productCardHTML).join('');
}

// COA popup
let coaLastFocus = null;
function openCoa(id) {
  const p = getProduct(id);
  if (!p || !p.coa) return;
  coaLastFocus = document.activeElement;
  $('#coa-img').src = p.coa;
  $('#coa-modal-product').textContent = p.name;
  $('#coa-zoom').classList.remove('zoomed');
  const modal = $('#coa-modal');
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('open'));
  document.body.classList.add('no-scroll');
  $('#coa-close').focus();
}
function closeCoa() {
  const modal = $('#coa-modal');
  if (modal.hidden) return;
  modal.classList.remove('open');
  document.body.classList.remove('no-scroll');
  setTimeout(() => { modal.hidden = true; }, 250);
  coaLastFocus?.focus?.();
}
$('#coa-close').addEventListener('click', closeCoa);
$('#coa-modal').addEventListener('click', (e) => { if (e.target.id === 'coa-modal') closeCoa(); });
$('#coa-zoom').addEventListener('click', () => $('#coa-zoom').classList.toggle('zoomed'));

/* ---------- 6. TROLI ---------- */
function loadCart() {
  try {
    const saved = JSON.parse(storageGet(CART_KEY)) || [];
    return saved
      .filter(item => getProduct(item.id))
      .map(item => ({ id: Number(item.id), qty: Math.max(1, Math.min(99, item.qty | 0)) }));
  } catch (e) { return []; }
}
let cart = loadCart();

function saveCart() { storageSet(CART_KEY, JSON.stringify(cart)); }
function cartLines() { return cart.map(i => ({ ...i, p: getProduct(i.id) })).filter(i => i.p); }
function cartCount() { return cart.reduce((s, i) => s + i.qty, 0); }
function cartTotal() { return money(cartLines().reduce((s, i) => s + priceOf(i.p) * i.qty, 0)); }

function updateCartBadge(animate = true) {
  saveCart();
  const count = cartCount();
  $$('.cart-badge').forEach(badge => {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
    if (animate && !reduceMotion) {
      badge.classList.remove('badge-bounce');
      void badge.offsetWidth;
      badge.classList.add('badge-bounce');
    }
  });
}

function addToCart(id, qty = 1, btn = null) {
  const p = getProduct(id);
  if (!p || p.status === 'outofstock') { showToast(t('toast.unavailable')); return; }
  const existing = cart.find(i => i.id === p.id);
  if (existing) existing.qty = Math.min(99, existing.qty + qty);
  else cart.push({ id: p.id, qty });
  updateCartBadge();
  renderCart();
  showToast(t(p.status === 'preorder' ? 'toast.addedPreorder' : 'toast.added', { name: p.name }));
  if (btn) { morphAdded(btn); flyToCart(btn); }
}

// Butang bertukar jadi "✓ Added" sekejap
function morphAdded(btn) {
  if (btn.classList.contains('is-added')) return;
  const original = btn.innerHTML;
  btn.classList.add('is-added');
  btn.innerHTML = `<span class="inline-flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 check-draw"><path d="M20 6 9 17l-5-5"/></svg>${t('btn.added')}</span>`;
  setTimeout(() => { btn.classList.remove('is-added'); btn.innerHTML = original; }, 1400);
}

function flyToCart(fromEl) {
  if (reduceMotion) return;
  const cartBtn = $$('.cart-open').find(el => el.offsetParent !== null);
  if (!cartBtn) return;
  const rect = fromEl.getBoundingClientRect();
  const cartRect = cartBtn.getBoundingClientRect();
  const fly = document.createElement('div');
  fly.className = 'fly-item';
  fly.style.cssText = `left:${rect.left + rect.width / 2 - 20}px;top:${rect.top}px;width:40px;height:40px;`;
  document.body.appendChild(fly);
  requestAnimationFrame(() => {
    fly.style.left = cartRect.left + cartRect.width / 2 - 6 + 'px';
    fly.style.top = cartRect.top + 8 + 'px';
    fly.style.width = '12px';
    fly.style.height = '12px';
    fly.style.opacity = '0';
  });
  setTimeout(() => fly.remove(), 700);
  setTimeout(() => { cartBtn.classList.add('cart-shake'); setTimeout(() => cartBtn.classList.remove('cart-shake'), 400); }, 500);
}

let toastTimer;
function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function renderCart() {
  const lines = cartLines();
  const empty = lines.length === 0;
  $('#cart-empty').classList.toggle('hidden', !empty);
  $('#cart-items').classList.toggle('hidden', empty);
  $('#cart-footer').classList.toggle('hidden', empty);
  $('#cart-items').innerHTML = lines.map(({ p, qty }, i) => `
    <div class="cart-line" style="--i:${i}">
      <img src="${p.img}" alt="" class="w-16 h-16 rounded-xl object-cover bg-gray-100 shrink-0">
      <div class="flex-1 min-w-0">
        <p class="font-medium text-navy truncate">${escapeHtml(p.name)}</p>
        <p class="text-xs text-gray-500">${onSale(p) ? `<s>RM ${money(p.price)}</s> <span class="text-brand font-semibold">RM ${money(p.sale)}</span>` : `RM ${money(p.price)}`} ${t('cart.each')}</p>
        <div class="flex items-center justify-between mt-2">
          <div class="qty-box qty-sm">
            <button type="button" data-cart-qty="${p.id}" data-d="-1" aria-label="-">−</button>
            <span>${qty}</span>
            <button type="button" data-cart-qty="${p.id}" data-d="1" aria-label="+">+</button>
          </div>
          <span class="font-semibold text-navy">RM ${money(priceOf(p) * qty)}</span>
        </div>
      </div>
      <button type="button" data-cart-remove="${p.id}" class="self-start p-1 text-gray-400 hover:text-red-600" aria-label="${t('cart.remove')}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    </div>`).join('');
  $('#cart-total').textContent = `RM ${cartTotal()}`;
  updateAgentStatus();
  refreshIcons();
}

// Kotak "Kod agent" dalam troli
const agentInput = $('#agent-code');
function updateAgentStatus() {
  const el = $('#agent-status');
  const raw = cleanCode(agentInput.value);
  const agent = findAgent(raw);
  el.classList.toggle('hidden', !raw);
  el.classList.toggle('ok', !!agent);
  el.textContent = !raw ? '' : agent ? t('cart.agentOk', { name: agent.name }) : t('cart.agentBad');
}
agentInput.addEventListener('input', () => {
  saveRef(agentInput.value);
  updateSupportLinks();
  updateAgentStatus();
});
function orderNumber() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // tiada 0/O/1/I supaya tak keliru
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `DC-${ymd}-${code}`;
}

$('#cart-items').addEventListener('click', (e) => {
  const qtyBtn = e.target.closest('[data-cart-qty]');
  const rmBtn = e.target.closest('[data-cart-remove]');
  if (qtyBtn) {
    const item = cart.find(i => i.id === Number(qtyBtn.dataset.cartQty));
    if (item) { item.qty += Number(qtyBtn.dataset.d); if (item.qty <= 0) cart = cart.filter(i => i !== item); }
  } else if (rmBtn) {
    cart = cart.filter(i => i.id !== Number(rmBtn.dataset.cartRemove));
  } else return;
  updateCartBadge(false);
  renderCart();
});

let cartLastFocus = null;
function openCart() {
  const ref = getStoredRef();
  if (ref) agentInput.value = ref;
  renderCart();
  cartLastFocus = document.activeElement;
  $('#cart-overlay').hidden = false;
  requestAnimationFrame(() => { $('#cart-overlay').classList.add('open'); $('#cart-drawer').classList.add('open'); });
  $('#cart-drawer').setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  closeMobileMenu();
  setTimeout(() => $('#cart-close').focus(), 50);
}
function closeCart() {
  const drawer = $('#cart-drawer');
  if (!drawer.classList.contains('open')) return;
  drawer.classList.remove('open');
  $('#cart-overlay').classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
  setTimeout(() => { $('#cart-overlay').hidden = true; }, 300);
  if (location.hash === '#cart') history.replaceState(null, '', '#home');
  cartLastFocus?.focus?.();
}
$$('.cart-open').forEach(b => b.addEventListener('click', openCart));
$('#cart-close').addEventListener('click', closeCart);
$('#cart-continue').addEventListener('click', closeCart);
$('#cart-overlay').addEventListener('click', closeCart);

// Mesej WhatsApp untuk order -> SENTIASA ke nombor DeltaCare (bayaran)
$('#cart-checkout-btn').addEventListener('click', () => {
  const lines = cartLines();
  if (!lines.length) return;
  const text = lines.map(({ p, qty }) => `• ${p.name} x${qty} — RM${money(priceOf(p) * qty)}${onSale(p) ? ` (promo, was RM${money(p.price * qty)})` : ''}`);
  const raw = cleanCode(agentInput.value);
  const agent = findAgent(raw);
  const agentLine = agent ? `${agent.code} (${agent.name})` : raw ? `${raw} (not registered)` : 'none (website)';
  const orderNo = orderNumber();
  saveOrderToDb(orderNo, lines, raw);
  window.open(whatsappLink(`Hello DeltaCare,\n\nI would like to order:\n\n${text.join('\n')}\n\nTotal: RM ${cartTotal()}\n\nOrder No: ${orderNo}\nAgent: ${agentLine}\n\nPlease confirm availability.`), '_blank');
});

/* ---------- 7. KALKULATOR DOS ---------- */
// Picagari dalam gambar = 1 ml (picagari insulin U-100: 1 ml = 100 units)
const SYRINGE_MAX_ML = 1.0;
const SYRINGE_BOTTOM_Y = 338;
const SYRINGE_FULL_H = 272;
const calcValues = { dose: null, strength: null, water: null };
const calcGroups = { dose: ['dose-btn', 'custom-dose'], strength: ['strength-btn', 'custom-strength'], water: ['water-btn', 'custom-water'] };

function readPositive(value) { const n = parseFloat(value); return n > 0 ? n : null; }

Object.entries(calcGroups).forEach(([key, [btnClass, inputId]]) => {
  const buttons = $$('.' + btnClass);
  const input = $('#' + inputId);
  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.val === 'other') {
      input.classList.remove('hidden');
      input.focus();
      calcValues[key] = readPositive(input.value);
    } else {
      input.classList.add('hidden');
      calcValues[key] = readPositive(btn.dataset.val);
    }
    calculateVolume();
  }));
  input.addEventListener('input', () => { calcValues[key] = readPositive(input.value); calculateVolume(); });
});

// Pilih nilai secara automatik (untuk butang "Kira Dos" dari page produk)
function selectCalcValue(key, value) {
  const [btnClass, inputId] = calcGroups[key];
  const match = $$('.' + btnClass).find(b => parseFloat(b.dataset.val) === value);
  if (match) { match.click(); return; }
  $(`.${btnClass}[data-val="other"]`).click();
  const input = $('#' + inputId);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function applyCalcPreset(id) {
  const p = getProduct(id);
  if (!p || !p.strength) return clearCalcFor(false);
  selectCalcValue('strength', p.strength);
  $('#calc-for-img').src = p.img;
  $('#calc-for-name').textContent = `${p.name}`;
  $('#calc-for').classList.remove('hidden');
}
function clearCalcFor(navigate = true) {
  $('#calc-for').classList.add('hidden');
  if (navigate) history.replaceState(null, '', '#visualizer');
}
$('#calc-for-clear').addEventListener('click', () => clearCalcFor(true));

function calculateVolume() {
  // Isipadu suntikan (ml) = (Dos / Kekuatan vial) × Air BAC
  const { dose, strength, water } = calcValues;
  updateSyringeDisplay(dose && strength && water ? (dose / strength) * water : 0);
}

let lastMl = 0;
function updateSyringeDisplay(ml) {
  lastMl = ml;
  const fillH = (Math.min(ml, SYRINGE_MAX_ML) / SYRINGE_MAX_ML) * SYRINGE_FULL_H;
  $('#syringe-liquid').setAttribute('height', fillH);
  $('#syringe-liquid').setAttribute('y', SYRINGE_BOTTOM_Y - fillH);
  $('#syringe-plunger').setAttribute('y', SYRINGE_BOTTOM_Y - fillH - 10);
  $('#viz-volume-display').textContent = ml.toFixed(2) + ' ml';
  $('#viz-units-display').textContent = t('calc.units', { n: Math.round(ml * 1000) / 10 });
  $('#viz-warning').classList.toggle('hidden', ml <= SYRINGE_MAX_ML);
  const container = $('#syringe-container');
  container.classList.add('zoom');
  setTimeout(() => container.classList.remove('zoom'), 400);
}

/* ---------- 8. ANIMASI & LAIN-LAIN ---------- */
// Elemen muncul bila di-scroll
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
function observeReveals() { $$('.reveal:not(.visible)').forEach(el => revealObserver.observe(el)); }

// Gambar pudar masuk bila siap dimuat
function wireImageFade(root = document) {
  $$('img.img-fade:not(.loaded)', root).forEach(img => {
    if (img.complete && img.naturalWidth) img.classList.add('loaded');
    else {
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      img.addEventListener('error', () => img.classList.add('loaded'), { once: true });
    }
  });
}

function afterRender(root) {
  refreshIcons();
  wireImageFade(root);
  observeReveals();
}

// Nombor naik (count-up) - contoh 99%+ Purity
const countObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    countObserver.unobserve(el);
    const target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = target; return; }
    const start = performance.now();
    const dur = 1400;
    const tick = (now) => {
      const k = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, { threshold: 0.5 });
$$('.count-up').forEach(el => countObserver.observe(el));

function updateBackgroundBlur() {
  $('.global-bg-layer')?.classList.toggle('light-blur', $('#page-home').classList.contains('active'));
}

// Ripple pada butang
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-premium');
  if (!btn || reduceMotion) return;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// Butang kembali ke atas + header kaca
const backToTop = $('#back-to-top');
window.addEventListener('scroll', () => {
  backToTop.classList.toggle('visible', window.scrollY > 500);
  onScrollHeader();
}, { passive: true });
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

// Parallax halus pada paparan produk hero (komputer sahaja)
const showcase = $('.hero-showcase');
document.addEventListener('mousemove', (e) => {
  if (!showcase || reduceMotion || window.innerWidth < 768 || !$('#page-home').classList.contains('active')) return;
  const x = (e.clientX / window.innerWidth - 0.5) * 12;
  const y = (e.clientY / window.innerHeight - 0.5) * 12;
  showcase.style.transform = `translate(${x}px, ${y}px)`;
});

// Loading screen: tutup cepat
let loaderHidden = false;
function hideLoader() {
  if (loaderHidden) return;
  loaderHidden = true;
  $('#loading-screen')?.classList.add('loaded');
}

/* ---------- 9. MULA ---------- */
function renderAllDynamic() {
  renderAnnouncement();
  renderCategoryButtons();
  renderFeatured();
  renderProducts();
  if (detailId !== null) fillProductDetail(detailId);
  updateSyringeDisplay(lastMl);
  renderCart();
  afterRender(document);
  updateHeaderHeight();
}

$('#year').textContent = new Date().getFullYear();
captureDefaultTexts();
applyStaticTexts();
renderAllDynamic();
updateCartBadge(false);
updateSupportLinks();
onScrollHeader();
if (location.hash) route(true);
else document.body.dataset.current = 'home';
updateBackgroundBlur();

// Ambil data terkini dari database (jika disambung)
function refreshFromDatabase() {
  if (!DB) return Promise.resolve();
  return fetchRemoteData().then(d => {
    const json = JSON.stringify(d);
    if (json === storageGet(DATA_CACHE_KEY) && usedDataCache) return; // tiada perubahan
    storageSet(DATA_CACHE_KEY, json);
    usedDataCache = true;
    applyData(d);
    cart = cart.filter(i => getProduct(i.id));
    updateCartBadge(false);
    renderAllDynamic();
    updateSupportLinks();
    if (/^#(product|calc)-\d+$/.test(location.hash)) route(true);
  }).catch(err => console.info('DeltaCare: guna data simpanan -', err.message));
}
const dataReady = refreshFromDatabase();
if (!DB || usedDataCache) setTimeout(hideLoader, 350);
else dataReady.then(() => setTimeout(hideLoader, 80));
setTimeout(hideLoader, 2500);

// Ikon Lucide dimuat selepas skrip ini (defer) -> lukis ikon bila siap
document.addEventListener('DOMContentLoaded', () => { refreshIcons(); updateHeaderHeight(); });
window.addEventListener('load', updateHeaderHeight);
