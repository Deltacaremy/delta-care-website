/* =========================================================
   DELTACARE Admin Dashboard
   Data disimpan dalam Supabase (lihat Delta Care\supabase\setup.sql)
   Bahagian:
    1. Tetapan, bahasa & helper
    2. Log masuk / keluar
    3. Muat data & tab
    4. Ringkasan
    5. Order
    6. Produk (termasuk promosi)
    7. Agent
    8. Pengumuman
    9. Pengguna (bos sahaja)
   Teks dashboard ditulis sebagai L('Bahasa Melayu', 'English').
   ========================================================= */
'use strict';

/* ---------- 1. TETAPAN, BAHASA & HELPER ---------- */
const CFG = window.DELTACARE_CONFIG || {};
const SB_URL = String(CFG.supabaseUrl || '').trim().replace(/\/+$/, '');
const SB_KEY = String(CFG.supabaseAnonKey || '').trim();
const SITE_URL = 'https://delta-care-website.vercel.app/';
const BUCKET = 'product-images';
const TAB_KEY = 'deltacare_admin_tab';
const LANG_KEY = 'deltacare_admin_lang';

function storageGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }

let LANG = storageGet(LANG_KEY) === 'en' ? 'en' : 'ms';
const L = (ms, en) => (LANG === 'en' ? en : ms);
const LOC = () => (LANG === 'en' ? 'en-MY' : 'ms-MY');

const PRODUCT_STATUS = {
  get ready() { return L('Stok Sedia Ada', 'Ready Stock'); },
  get preorder() { return L('Pra-Tempah', 'Pre-Order'); },
  get outofstock() { return L('Habis Stok', 'Out of Stock'); }
};
const ORDER_STATUS = {
  get new() { return L('Baru', 'New'); },
  get paid() { return L('Dibayar', 'Paid'); },
  get shipped() { return L('Dihantar', 'Shipped'); },
  get cancelled() { return L('Batal', 'Cancelled'); }
};
const TAB_TITLES = {
  get ringkasan() { return L('Ringkasan', 'Overview'); },
  get order() { return L('Order', 'Orders'); },
  get produk() { return L('Produk', 'Products'); },
  get agent() { return L('Agent', 'Agents'); },
  get pengumuman() { return L('Pengumuman', 'Announcement'); },
  get pengguna() { return L('Pengguna', 'Users'); }
};
const COUNTED = ['paid', 'shipped']; // order yang dikira sebagai jualan & komisen
const CATS = (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).filter(c => c.id !== 'all');
const catName = (c) => (LANG === 'en' ? c.en : c.ms);
const roleLabel = (r) => (r === 'boss' ? L('Bos', 'Boss') : 'Admin');

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = () => { if (window.lucide) lucide.createIcons(); };
const num = (v) => Number(v) || 0;
const round2 = (n) => Math.round(n * 100) / 100;
function rm(v) {
  const n = num(v);
  return 'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
function fmtDate(iso, withTime = true) {
  const d = new Date(iso);
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString(LOC(), opts);
}
function fmtDay(ymd) { const [y, m, d] = String(ymd).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', year: 'numeric' }); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function monthKey(iso) { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(key) { const [y, m] = key.split('-'); return new Date(+y, +m - 1, 1).toLocaleString(LOC(), { month: 'long', year: 'numeric' }); }
function cleanCode(s) { return String(s || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''); }
function cleanPhone(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '6' + d;
  return d;
}
function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'; }
function slug(s) { return String(s || 'gambar').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gambar'; }
function emptyHTML(icon, text) { return `<div class="empty"><i data-lucide="${icon}" class="ic"></i><p>${esc(text)}</p></div>`; }

// Promosi: 'on' (sedang berjalan), 'ended' (tarikh tamat sudah lepas), atau null
function saleState(p) {
  if (p.sale_price === null || p.sale_price === undefined || p.sale_price === '') return null;
  if (!(num(p.sale_price) < num(p.price))) return null;
  if (p.sale_ends && p.sale_ends < todayStr()) return 'ended';
  return 'on';
}
const pctOff = (price, sale) => (num(price) > 0 ? Math.round((1 - num(sale) / num(price)) * 100) : 0);

let toastTimer;
function toast(msg, type = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast ' + type; }, type === 'error' ? 4500 : 2500);
}
function dbError(error, what = L('Gagal menyimpan', 'Could not save')) {
  console.error(error);
  const m = String(error?.message || error || '');
  let hint = '';
  if (/sale_price|sale_ends/i.test(m)) hint = L(' (jalankan update-promo.sql di Supabase dahulu)', ' (run update-promo.sql in Supabase first)');
  else if (/duplicate key|unique/i.test(m)) hint = L(' (sudah wujud)', ' (already exists)');
  else if (/row-level security|permission denied/i.test(m)) hint = L(' (tiada kebenaran)', ' (no permission)');
  else if (/fetch|network/i.test(m)) hint = L(' (semak internet)', ' (check your internet)');
  toast(`${what}${hint}`, 'error');
}
function setLoading(btn, on) { if (btn) { btn.classList.toggle('loading', on); btn.disabled = on; } }

// Teks tetap dalam admin.html: elemen dengan data-en (English) / data-en-label (aria-label & title)
function applyStaticLang() {
  document.documentElement.lang = LANG;
  $$('[data-en]').forEach(el => {
    if (el.dataset.ms === undefined) el.dataset.ms = el.innerHTML;
    el.innerHTML = LANG === 'en' ? el.dataset.en : el.dataset.ms;
  });
  $$('[data-en-label]').forEach(el => {
    if (el.dataset.msLabel === undefined) el.dataset.msLabel = el.getAttribute('aria-label') || '';
    const v = LANG === 'en' ? el.dataset.enLabel : el.dataset.msLabel;
    el.setAttribute('aria-label', v);
    if (el.hasAttribute('title')) el.title = v;
  });
  $$('.lang-btn').forEach(b => {
    b.textContent = LANG === 'en' ? 'BM' : 'EN';
    b.title = LANG === 'en' ? 'Tukar ke Bahasa Melayu' : 'Switch to English';
    b.setAttribute('aria-label', b.title);
  });
}
function setLang(l) {
  LANG = l;
  storageSet(LANG_KEY, l);
  applyStaticLang();
  loginMsg('');
  if (state.staff) {
    $('#me-role').textContent = roleLabel(state.staff.role);
    switchTab(state.tab);
  }
  icons();
}
document.addEventListener('click', (e) => { if (e.target.closest('.lang-btn')) setLang(LANG === 'en' ? 'ms' : 'en'); });

// "Lihat website": index.html berfungsi di Vercel dan juga bila admin.html dibuka terus dari komputer
$$('[data-site-link]').forEach(a => { a.href = 'index.html'; });

// Popup umum
let modalOnClose = null;
function openModal({ title, body, foot = '', wide = false, onClose = null }) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  $('#modal-foot').innerHTML = foot;
  $('#modal-foot').hidden = !foot;
  $('#modal .modal-box').classList.toggle('wide', wide);
  $('#modal').hidden = false;
  modalOnClose = onClose;
  document.body.style.overflow = 'hidden';
  icons();
  if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => $('#modal-body input:not([type=checkbox]):not([type=file]):not([readonly]), #modal-body select, #modal-body textarea')?.focus(), 60);
}
function closeModal() {
  if ($('#modal').hidden) return;
  $('#modal').hidden = true;
  document.body.style.overflow = '';
  const fn = modalOnClose; modalOnClose = null;
  if (fn) fn();
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close-modal]')) closeModal(); });

// Popup pengesahan -> Promise<boolean>
function confirmBox(title, text, yesText = L('Ya', 'Yes'), danger = false) {
  return new Promise(resolve => {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    const yes = $('#confirm-yes');
    yes.textContent = yesText;
    yes.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    $('#confirm').hidden = false;
    setTimeout(() => yes.focus(), 50);
    const done = (v) => { $('#confirm').hidden = true; yes.onclick = no.onclick = null; resolve(v); };
    const no = $('#confirm-no');
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
    $('#confirm').onclick = (e) => { if (e.target.id === 'confirm') done(false); };
  });
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#confirm').hidden) $('#confirm-no').click();
  else closeModal();
});

/* ---------- 2. LOG MASUK / KELUAR ---------- */
let sb = null;
const state = {
  staff: null, products: [], agents: [], orders: [], settings: {}, staffList: [],
  tab: 'ringkasan', orderFilter: { q: '', status: 'all', agent: 'all', month: 'all' }, productQuery: ''
};
const isBoss = () => state.staff?.role === 'boss';

function showView(id) {
  ['view-setup', 'view-login', 'view-denied', 'view-app'].forEach(v => { $('#' + v).hidden = v !== id; });
  $('#boot').hidden = true;
  $('#auth-lang').hidden = id === 'view-app';
  icons();
}

function loginMsg(text, ok = false) {
  const el = $('#login-msg');
  el.hidden = !text;
  el.textContent = text || '';
  el.classList.toggle('ok', ok);
}

async function init() {
  applyStaticLang();
  if (!SB_URL || !SB_KEY || !window.supabase) return showView('view-setup');
  const recovering = /type=recovery/.test(location.hash);
  sb = window.supabase.createClient(SB_URL, SB_KEY);
  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') showResetForm();
  });
  const { data } = await sb.auth.getSession();
  const session = data?.session;
  if (recovering && session) return showResetForm();
  if (session) await enter(session.user);
  else showView('view-login');
}

function showResetForm() {
  showView('view-login');
  $('#login-form').hidden = true;
  $('#reset-form').hidden = false;
  setTimeout(() => $('#reset-password').focus(), 50);
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  if (!email || !password) return loginMsg(L('Sila isi email dan kata laluan.', 'Please enter your email and password.'));
  const btn = $('#login-btn');
  setLoading(btn, true); loginMsg('');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  setLoading(btn, false);
  if (error) {
    const m = error.message || '';
    if (/invalid login/i.test(m)) loginMsg(L('Email atau kata laluan salah.', 'Wrong email or password.'));
    else if (/not confirmed/i.test(m)) loginMsg(L('Email belum disahkan. Minta bos tandakan "Auto Confirm" di Supabase.', 'Email not confirmed yet. Ask the boss to tick "Auto Confirm" in Supabase.'));
    else loginMsg(L('Tidak dapat log masuk: ', 'Could not log in: ') + m);
    return;
  }
  $('#login-password').value = '';
  await enter(data.user);
});

$('#forgot-btn').addEventListener('click', async () => {
  const email = $('#login-email').value.trim();
  if (!email) return loginMsg(L('Taip email anda dahulu, kemudian tekan "Lupa kata laluan?".', 'Type your email first, then tap "Forgot password?".'));
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) loginMsg(L('Tidak dapat hantar email: ', 'Could not send email: ') + error.message);
  else loginMsg(L('Jika email ini berdaftar, link untuk tukar kata laluan telah dihantar. Semak inbox / spam.', 'If this email is registered, a password reset link has been sent. Check your inbox / spam.'), true);
});

$('#reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $('#reset-password').value;
  const msg = $('#reset-msg');
  if (pw.length < 8) { msg.hidden = false; msg.textContent = L('Kata laluan mesti sekurang-kurangnya 8 aksara.', 'Password must be at least 8 characters.'); return; }
  const { data, error } = await sb.auth.updateUser({ password: pw });
  if (error) { msg.hidden = false; msg.textContent = L('Gagal: ', 'Failed: ') + error.message; return; }
  history.replaceState(null, '', location.pathname);
  $('#reset-form').hidden = true;
  $('#login-form').hidden = false;
  toast(L('Kata laluan baru disimpan', 'New password saved'));
  await enter(data.user);
});

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-pw-toggle]');
  if (t) {
    const input = t.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
    t.innerHTML = `<i data-lucide="${input.type === 'password' ? 'eye' : 'eye-off'}" class="ic"></i>`;
    icons();
  }
  if (e.target.closest('[data-logout]')) {
    await sb?.auth.signOut();
    state.staff = null;
    clearInterval(pollTimer);
    $('#login-form').hidden = false;
    $('#reset-form').hidden = true;
    loginMsg('');
    showView('view-login');
  }
});

async function enter(user) {
  const { data, error } = await sb.from('staff').select('email, name, role');
  const me = (data || []).find(s => s.email.toLowerCase() === String(user.email).toLowerCase());
  if (error || !me) {
    $('#denied-email').textContent = user.email;
    return showView('view-denied');
  }
  state.staff = me;
  state.staffList = data;
  const name = me.name || user.email.split('@')[0];
  $('#me-name').textContent = name;
  $('#me-role').textContent = roleLabel(me.role);
  $('#me-avatar').textContent = initials(name);
  $$('.boss-only').forEach(el => { el.hidden = !isBoss(); });
  showView('view-app');
  const saved = storageGet(TAB_KEY);
  switchTab(saved in TAB_TITLES && (saved !== 'pengguna' || isBoss()) ? saved : 'ringkasan', false);
  await loadAll();
  startPolling();
}

/* ---------- 3. MUAT DATA & TAB ---------- */
async function loadAll(silent = false) {
  const btn = $('#refresh-btn');
  if (!silent) setLoading(btn, true);
  const [p, a, o, s, st] = await Promise.all([
    sb.from('products').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true }),
    sb.from('agents').select('*').order('created_at', { ascending: true }),
    sb.from('orders').select('*').order('created_at', { ascending: false }).limit(2000),
    sb.from('settings').select('*'),
    sb.from('staff').select('*').order('created_at', { ascending: true })
  ]);
  if (!silent) setLoading(btn, false);
  const err = [p, a, o, s, st].find(r => r.error);
  if (err) dbError(err.error, L('Gagal memuat data', 'Could not load data'));
  state.products = p.data || state.products;
  state.agents = a.data || state.agents;
  state.orders = o.data || state.orders;
  state.settings = Object.fromEntries((s.data || []).map(r => [r.key, r.value]));
  state.staffList = st.data || state.staffList;
  renderTab();
  updateNewCount();
}

function switchTab(tab, render = true) {
  state.tab = tab;
  storageSet(TAB_KEY, tab);
  $$('#side-nav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab').forEach(t => { t.hidden = t.id !== 'tab-' + tab; });
  $('#page-title').textContent = TAB_TITLES[tab];
  $('#page-eyebrow').textContent = tab === 'ringkasan' ? new Date().toLocaleDateString(LOC(), { weekday: 'long', day: 'numeric', month: 'long' }) : 'DeltaCare';
  if (render) renderTab();
  window.scrollTo({ top: 0 });
}
$('#side-nav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) switchTab(b.dataset.tab);
});
$('#refresh-btn').addEventListener('click', () => loadAll());

function renderTab() {
  ({ ringkasan: renderSummary, order: renderOrders, produk: renderProducts, agent: renderAgents, pengumuman: renderAnnouncement, pengguna: renderStaff })[state.tab]?.();
  icons();
}

function updateNewCount() {
  const n = state.orders.filter(o => o.status === 'new').length;
  const el = $('#nav-new-count');
  el.hidden = !n;
  el.textContent = n;
}

// Semak order baru setiap 60 saat
let pollTimer;
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (document.hidden || !state.staff || !$('#modal').hidden) return;
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(2000);
    if (error || !data) return;
    const known = new Set(state.orders.map(o => o.id));
    const fresh = data.filter(o => !known.has(o.id));
    state.orders = data;
    updateNewCount();
    if (fresh.length) {
      toast(fresh.length === 1 ? L(`Order baru masuk: ${fresh[0].order_no}`, `New order: ${fresh[0].order_no}`) : L(`${fresh.length} order baru masuk`, `${fresh.length} new orders`));
      if (['ringkasan', 'order', 'agent'].includes(state.tab)) renderTab();
    }
  }, 60000);
}

/* ---------- Kiraan bersama ---------- */
function agentByCode(code) { return state.agents.find(a => a.code === code) || null; }
function agentLabel(o) {
  if (!o.agent_code) return `<span class="chip chip-none">${L('Tiada agent', 'No agent')}</span>`;
  if (!o.agent_name && !agentByCode(o.agent_code)) return `<span class="chip chip-warn" title="${L('Kod tidak berdaftar', 'Unregistered code')}">${esc(o.agent_code)} ?</span>`;
  return `<span class="chip">${esc(o.agent_code)}</span> <small class="muted">${esc(o.agent_name || agentByCode(o.agent_code)?.name || '')}</small>`;
}
function itemsSummary(items) { return (items || []).map(i => `${i.name} ×${i.qty}`).join(', '); }
function agentStats(code) {
  const list = state.orders.filter(o => o.agent_code === code && COUNTED.includes(o.status));
  return {
    count: list.length,
    sales: list.reduce((s, o) => s + num(o.total), 0),
    due: list.filter(o => !o.commission_paid).reduce((s, o) => s + num(o.commission), 0),
    paid: list.filter(o => o.commission_paid).reduce((s, o) => s + num(o.commission), 0)
  };
}
function statusSelect(o) {
  return `<select class="select select-sm" data-order-status="${o.id}" aria-label="${L('Status order', 'Order status')}">
    ${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}
  </select>`;
}

async function updateOrder(id, patch, okMsg = L('Order dikemas kini', 'Order updated')) {
  const o = state.orders.find(x => x.id === id);
  const before = { ...o };
  Object.assign(o, patch);
  const { error } = await sb.from('orders').update(patch).eq('id', id);
  if (error) { Object.assign(o, before); dbError(error); renderTab(); return false; }
  toast(okMsg);
  updateNewCount();
  return true;
}

// Tukar status / komisen terus dari senarai
document.addEventListener('change', async (e) => {
  const s = e.target.closest('[data-order-status]');
  if (s) {
    await updateOrder(Number(s.dataset.orderStatus), { status: s.value }, `Status: ${ORDER_STATUS[s.value]}`);
    renderTab();
  }
  const c = e.target.closest('[data-comm-paid]');
  if (c) {
    await updateOrder(Number(c.dataset.commPaid), { commission_paid: c.checked }, c.checked ? L('Komisen ditanda dibayar', 'Commission marked as paid') : L('Komisen ditanda belum dibayar', 'Commission marked as unpaid'));
    renderTab();
  }
});
document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-open-order]');
  if (o && !e.target.closest('select, input, label')) openOrder(Number(o.dataset.openOrder));
});

/* ---------- 4. RINGKASAN ---------- */
function renderSummary() {
  const now = new Date();
  const thisMonth = monthKey(now.toISOString());
  const monthOrders = state.orders.filter(o => monthKey(o.created_at) === thisMonth && o.status !== 'cancelled');
  const monthSales = monthOrders.filter(o => COUNTED.includes(o.status)).reduce((s, o) => s + num(o.total), 0);
  const newOrders = state.orders.filter(o => o.status === 'new');
  const due = state.orders.filter(o => COUNTED.includes(o.status) && !o.commission_paid).reduce((s, o) => s + num(o.commission), 0);
  const unavailable = state.products.filter(p => p.active && p.status !== 'ready');
  const onSale = state.products.filter(p => p.active && saleState(p) === 'on');

  // Prestasi agent bulan ini
  const byAgent = {};
  monthOrders.filter(o => COUNTED.includes(o.status)).forEach(o => {
    const k = o.agent_code || '—';
    byAgent[k] = byAgent[k] || { code: k, name: o.agent_name || (k === '—' ? L('Tiada agent (website)', 'No agent (website)') : k), count: 0, sales: 0 };
    byAgent[k].count++; byAgent[k].sales += num(o.total);
  });
  const ranking = Object.values(byAgent).sort((a, b) => b.sales - a.sales);

  $('#tab-ringkasan').innerHTML = `
    <div class="stats">
      ${statCard('bell-ring', 'tone-red', L('Order baru', 'New orders'), newOrders.length, L('Menunggu bayaran', 'Awaiting payment'))}
      ${statCard('trending-up', 'tone-green', L('Jualan bulan ini', 'Sales this month'), rm(monthSales), L('Order dibayar & dihantar', 'Paid & shipped orders'))}
      ${statCard('shopping-bag', 'tone-navy', L('Order bulan ini', 'Orders this month'), monthOrders.length, monthLabel(thisMonth))}
      ${statCard('wallet', 'tone-amber', L('Komisen belum dibayar', 'Unpaid commission'), rm(due), L('Semua agent', 'All agents'))}
    </div>
    <div class="two-col">
      <div class="card">
        <div class="card-head"><h3>${L('Order terkini', 'Latest orders')}</h3><button class="btn btn-ghost btn-sm" data-goto="order">${L('Lihat semua', 'View all')} <i data-lucide="arrow-right" class="ic"></i></button></div>
        <div class="rows">
          ${state.orders.slice(0, 7).map(o => `
            <div class="row row-mini" data-open-order="${o.id}">
              <div class="cell-main"><b>${esc(o.order_no)}</b><small>${fmtDate(o.created_at)} · ${esc(itemsSummary(o.items))}</small></div>
              <span class="cell-money">${rm(o.total)}</span>
              <span class="pill pill-${o.status}">${ORDER_STATUS[o.status]}</span>
            </div>`).join('') || emptyHTML('inbox', L('Belum ada order. Order dari website akan muncul di sini.', 'No orders yet. Orders from the website will appear here.'))}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card">
          <div class="card-head"><h3>${L('Prestasi agent', 'Agent performance')} (${esc(monthLabel(thisMonth))})</h3></div>
          <div class="rows">
            ${ranking.map((r, i) => `
              <div class="row row-mini" style="cursor:default">
                <div class="cell-main"><b>${i + 1}. ${esc(r.name)}</b><small>${r.count} order</small></div>
                <span class="cell-money">${rm(r.sales)}</span><span></span>
              </div>`).join('') || emptyHTML('users', L('Belum ada jualan bulan ini.', 'No sales this month yet.'))}
          </div>
        </div>
        ${onSale.length ? `<div class="card">
          <div class="card-head"><h3>${L('Promosi sedang berjalan', 'Running promotions')}</h3><button class="btn btn-ghost btn-sm" data-goto="produk">${L('Produk', 'Products')} <i data-lucide="arrow-right" class="ic"></i></button></div>
          <div class="rows">
            ${onSale.map(p => `
              <div class="row row-mini" data-edit-product="${p.id}">
                <div class="cell-main"><b>${esc(p.name)}</b><small>${p.sale_ends ? L('Hingga ', 'Until ') + fmtDay(p.sale_ends) : L('Tiada tarikh tamat', 'No end date')}</small></div>
                <span class="cell-money">${rm(p.sale_price)}</span><span class="promo-tag">-${pctOff(p.price, p.sale_price)}%</span>
              </div>`).join('')}
          </div>
        </div>` : ''}
        <div class="card">
          <div class="card-head"><h3>${L('Stok perlu perhatian', 'Stock needing attention')}</h3><button class="btn btn-ghost btn-sm" data-goto="produk">${L('Produk', 'Products')} <i data-lucide="arrow-right" class="ic"></i></button></div>
          <div class="rows">
            ${unavailable.map(p => `
              <div class="row row-mini" data-edit-product="${p.id}">
                <div class="cell-main"><b>${esc(p.name)}</b></div>
                <span></span><span class="pill pill-${p.status}">${PRODUCT_STATUS[p.status]}</span>
              </div>`).join('') || emptyHTML('check-circle', L('Semua produk aktif ada stok.', 'All active products are in stock.'))}
          </div>
        </div>
      </div>
    </div>`;
}
function statCard(icon, tone, label, value, sub) {
  return `<div class="card stat"><div class="stat-icon ${tone}"><i data-lucide="${icon}" class="ic"></i></div>
    <div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div><div class="stat-sub">${esc(sub)}</div></div>`;
}
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) switchTab(g.dataset.goto);
});

/* ---------- 5. ORDER ---------- */
function filteredOrders() {
  const f = state.orderFilter;
  const q = f.q.trim().toLowerCase();
  return state.orders.filter(o =>
    (f.status === 'all' || o.status === f.status) &&
    (f.agent === 'all' || (f.agent === '__none' ? !o.agent_code : o.agent_code === f.agent)) &&
    (f.month === 'all' || monthKey(o.created_at) === f.month) &&
    (!q || o.order_no.toLowerCase().includes(q) || String(o.agent_code || '').toLowerCase().includes(q) ||
      String(o.agent_name || '').toLowerCase().includes(q) || itemsSummary(o.items).toLowerCase().includes(q) || String(o.note || '').toLowerCase().includes(q))
  );
}

function renderOrders() {
  const f = state.orderFilter;
  const months = [...new Set(state.orders.map(o => monthKey(o.created_at)))];
  const codes = [...new Set([...state.agents.map(a => a.code), ...state.orders.map(o => o.agent_code).filter(Boolean)])];
  const list = filteredOrders();
  const counted = list.filter(o => COUNTED.includes(o.status));
  const tab = $('#tab-order');
  tab.innerHTML = `
    <div class="toolbar">
      <div class="search"><i data-lucide="search" class="ic"></i><input class="input" id="order-q" placeholder="${L('Cari no. order, agent, produk...', 'Search order no., agent, product...')}" value="${esc(f.q)}"></div>
      <select class="select" id="order-status" aria-label="Status">
        <option value="all">${L('Semua status', 'All statuses')}</option>
        ${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <select class="select" id="order-agent" aria-label="Agent">
        <option value="all">${L('Semua agent', 'All agents')}</option>
        <option value="__none" ${f.agent === '__none' ? 'selected' : ''}>${L('Tiada agent (website)', 'No agent (website)')}</option>
        ${codes.map(c => `<option value="${esc(c)}" ${f.agent === c ? 'selected' : ''}>${esc(c)}${agentByCode(c) ? ' - ' + esc(agentByCode(c).name) : L(' (tidak berdaftar)', ' (unregistered)')}</option>`).join('')}
      </select>
      <select class="select" id="order-month" aria-label="${L('Bulan', 'Month')}">
        <option value="all">${L('Semua bulan', 'All months')}</option>
        ${months.map(m => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${esc(monthLabel(m))}</option>`).join('')}
      </select>
    </div>
    <p class="summary-line"><b>${list.length}</b> order · ${L('Jualan (dibayar + dihantar)', 'Sales (paid + shipped)')}: <b>${rm(counted.reduce((s, o) => s + num(o.total), 0))}</b> · ${L('Komisen', 'Commission')}: <b>${rm(counted.reduce((s, o) => s + num(o.commission), 0))}</b></p>
    <div class="card">
      <div class="rows" id="order-rows">
        <div class="row row-order row-head"><span>Order</span><span>Agent</span><span>${L('Jumlah', 'Total')}</span><span>Status</span><span>${L('Komisen', 'Commission')}</span><span></span></div>
        ${list.map(orderRow).join('') || emptyHTML('inbox', state.orders.length ? L('Tiada order sepadan dengan carian.', 'No orders match your search.') : L('Belum ada order.', 'No orders yet.'))}
      </div>
    </div>`;
  const q = $('#order-q', tab);
  q.addEventListener('input', () => { state.orderFilter.q = q.value; renderOrderRows(); });
  ['status', 'agent', 'month'].forEach(k => $('#order-' + k, tab).addEventListener('change', (e) => { state.orderFilter[k] = e.target.value; renderOrders(); icons(); }));
}
function renderOrderRows() {
  const list = filteredOrders();
  const rows = $('#order-rows');
  rows.innerHTML = rows.firstElementChild.outerHTML + (list.map(orderRow).join('') || emptyHTML('inbox', L('Tiada order sepadan dengan carian.', 'No orders match your search.')));
  icons();
}
function orderRow(o) {
  const comm = num(o.commission) > 0
    ? `<div class="comm"><b>${rm(o.commission)}</b><label class="check"><input type="checkbox" data-comm-paid="${o.id}" ${o.commission_paid ? 'checked' : ''}> ${L('Komisen dibayar', 'Commission paid')}</label></div>`
    : '<span class="muted small">—</span>';
  return `<div class="row row-order" data-open-order="${o.id}" style="cursor:pointer">
    <div class="cell-main"><b>${esc(o.order_no)}</b><small>${fmtDate(o.created_at)}</small><small>${esc(itemsSummary(o.items))}</small></div>
    <div class="c-agent">${agentLabel(o)}</div>
    <div class="cell-money c-total">${rm(o.total)}</div>
    <div class="c-status">${statusSelect(o)}</div>
    <div class="c-comm">${comm}</div>
    <button type="button" class="icon-btn c-open" aria-label="${L('Butiran', 'Details')}"><i data-lucide="chevron-right" class="ic"></i></button>
  </div>`;
}

function openOrder(id) {
  const o = state.orders.find(x => x.id === id);
  if (!o) return;
  const agentOpts = state.agents.map(a => `<option value="${esc(a.code)}" ${o.agent_code === a.code ? 'selected' : ''}>${esc(a.code)} - ${esc(a.name)} (${num(a.commission_pct)}%)</option>`).join('');
  const unknown = o.agent_code && !agentByCode(o.agent_code) ? `<option value="${esc(o.agent_code)}" selected>${esc(o.agent_code)}${L(' (tidak berdaftar)', ' (unregistered)')}</option>` : '';
  const priceTd = (i) => i.orig && num(i.orig) > num(i.price)
    ? `<s class="muted">${rm(i.orig)}</s> ${rm(i.price)} <span class="promo-tag">PROMO</span>`
    : rm(i.price);
  openModal({
    title: `Order ${o.order_no}`,
    wide: true,
    body: `
      <dl class="kv">
        <dt>${L('Tarikh', 'Date')}</dt><dd>${fmtDate(o.created_at)}</dd>
        <dt>${L('Bahasa pelanggan', 'Customer language')}</dt><dd>${o.lang === 'ms' ? 'Bahasa Melayu' : 'English'}</dd>
      </dl>
      <table class="items-table">
        <thead><tr><th>${L('Produk', 'Product')}</th><th>${L('Harga', 'Price')}</th><th>${L('Kuantiti', 'Qty')}</th><th>${L('Jumlah', 'Total')}</th></tr></thead>
        <tbody>${(o.items || []).map(i => `<tr><td>${esc(i.name)}</td><td>${priceTd(i)}</td><td>${num(i.qty)}</td><td>${rm(num(i.price) * num(i.qty))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">${L('Jumlah', 'Total')}</td><td>${rm(o.total)}</td></tr></tfoot>
      </table>
      <div class="grid-2">
        <label class="field-label">Status
          <select class="select" id="od-status">${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <label class="field-label">Agent
          <select class="select" id="od-agent"><option value="">${L('Tiada agent', 'No agent')}</option>${unknown}${agentOpts}</select>
          <span class="field-hint">${L('Tukar jika pelanggan sebenarnya dibawa oleh agent lain.', 'Change this if the customer was actually brought by another agent.')}</span>
        </label>
        <label class="field-label">${L('Komisen (RM)', 'Commission (RM)')}
          <input class="input" id="od-comm" type="number" min="0" step="0.01" value="${num(o.commission)}">
          <span class="field-hint" id="od-comm-hint"></span>
        </label>
        <label class="field-label">${L('Komisen sudah dibayar?', 'Commission paid?')}
          <span style="display:block;margin-top:10px"><label class="switch"><input type="checkbox" id="od-paid" ${o.commission_paid ? 'checked' : ''}><span class="track"></span><span>${L('Sudah dibayar', 'Paid')}</span></label></span>
        </label>
      </div>
      <label class="field-label">${L('Nota dalaman (pelanggan tidak nampak)', 'Internal note (customer cannot see)')}
        <textarea class="textarea" id="od-note" placeholder="${L('cth. nama pelanggan, alamat, no. tracking...', 'e.g. customer name, address, tracking no....')}">${esc(o.note)}</textarea>
      </label>`,
    foot: `<button type="button" class="btn btn-danger left" id="od-delete"><i data-lucide="trash-2" class="ic"></i> ${L('Padam', 'Delete')}</button>
      <button type="button" class="btn btn-secondary" data-close-modal>${L('Batal', 'Cancel')}</button>
      <button type="button" class="btn btn-primary" id="od-save"><i data-lucide="check" class="ic"></i> ${L('Simpan', 'Save')}</button>`
  });
  const agentSel = $('#od-agent'), commInput = $('#od-comm'), hint = $('#od-comm-hint');
  const pctOf = (code) => num(agentByCode(code)?.commission_pct);
  const showHint = () => {
    const code = agentSel.value;
    hint.textContent = code && agentByCode(code) ? `${L('Cadangan', 'Suggested')} ${pctOf(code)}% = ${rm(num(o.total) * pctOf(code) / 100)}` : '';
  };
  agentSel.addEventListener('change', () => {
    const code = agentSel.value;
    commInput.value = code && agentByCode(code) ? Math.round(num(o.total) * pctOf(code)) / 100 : 0;
    showHint();
  });
  showHint();
  $('#od-save').addEventListener('click', async (e) => {
    const code = agentSel.value || null;
    const ag = code ? agentByCode(code) : null;
    const patch = {
      status: $('#od-status').value,
      agent_code: code,
      agent_name: ag ? ag.name : (code === o.agent_code ? o.agent_name : null),
      commission_pct: ag ? num(ag.commission_pct) : (code === o.agent_code ? num(o.commission_pct) : 0),
      commission: Math.max(0, num(commInput.value)),
      commission_paid: $('#od-paid').checked,
      note: $('#od-note').value.trim()
    };
    setLoading(e.currentTarget, true);
    const ok = await updateOrder(o.id, patch, L('Order disimpan', 'Order saved'));
    if (ok) { closeModal(); renderTab(); } else setLoading(e.currentTarget, false);
  });
  $('#od-delete').addEventListener('click', async () => {
    if (!await confirmBox(L('Padam order ini?', 'Delete this order?'),
      L(`Order ${o.order_no} akan dipadam terus. Gunakan status "Batal" jika mahu simpan rekod.`, `Order ${o.order_no} will be deleted permanently. Use the "Cancelled" status if you want to keep a record.`),
      L('Padam', 'Delete'), true)) return;
    const { error } = await sb.from('orders').delete().eq('id', o.id);
    if (error) return dbError(error, L('Gagal memadam', 'Could not delete'));
    state.orders = state.orders.filter(x => x.id !== o.id);
    closeModal(); updateNewCount(); renderTab();
    toast(L('Order dipadam', 'Order deleted'));
  });
}

/* ---------- 6. PRODUK ---------- */
function renderProducts() {
  const q = state.productQuery.trim().toLowerCase();
  const list = state.products.filter(p => !q || p.name.toLowerCase().includes(q));
  const tab = $('#tab-produk');
  const shown = state.products.filter(p => p.active).length;
  const hidden = state.products.length - shown;
  tab.innerHTML = `
    <div class="toolbar">
      <div class="search"><i data-lucide="search" class="ic"></i><input class="input" id="product-q" placeholder="${L('Cari produk...', 'Search products...')}" value="${esc(state.productQuery)}"></div>
      <span class="spacer"></span>
      <button type="button" class="btn btn-primary" id="add-product"><i data-lucide="plus" class="ic"></i> ${L('Tambah Produk', 'Add Product')}</button>
    </div>
    <p class="summary-line"><b>${shown}</b> ${L('produk dipaparkan di website', 'products shown on the website')} · ${hidden} ${L('disorok', 'hidden')}</p>
    <div class="card"><div class="rows">
      <div class="row row-product row-head"><span></span><span>${L('Produk', 'Product')}</span><span>${L('Harga', 'Price')}</span><span>${L('Stok', 'Stock')}</span><span>${L('Di website', 'On website')}</span><span></span></div>
      ${list.map(productRow).join('') || emptyHTML('package', L('Tiada produk.', 'No products.'))}
    </div></div>`;
  const qi = $('#product-q', tab);
  qi.addEventListener('input', () => { state.productQuery = qi.value; const pos = qi.selectionStart; renderProducts(); icons(); const n = $('#product-q'); n.focus(); n.setSelectionRange(pos, pos); });
  $('#add-product', tab).addEventListener('click', () => openProduct(null));
}
function priceCell(p) {
  const st = saleState(p);
  if (st === 'on') return `<s class="was">${rm(p.price)}</s><span class="now">${rm(p.sale_price)} <span class="promo-tag">-${pctOff(p.price, p.sale_price)}%</span></span>`;
  if (st === 'ended') return `${rm(p.price)}<small class="muted">${L('Promosi tamat', 'Promo ended')}</small>`;
  return rm(p.price);
}
function productRow(p) {
  const cats = (p.cats || []).map(c => { const x = CATS.find(y => y.id === c); return x ? catName(x) : c; }).join(', ');
  return `<div class="row row-product ${p.active ? '' : 'inactive'}">
    ${p.img ? `<img class="thumb" src="${esc(p.img)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}
    <div class="cell-main"><b>${esc(p.name)}</b><small>${esc(cats) || L('Tiada kategori', 'No category')}${p.coa ? ' · COA' : ''}</small></div>
    <div class="cell-money c-price">${priceCell(p)}</div>
    <div class="c-status"><select class="select select-sm" data-product-status="${p.id}" aria-label="${L('Stok', 'Stock')}">
      ${Object.entries(PRODUCT_STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}
    </select></div>
    <div class="c-active"><label class="switch" title="${L('Tunjuk di website', 'Show on website')}"><input type="checkbox" data-product-active="${p.id}" ${p.active ? 'checked' : ''}><span class="track"></span></label></div>
    <div class="c-actions"><button type="button" class="btn btn-secondary btn-sm" data-edit-product="${p.id}"><i data-lucide="pencil" class="ic"></i> Edit</button></div>
  </div>`;
}
async function patchProduct(id, patch, msg) {
  const p = state.products.find(x => x.id === id);
  const before = { ...p };
  Object.assign(p, patch);
  const { error } = await sb.from('products').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { Object.assign(p, before); dbError(error); }
  else toast(msg);
  renderTab();
}
document.addEventListener('change', (e) => {
  const s = e.target.closest('[data-product-status]');
  if (s) patchProduct(Number(s.dataset.productStatus), { status: s.value }, `${L('Stok', 'Stock')}: ${PRODUCT_STATUS[s.value]}`);
  const a = e.target.closest('[data-product-active]');
  if (a) patchProduct(Number(a.dataset.productActive), { active: a.checked }, a.checked ? L('Produk dipaparkan di website', 'Product shown on the website') : L('Produk disorok dari website', 'Product hidden from the website'));
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-edit-product]');
  if (b) openProduct(Number(b.dataset.editProduct));
});

// Kecilkan gambar sebelum upload (jimat ruang & laju)
function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob && blob.type === 'image/webp') return resolve({ blob, ext: 'webp' });
        canvas.toBlob(b2 => b2 ? resolve({ blob: b2, ext: 'jpg' }) : reject(new Error('compress')), 'image/jpeg', quality);
      }, 'image/webp', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(L('Fail bukan gambar', 'Not an image file'))); };
    img.src = url;
  });
}
async function uploadImage(file, folder, name, maxSize, quality) {
  const { blob, ext } = await compressImage(file, maxSize, quality);
  const path = `${folder}/${Date.now()}-${slug(name)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function openProduct(id) {
  const isNew = id === null;
  const p = isNew
    ? { name: '', price: 0, status: 'ready', cats: [], img: '', strength: null, coa: '', description: { en: '', ms: '' }, benefits: { en: [], ms: [] }, faq: { en: [], ms: [] }, sort_order: (Math.max(0, ...state.products.map(x => num(x.sort_order))) + 10), active: true, sale_price: null, sale_ends: null }
    : JSON.parse(JSON.stringify(state.products.find(x => x.id === id) || null));
  if (!p) return;
  const form = { img: p.img || '', coa: p.coa || '', lang: 'ms', text: {
    en: { desc: p.description?.en || '', benefits: (p.benefits?.en || []).join('\n'), faq: (p.faq?.en || []).map(x => [...x]) },
    ms: { desc: p.description?.ms || '', benefits: (p.benefits?.ms || []).join('\n'), faq: (p.faq?.ms || []).map(x => [...x]) }
  } };
  const hasSale = p.sale_price !== null && p.sale_price !== undefined && p.sale_price !== '';

  openModal({
    title: isNew ? L('Tambah Produk', 'Add Product') : `Edit: ${p.name}`,
    wide: true,
    body: `
      <p class="section-title">${L('Maklumat asas', 'Basic info')}</p>
      <label class="field-label">${L('Nama produk', 'Product name')} <input class="input" id="pf-name" value="${esc(p.name)}" placeholder="${L('cth.', 'e.g.')} Retatrutide 10mg" maxlength="80"></label>
      <div class="grid-3">
        <label class="field-label">${L('Harga asal', 'Original price')} <span class="input-prefix"><span>RM</span><input class="input" id="pf-price" type="number" min="0" step="0.01" value="${num(p.price)}"></span></label>
        <label class="field-label">${L('Stok', 'Stock')}
          <select class="select" id="pf-status">${Object.entries(PRODUCT_STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <label class="field-label">${L('Susunan', 'Order')} <input class="input" id="pf-sort" type="number" step="1" value="${num(p.sort_order)}"><span class="field-hint">${L('Nombor kecil = di depan', 'Smaller number = shown first')}</span></label>
      </div>
      <div class="field-label">${L('Kategori', 'Categories')}
        <div class="cat-checks">${CATS.map(c => `<label><input type="checkbox" value="${c.id}" ${(p.cats || []).includes(c.id) ? 'checked' : ''}> ${esc(catName(c))}</label>`).join('')}</div>
      </div>
      <div class="grid-2">
        <label class="field-label">${L('Kekuatan vial (mg)', 'Vial strength (mg)')}
          <input class="input" id="pf-strength" type="number" min="0" step="0.01" value="${p.strength ?? ''}" placeholder="${L('Kosongkan jika bukan vial', 'Leave empty if not a vial')}">
          <span class="field-hint">${L('Untuk butang "Kira Dos". Kosongkan untuk pen / kapsul.', 'For the "Calculate Dosage" button. Leave empty for pens / capsules.')}</span>
        </label>
        <label class="field-label">${L('Tunjuk di website', 'Show on website')}
          <span style="display:block;margin-top:10px"><label class="switch"><input type="checkbox" id="pf-active" ${p.active ? 'checked' : ''}><span class="track"></span><span>${L('Aktif', 'Active')}</span></label></span>
        </label>
      </div>

      <p class="section-title">${L('Promosi', 'Promotion')}</p>
      <label class="switch"><input type="checkbox" id="pf-sale-on" ${hasSale ? 'checked' : ''}><span class="track"></span><span>${L('Ada promosi (harga asal dipotong di website)', 'On sale (original price crossed out on the website)')}</span></label>
      <div class="sale-box" id="pf-sale-box" ${hasSale ? '' : 'hidden'}>
        <div class="grid-3">
          <label class="field-label">${L('Jenis potongan', 'Discount type')}
            <select class="select" id="pf-sale-type">
              <option value="rm">${L('Harga promo (RM)', 'Promo price (RM)')}</option>
              <option value="pct">${L('Potongan peratus (%)', 'Percent off (%)')}</option>
            </select>
          </label>
          <label class="field-label"><span id="pf-sale-label">${L('Harga promo', 'Promo price')}</span>
            <span class="input-prefix"><span id="pf-sale-unit">RM</span><input class="input" id="pf-sale-val" type="number" min="0" step="0.01" value="${hasSale ? num(p.sale_price) : ''}"></span>
          </label>
          <label class="field-label">${L('Tamat promosi (pilihan)', 'Promo ends (optional)')}
            <input class="input" id="pf-sale-ends" type="date" value="${esc(p.sale_ends || '')}">
            <span class="field-hint">${L('Hari terakhir promosi. Kosongkan = tiada tarikh tamat.', 'Last day of the promo. Leave empty = no end date.')}</span>
          </label>
        </div>
        <div class="sale-preview" id="pf-sale-preview"></div>
      </div>

      <p class="section-title">${L('Gambar', 'Images')}</p>
      <div class="grid-2">
        <div><span class="field-label" style="margin-bottom:6px">${L('Gambar produk', 'Product image')}</span><div class="img-field" id="pf-img-box"></div></div>
        <div><span class="field-label" style="margin-bottom:6px">${L('Sijil COA (pilihan)', 'COA certificate (optional)')}</span><div class="img-field" id="pf-coa-box"></div></div>
      </div>

      <p class="section-title">${L('Penerangan', 'Description')}</p>
      <div class="lang-tabs" id="pf-lang"><button type="button" data-lang="ms" class="active">Bahasa Melayu</button><button type="button" data-lang="en">English</button></div>
      <div id="pf-text"></div>`,
    foot: `${isNew ? '' : `<button type="button" class="btn btn-danger left" id="pf-delete"><i data-lucide="trash-2" class="ic"></i> ${L('Padam', 'Delete')}</button>`}
      <button type="button" class="btn btn-secondary" data-close-modal>${L('Batal', 'Cancel')}</button>
      <button type="button" class="btn btn-primary" id="pf-save"><i data-lucide="check" class="ic"></i> ${isNew ? L('Tambah', 'Add') : L('Simpan', 'Save')}</button>`
  });

  // --- promosi
  const saleOn = $('#pf-sale-on'), saleType = $('#pf-sale-type'), saleVal = $('#pf-sale-val'), saleEnds = $('#pf-sale-ends');
  const priceNow = () => Math.max(0, num($('#pf-price').value));
  // Harga promo dalam RM (null jika belum diisi)
  const salePrice = () => {
    if (saleVal.value === '') return null;
    const v = num(saleVal.value);
    return saleType.value === 'pct' ? round2(priceNow() * (1 - v / 100)) : round2(v);
  };
  const drawSale = () => {
    $('#pf-sale-box').hidden = !saleOn.checked;
    const pct = saleType.value === 'pct';
    $('#pf-sale-unit').textContent = pct ? '%' : 'RM';
    $('#pf-sale-label').textContent = pct ? L('Potongan', 'Discount') : L('Harga promo', 'Promo price');
    saleVal.max = pct ? 99 : '';
    const box = $('#pf-sale-preview');
    const price = priceNow(), sp = salePrice();
    box.className = 'sale-preview';
    if (sp === null) { box.textContent = L('Isi harga promo atau peratus potongan.', 'Enter a promo price or a percent off.'); return; }
    if (!(sp > 0 && sp < price)) { box.classList.add('bad'); box.textContent = L('Harga promo mesti lebih rendah daripada harga asal.', 'Promo price must be lower than the original price.'); return; }
    const ended = saleEnds.value && saleEnds.value < todayStr();
    box.innerHTML = `${L('Di website', 'On the website')}: <s>${rm(price)}</s> <b>${rm(sp)}</b> <span class="promo-tag">-${pctOff(price, sp)}%</span>
      <small>${ended ? `<span class="bad-text">${L('Tarikh tamat sudah lepas, jadi promosi tidak dipaparkan.', 'The end date has passed, so the promo is not shown.')}</span>`
        : saleEnds.value ? L(`Pelanggan jimat ${rm(price - sp)}. Tamat selepas ${fmtDay(saleEnds.value)}.`, `Customers save ${rm(price - sp)}. Ends after ${fmtDay(saleEnds.value)}.`)
        : L(`Pelanggan jimat ${rm(price - sp)}. Tiada tarikh tamat: matikan suis bila promosi habis.`, `Customers save ${rm(price - sp)}. No end date: switch off when the promo is over.`)}</small>`;
  };
  // Tukar jenis: tukar nilai supaya harga promo kekal sama
  saleType.addEventListener('change', () => {
    const price = priceNow();
    if (saleVal.value !== '' && price > 0) {
      const v = num(saleVal.value);
      saleVal.value = saleType.value === 'pct' ? Math.round((1 - v / price) * 1000) / 10 : round2(price * (1 - v / 100));
    }
    drawSale();
  });
  saleOn.addEventListener('change', () => { drawSale(); if (saleOn.checked && !matchMedia('(pointer: coarse)').matches) saleVal.focus(); });
  [saleVal, saleEnds, $('#pf-price')].forEach(el => el.addEventListener('input', drawSale));
  drawSale();

  // --- gambar
  const imgBox = (key, boxId, label, maxSize, quality) => {
    const box = $(boxId);
    const draw = () => {
      box.innerHTML = `${form[key] ? `<img src="${esc(form[key])}" alt="">` : '<span class="img-empty"><i data-lucide="image" class="ic"></i></span>'}
        <div class="img-field-actions">
          <label class="btn btn-secondary btn-sm"><i data-lucide="upload" class="ic"></i> ${form[key] ? L('Tukar gambar', 'Change image') : L('Pilih gambar', 'Choose image')}<input type="file" accept="image/*" hidden></label>
          ${form[key] && key === 'coa' ? `<button type="button" class="link-btn" style="margin:0" data-remove>${L('Buang COA', 'Remove COA')}</button>` : ''}
          <span class="field-hint">${label}</span>
        </div>`;
      icons();
      box.querySelector('input[type=file]').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const btn = box.querySelector('label.btn');
        setLoading(btn, true);
        try {
          form[key] = await uploadImage(file, key === 'coa' ? 'coa' : 'products', $('#pf-name').value || 'produk', maxSize, quality);
          toast(L('Gambar dimuat naik', 'Image uploaded'));
        } catch (err) { dbError(err, L('Gagal muat naik gambar', 'Could not upload image')); }
        draw();
      });
      box.querySelector('[data-remove]')?.addEventListener('click', () => { form[key] = ''; draw(); });
    };
    draw();
  };
  imgBox('img', '#pf-img-box', L('Akan dikecilkan secara automatik', 'Resized automatically'), 1200, 0.85);
  imgBox('coa', '#pf-coa-box', L('Gambar sijil yang jelas', 'A clear photo of the certificate'), 2000, 0.9);

  // --- teks dwibahasa
  const saveText = () => {
    const t = form.text[form.lang];
    t.desc = $('#pf-desc').value;
    t.benefits = $('#pf-benefits').value;
    t.faq = $$('#pf-faq .faq-row').map(r => [r.querySelector('.input').value, r.querySelector('.textarea').value]);
  };
  const drawText = () => {
    const t = form.text[form.lang];
    const tag = form.lang === 'ms' ? 'BM' : 'EN';
    $('#pf-text').innerHTML = `
      <label class="field-label">${L('Penerangan ringkas', 'Short description')} (${tag}) <input class="input" id="pf-desc" value="${esc(t.desc)}" maxlength="160"></label>
      <label class="field-label">${L('Kelebihan', 'Benefits')} (${tag}) <textarea class="textarea" id="pf-benefits" placeholder="${L('Satu kelebihan setiap baris', 'One benefit per line')}">${esc(t.benefits)}</textarea><span class="field-hint">${L('Satu kelebihan setiap baris.', 'One benefit per line.')}</span></label>
      <div class="field-label" style="margin-bottom:6px">${L('Soalan lazim', 'FAQ')} (${tag})</div>
      <div id="pf-faq">${t.faq.map(([q, a]) => faqRowHTML(q, a)).join('')}</div>
      <button type="button" class="btn btn-secondary btn-sm" id="pf-faq-add"><i data-lucide="plus" class="ic"></i> ${L('Tambah soalan', 'Add question')}</button>`;
    icons();
    $('#pf-faq-add').addEventListener('click', () => { $('#pf-faq').insertAdjacentHTML('beforeend', faqRowHTML('', '')); icons(); $('#pf-faq .faq-row:last-child .input').focus(); });
    $('#pf-faq').addEventListener('click', (e) => { if (e.target.closest('[data-faq-del]')) e.target.closest('.faq-row').remove(); });
  };
  drawText();
  $('#pf-lang').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b || b.dataset.lang === form.lang) return;
    saveText();
    form.lang = b.dataset.lang;
    $$('#pf-lang button').forEach(x => x.classList.toggle('active', x === b));
    drawText();
  });

  // --- simpan
  $('#pf-save').addEventListener('click', async (e) => {
    saveText();
    const name = $('#pf-name').value.trim();
    if (!name) { toast(L('Sila isi nama produk', 'Please enter the product name'), 'error'); return $('#pf-name').focus(); }
    const lines = (s) => s.split('\n').map(x => x.trim()).filter(Boolean);
    const faqs = (arr) => arr.map(([q, a]) => [q.trim(), a.trim()]).filter(([q, a]) => q && a);
    const strength = num($('#pf-strength').value);
    const price = priceNow();
    let sale_price = null, sale_ends = null;
    if (saleOn.checked) {
      const sp = salePrice();
      if (sp === null || !(sp > 0 && sp < price)) { toast(L('Harga promo mesti lebih rendah daripada harga asal', 'Promo price must be lower than the original price'), 'error'); return saleVal.focus(); }
      sale_price = sp;
      sale_ends = saleEnds.value || null;
    }
    const row = {
      name,
      price,
      status: $('#pf-status').value,
      sort_order: Math.round(num($('#pf-sort').value)),
      cats: $$('.cat-checks input:checked').map(c => c.value),
      strength: strength > 0 ? strength : null,
      active: $('#pf-active').checked,
      img: form.img,
      coa: form.coa || null,
      description: { en: form.text.en.desc.trim(), ms: form.text.ms.desc.trim() },
      benefits: { en: lines(form.text.en.benefits), ms: lines(form.text.ms.benefits) },
      faq: { en: faqs(form.text.en.faq), ms: faqs(form.text.ms.faq) },
      updated_at: new Date().toISOString()
    };
    // Lajur promosi hanya dihantar bila perlu (supaya database lama tanpa lajur ini masih boleh simpan produk)
    if (sale_price !== null || hasSale) Object.assign(row, { sale_price, sale_ends });
    if (!row.img) { toast(L('Sila pilih gambar produk', 'Please choose a product image'), 'error'); return; }
    setLoading(e.currentTarget, true);
    const res = isNew
      ? await sb.from('products').insert(row).select().single()
      : await sb.from('products').update(row).eq('id', id).select().single();
    if (res.error) { setLoading(e.currentTarget, false); return dbError(res.error); }
    if (isNew) state.products.push(res.data);
    else state.products = state.products.map(x => x.id === id ? res.data : x);
    state.products.sort((a, b) => num(a.sort_order) - num(b.sort_order) || a.id - b.id);
    closeModal(); renderTab();
    toast(isNew ? L('Produk ditambah', 'Product added') : L('Produk disimpan', 'Product saved'));
  });

  $('#pf-delete')?.addEventListener('click', async () => {
    if (!await confirmBox(L('Padam produk ini?', 'Delete this product?'),
      L(`"${p.name}" akan dipadam terus. Jika cuma mahu sorok sementara, matikan suis "Aktif".`, `"${p.name}" will be deleted permanently. To hide it for a while, switch off "Active" instead.`),
      L('Padam', 'Delete'), true)) return;
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) return dbError(error, L('Gagal memadam', 'Could not delete'));
    state.products = state.products.filter(x => x.id !== id);
    closeModal(); renderTab();
    toast(L('Produk dipadam', 'Product deleted'));
  });
}
function faqRowHTML(q, a) {
  return `<div class="faq-row"><div><input class="input" placeholder="${L('Soalan', 'Question')}" value="${esc(q)}"><textarea class="textarea" placeholder="${L('Jawapan', 'Answer')}">${esc(a)}</textarea></div>
    <button type="button" class="icon-btn" data-faq-del aria-label="${L('Buang soalan', 'Remove question')}"><i data-lucide="trash-2" class="ic"></i></button></div>`;
}

/* ---------- 7. AGENT ---------- */
function agentLink(code) { return `${SITE_URL}?ref=${encodeURIComponent(code)}`; }
function renderAgents() {
  const tab = $('#tab-agent');
  tab.innerHTML = `
    <div class="toolbar">
      <div class="link-box" style="margin:0;flex:1 1 320px"><i data-lucide="link" class="ic"></i><span>${L('Link agent', 'Agent link')}: <code>${esc(SITE_URL)}?ref=${L('KOD', 'CODE')}</code> · ${L('Order &amp; bayaran ke WhatsApp DeltaCare, soalan ke WhatsApp agent.', 'Orders &amp; payment go to DeltaCare WhatsApp, questions go to the agent\'s WhatsApp.')}</span></div>
      <button type="button" class="btn btn-primary" id="add-agent"><i data-lucide="user-plus" class="ic"></i> ${L('Tambah Agent', 'Add Agent')}</button>
    </div>
    <div class="agent-grid">
      ${state.agents.map(agentCard).join('') || `<div class="card">${emptyHTML('users', L('Belum ada agent.', 'No agents yet.'))}</div>`}
    </div>`;
  $('#add-agent', tab).addEventListener('click', () => openAgent(null));
}
function agentCard(a) {
  const s = agentStats(a.code);
  return `<div class="card agent-card ${a.active ? '' : 'inactive'}">
    <div class="agent-top">
      <span class="agent-avatar">${esc(initials(a.name))}</span>
      <div class="cell-main"><b>${esc(a.name)}</b><small><span class="chip">${esc(a.code)}</span> · ${num(a.commission_pct)}% ${L('komisen', 'commission')}${a.active ? '' : ` · <b style="display:inline;color:var(--muted)">${L('Tidak aktif', 'Inactive')}</b>`}</small>
        <small>${a.phone ? `<i data-lucide="phone" class="ic" style="width:12px;height:12px;vertical-align:-1px"></i> +${esc(a.phone)}` : L('Tiada no. WhatsApp', 'No WhatsApp number')}</small></div>
    </div>
    <div class="agent-stats">
      <div><small>Order</small><b>${s.count}</b></div>
      <div><small>${L('Jualan', 'Sales')}</small><b>${rm(s.sales)}</b></div>
      <div><small>${L('Belum bayar', 'Unpaid')}</small><b style="color:${s.due ? 'var(--warn)' : 'inherit'}">${rm(s.due)}</b></div>
    </div>
    <div class="agent-actions">
      <button type="button" class="btn btn-secondary btn-sm" data-copy-link="${esc(a.code)}"><i data-lucide="copy" class="ic"></i> ${L('Salin link', 'Copy link')}</button>
      <button type="button" class="btn btn-secondary btn-sm" data-edit-agent="${a.id}"><i data-lucide="pencil" class="ic"></i> Edit</button>
      ${s.due > 0 ? `<button type="button" class="btn btn-dark btn-sm" data-pay-agent="${esc(a.code)}"><i data-lucide="wallet" class="ic"></i> ${L('Bayar', 'Pay')} ${rm(s.due)}</button>` : ''}
    </div>
  </div>`;
}
document.addEventListener('click', async (e) => {
  const c = e.target.closest('[data-copy-link]');
  if (c) {
    const link = agentLink(c.dataset.copyLink);
    try { await navigator.clipboard.writeText(link); toast(L('Link disalin: ', 'Link copied: ') + link); }
    catch (err) { window.prompt(L('Salin link ini:', 'Copy this link:'), link); }
  }
  const ed = e.target.closest('[data-edit-agent]');
  if (ed) openAgent(Number(ed.dataset.editAgent));
  const pay = e.target.closest('[data-pay-agent]');
  if (pay) {
    const code = pay.dataset.payAgent;
    const a = agentByCode(code);
    const s = agentStats(code);
    const who = a?.name || code;
    if (!await confirmBox(L(`Bayar komisen ${who}?`, `Pay ${who}'s commission?`),
      L(`${rm(s.due)} akan ditanda sebagai SUDAH DIBAYAR untuk semua order agent ini yang berstatus Dibayar / Dihantar.`, `${rm(s.due)} will be marked as PAID for all of this agent's orders with status Paid / Shipped.`),
      L('Tanda dibayar', 'Mark as paid'))) return;
    const { error } = await sb.from('orders').update({ commission_paid: true }).eq('agent_code', code).in('status', COUNTED).eq('commission_paid', false);
    if (error) return dbError(error);
    state.orders.forEach(o => { if (o.agent_code === code && COUNTED.includes(o.status)) o.commission_paid = true; });
    renderTab();
    toast(L(`Komisen ${who} ditanda dibayar`, `${who}'s commission marked as paid`));
  }
});

function openAgent(id) {
  const isNew = id === null;
  const a = isNew ? { code: '', name: '', phone: '', commission_pct: 10, active: true } : state.agents.find(x => x.id === id);
  if (!a) return;
  openModal({
    title: isNew ? L('Tambah Agent', 'Add Agent') : `Edit Agent: ${a.name}`,
    body: `
      <div class="grid-2">
        <label class="field-label">${L('Nama', 'Name')} <input class="input" id="af-name" value="${esc(a.name)}" maxlength="60" placeholder="${L('cth.', 'e.g.')} Aiman"></label>
        <label class="field-label">${L('Kod agent', 'Agent code')} <input class="input upper" id="af-code" value="${esc(a.code)}" maxlength="20" placeholder="${L('cth.', 'e.g.')} AIMAN" ${isNew ? '' : 'readonly'}>
          <span class="field-hint">${isNew ? L('Huruf & nombor sahaja. Tidak boleh ditukar selepas disimpan.', 'Letters & numbers only. Cannot be changed after saving.') : L('Kod tidak boleh ditukar (link agent & rekod order guna kod ini).', 'The code cannot be changed (agent links & order records use it).')}</span></label>
      </div>
      <div class="grid-2">
        <label class="field-label">${L('No. WhatsApp', 'WhatsApp number')} <input class="input" id="af-phone" value="${esc(a.phone)}" inputmode="tel" placeholder="${L('cth.', 'e.g.')} 0123456789">
          <span class="field-hint">${L('Pelanggan agent ini akan bertanya soalan ke nombor ini.', 'This agent\'s customers will send questions to this number.')}</span></label>
        <label class="field-label">${L('Komisen', 'Commission')} <span class="input-prefix"><span>%</span><input class="input" id="af-pct" type="number" min="0" max="100" step="0.5" value="${num(a.commission_pct)}"></span>
          <span class="field-hint">${L('Dikira automatik untuk order baru.', 'Calculated automatically for new orders.')}</span></label>
      </div>
      <label class="switch"><input type="checkbox" id="af-active" ${a.active ? 'checked' : ''}><span class="track"></span><span>${L('Aktif (link & kod boleh digunakan)', 'Active (link & code can be used)')}</span></label>
      <p class="small muted" id="af-link" style="margin:16px 0 0"></p>`,
    foot: `${isNew ? '' : `<button type="button" class="btn btn-danger left" id="af-delete"><i data-lucide="trash-2" class="ic"></i> ${L('Padam', 'Delete')}</button>`}
      <button type="button" class="btn btn-secondary" data-close-modal>${L('Batal', 'Cancel')}</button>
      <button type="button" class="btn btn-primary" id="af-save"><i data-lucide="check" class="ic"></i> ${isNew ? L('Tambah', 'Add') : L('Simpan', 'Save')}</button>`
  });
  const codeInput = $('#af-code');
  const showLink = () => { const c = cleanCode(codeInput.value); $('#af-link').innerHTML = c ? `Link: <code>${esc(agentLink(c))}</code>` : ''; };
  codeInput.addEventListener('input', () => { const pos = codeInput.selectionStart; codeInput.value = cleanCode(codeInput.value); codeInput.setSelectionRange(pos, pos); showLink(); });
  if (isNew) $('#af-name').addEventListener('input', () => { if (!codeInput.dataset.touched) { codeInput.value = cleanCode($('#af-name').value.split(/\s+/)[0]).slice(0, 20); showLink(); } });
  codeInput.addEventListener('keydown', () => { codeInput.dataset.touched = '1'; });
  showLink();

  $('#af-save').addEventListener('click', async (e) => {
    const row = {
      name: $('#af-name').value.trim(),
      phone: cleanPhone($('#af-phone').value),
      commission_pct: Math.min(100, Math.max(0, num($('#af-pct').value))),
      active: $('#af-active').checked
    };
    if (isNew) row.code = cleanCode(codeInput.value);
    if (!row.name) { toast(L('Sila isi nama agent', 'Please enter the agent\'s name'), 'error'); return $('#af-name').focus(); }
    if (isNew && !/^[A-Z0-9_-]{2,20}$/.test(row.code)) { toast(L('Kod agent mesti 2-20 huruf/nombor', 'Agent code must be 2-20 letters/numbers'), 'error'); return codeInput.focus(); }
    if (isNew && agentByCode(row.code)) { toast(L('Kod ini sudah digunakan', 'This code is already in use'), 'error'); return codeInput.focus(); }
    if (row.phone && !/^\d{9,15}$/.test(row.phone)) { toast(L('No. WhatsApp tidak sah', 'Invalid WhatsApp number'), 'error'); return $('#af-phone').focus(); }
    setLoading(e.currentTarget, true);
    const res = isNew
      ? await sb.from('agents').insert(row).select().single()
      : await sb.from('agents').update(row).eq('id', id).select().single();
    if (res.error) { setLoading(e.currentTarget, false); return dbError(res.error); }
    if (isNew) state.agents.push(res.data);
    else state.agents = state.agents.map(x => x.id === id ? res.data : x);
    closeModal(); renderTab();
    toast(isNew ? L(`Agent ${row.name} ditambah`, `Agent ${row.name} added`) : L('Agent disimpan', 'Agent saved'));
  });
  $('#af-delete')?.addEventListener('click', async () => {
    const s = agentStats(a.code);
    const text = s.count
      ? L(`${a.name} ada ${s.count} order. Rekod order kekal, tetapi lebih baik matikan suis "Aktif" sahaja.`, `${a.name} has ${s.count} orders. Order records are kept, but it is better to just switch off "Active".`)
      : L(`${a.name} (${a.code}) akan dipadam.`, `${a.name} (${a.code}) will be deleted.`);
    if (!await confirmBox(L('Padam agent ini?', 'Delete this agent?'), text, L('Padam', 'Delete'), true)) return;
    const { error } = await sb.from('agents').delete().eq('id', id);
    if (error) return dbError(error, L('Gagal memadam', 'Could not delete'));
    state.agents = state.agents.filter(x => x.id !== id);
    closeModal(); renderTab();
    toast(L('Agent dipadam', 'Agent deleted'));
  });
}

/* ---------- 8. PENGUMUMAN ---------- */
function renderAnnouncement() {
  const ann = state.settings.announcement || { enabled: false, text: { en: '', ms: '' }, link: '' };
  const pages = [['', L('Tiada (teks sahaja)', 'None (text only)')], ['products', L('Page Produk', 'Products page')], ['faq', L('Page FAQ', 'FAQ page')], ['about', L('Page About', 'About page')]];
  const tab = $('#tab-pengumuman');
  tab.innerHTML = `
    <div class="card card-pad" style="max-width:760px">
      <p class="section-title">${L('Pratonton', 'Preview')}</p>
      <div class="announce-preview" id="an-preview"></div>
      <p class="small muted" style="margin:8px 0 22px">${L('Bar ini muncul di bahagian paling atas website.', 'This bar appears at the very top of the website.')}</p>
      <label class="switch" style="margin-bottom:20px"><input type="checkbox" id="an-enabled" ${ann.enabled ? 'checked' : ''}><span class="track"></span><span>${L('Tunjuk bar pengumuman', 'Show the announcement bar')}</span></label>
      <label class="field-label">${L('Teks (Bahasa Melayu)', 'Text (Bahasa Melayu)')} <input class="input" id="an-ms" maxlength="120" value="${esc(ann.text?.ms)}" placeholder="cth. BARU: HRS HepatoRenal Support kini tersedia"></label>
      <label class="field-label">${L('Teks (English)', 'Text (English)')} <input class="input" id="an-en" maxlength="120" value="${esc(ann.text?.en)}" placeholder="e.g. NEW: HRS HepatoRenal Support is now available"></label>
      <label class="field-label">${L('Bila ditekan, buka', 'When tapped, open')}
        <select class="select" id="an-link">
          ${pages.map(([v, l]) => `<option value="${v}" ${(ann.link || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
          <optgroup label="${L('Produk', 'Products')}">${state.products.map(p => `<option value="product-${p.id}" ${ann.link === 'product-' + p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>
        </select>
      </label>
      <div style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-primary" id="an-save"><i data-lucide="check" class="ic"></i> ${L('Simpan', 'Save')}</button></div>
    </div>`;
  const preview = () => {
    const el = $('#an-preview');
    const ms = $('#an-ms').value, en = $('#an-en').value;
    el.textContent = (LANG === 'en' ? en || ms : ms || en) || L('(tiada teks)', '(no text)');
    el.classList.toggle('off', !$('#an-enabled').checked);
  };
  ['an-ms', 'an-en', 'an-enabled'].forEach(i => $('#' + i).addEventListener('input', preview));
  preview();
  $('#an-save').addEventListener('click', async (e) => {
    const value = { enabled: $('#an-enabled').checked, text: { en: $('#an-en').value.trim(), ms: $('#an-ms').value.trim() }, link: $('#an-link').value };
    if (value.enabled && !value.text.en && !value.text.ms) return toast(L('Sila isi teks pengumuman', 'Please enter the announcement text'), 'error');
    if (!value.text.en) value.text.en = value.text.ms;
    if (!value.text.ms) value.text.ms = value.text.en;
    setLoading(e.currentTarget, true);
    const { error } = await sb.from('settings').upsert({ key: 'announcement', value, updated_at: new Date().toISOString() });
    setLoading(e.currentTarget, false);
    if (error) return dbError(error);
    state.settings.announcement = value;
    toast(value.enabled ? L('Pengumuman disimpan & dipaparkan', 'Announcement saved & shown') : L('Pengumuman disimpan (disorok)', 'Announcement saved (hidden)'));
  });
}

/* ---------- 9. PENGGUNA (bos sahaja) ---------- */
function renderStaff() {
  const tab = $('#tab-pengguna');
  if (!isBoss()) { tab.innerHTML = emptyHTML('lock', L('Hanya bos boleh urus pengguna.', 'Only the boss can manage users.')); return; }
  const myEmail = state.staff.email.toLowerCase();
  tab.innerHTML = `
    <div class="link-box"><i data-lucide="info" class="ic"></i><span>${L('Selepas tambah di sini, cipta akaun login di <b>Supabase → Authentication → Users → Add user</b> (email yang sama, tandakan <b>Auto Confirm</b>).', 'After adding someone here, create their login in <b>Supabase → Authentication → Users → Add user</b> (same email, tick <b>Auto Confirm</b>).')}</span></div>
    <div class="two-col">
      <div class="card"><div class="card-head"><h3>${L('Senarai pengguna', 'Users')}</h3></div><div class="rows">
        ${state.staffList.map(s => `<div class="row row-mini" style="cursor:default">
          <div class="cell-main"><b>${esc(s.name || s.email)}</b><small>${esc(s.email)}</small></div>
          <span class="pill pill-plain ${s.role === 'boss' ? 'pill-paid' : 'pill-new'}">${roleLabel(s.role)}</span>
          ${s.email.toLowerCase() === myEmail ? `<span class="small muted">${L('Anda', 'You')}</span>` : `<button type="button" class="icon-btn" data-del-staff="${esc(s.email)}" aria-label="${L('Buang', 'Remove')}"><i data-lucide="trash-2" class="ic"></i></button>`}
        </div>`).join('')}
      </div></div>
      <div class="card card-pad">
        <h3 style="font-size:1rem;margin-bottom:14px">${L('Tambah pengguna', 'Add user')}</h3>
        <label class="field-label">Email <input class="input" id="sf-email" type="email" placeholder="admin@gmail.com"></label>
        <label class="field-label">${L('Nama', 'Name')} <input class="input" id="sf-name" placeholder="${L('cth.', 'e.g.')} Siti"></label>
        <label class="field-label">${L('Peranan', 'Role')}
          <select class="select" id="sf-role"><option value="admin">Admin</option><option value="boss">${roleLabel('boss')}</option></select>
          <span class="field-hint">${L('Bos boleh urus pengguna. Admin boleh urus yang lain.', 'The boss can manage users. Admins can manage everything else.')}</span>
        </label>
        <button type="button" class="btn btn-primary btn-block" id="sf-add"><i data-lucide="user-plus" class="ic"></i> ${L('Tambah', 'Add')}</button>
      </div>
    </div>`;
  $('#sf-add', tab).addEventListener('click', async (e) => {
    const row = { email: $('#sf-email').value.trim().toLowerCase(), name: $('#sf-name').value.trim(), role: $('#sf-role').value };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return toast(L('Email tidak sah', 'Invalid email'), 'error');
    setLoading(e.currentTarget, true);
    const { data, error } = await sb.from('staff').insert(row).select().single();
    setLoading(e.currentTarget, false);
    if (error) return dbError(error);
    state.staffList.push(data);
    renderTab();
    toast(L('Pengguna ditambah. Jangan lupa cipta akaun login di Supabase.', 'User added. Remember to create their login in Supabase.'));
  });
}
document.addEventListener('click', async (e) => {
  const d = e.target.closest('[data-del-staff]');
  if (!d) return;
  const email = d.dataset.delStaff;
  if (!await confirmBox(L('Buang pengguna?', 'Remove user?'), L(`${email} tidak akan dapat masuk dashboard lagi.`, `${email} will no longer be able to open the dashboard.`), L('Buang', 'Remove'), true)) return;
  const { error } = await sb.from('staff').delete().eq('email', email);
  if (error) return dbError(error, L('Gagal membuang', 'Could not remove'));
  state.staffList = state.staffList.filter(s => s.email !== email);
  renderTab();
  toast(L('Pengguna dibuang', 'User removed'));
});

/* ---------- MULA ---------- */
init().catch(err => { console.error(err); showView('view-login'); loginMsg(L('Ralat: ', 'Error: ') + err.message); });
