window.addEventListener('load', () => { setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 1200); });

function updateBackgroundBlur() {
  const bgLayer = document.querySelector('.global-bg-layer');
  bgLayer.classList.toggle('light-blur', document.getElementById('page-home').classList.contains('active'));
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

function observeReveals() { document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealObserver.observe(el)); }
observeReveals();
updateBackgroundBlur();

let cart = JSON.parse(localStorage.getItem('deltacare_cart')) || [];
// 2. TERUS panggil updateCartBadge() di sini supaya badge dan nombor muncul terus!
updateCartBadge();

function navigateTo(page) {
  const current = document.querySelector('.page.active');
  if (current) { current.classList.remove('active'); current.classList.add('leaving'); setTimeout(() => { current.classList.remove('leaving'); showPage(page); }, 300); }
  else showPage(page);
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active','leaving'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('mobile-menu').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (page === 'cart') renderCart();
  if (page === 'products') filterProducts();
  setTimeout(observeReveals, 50);
  updateBackgroundBlur();
}

document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.page)));
document.getElementById('mobile-menu-btn').addEventListener('click', () => document.getElementById('mobile-menu').classList.toggle('hidden'));

let currentCategory = 'all';

function filterProducts() {
  const items = document.querySelectorAll('#products-grid .prod-item');
  items.forEach(item => {
    const cat = item.dataset.cat;
    item.classList.toggle('visible', currentCategory === 'all' || cat === currentCategory);
  });
}

document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.dataset.cat;
    const grid = document.getElementById('products-grid');
    grid.classList.add('fading');
    setTimeout(() => { filterProducts(); grid.classList.remove('fading'); }, 300);
  });
});

// Read product data from DOM elements
function getProductData(id) {
  const card = document.querySelector(`.prod-item[data-id="${id}"]`);
  if (!card) return null;
  const name = card.querySelector(`[data-template-id="prod-${id}-name"]`)?.textContent || '';
  const desc = card.querySelector(`[data-template-id="prod-${id}-desc"]`)?.textContent || '';
  const priceText = card.querySelector(`[data-template-id="prod-${id}-price"]`)?.textContent || '';
  const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
  const benefits = card.querySelector(`[data-template-id="prod-${id}-benefits"]`)?.textContent || '';
  const faq = card.querySelector(`[data-template-id="prod-${id}-faq"]`)?.textContent || '';
  const status = card.dataset.status;
  const img = card.querySelector(`[data-template-id="prod-${id}-img"]`);
  const imgSrc = img ? img.src : '';
  return { id, name, desc, price, benefits, faq, status, imgSrc };
}

function showProductDetail(id) {
  const p = getProductData(id);
  if (!p) return;
  document.getElementById('detail-img').src = p.imgSrc;
  document.getElementById('detail-img').alt = p.name;
  document.getElementById('detail-name').textContent = p.name;
  document.getElementById('detail-price').textContent = p.price ? `RM ${p.price}` : '';
  document.getElementById('detail-desc').textContent = p.desc;

  // Benefits
  const benefitsList = p.benefits.split('|').filter(b => b.trim());
  const statusLabel = p.status === 'ready' ? 'Ready Stock' : p.status === 'preorder' ? 'Pre-Order' : 'Out of Stock';
  const statusBg = p.status === 'ready' ? '#10b981' : p.status === 'preorder' ? '#f59e0b' : '#ef4444';
  document.getElementById('detail-benefits').innerHTML = `<div class="inline-block px-3 py-1.5 rounded-full text-xs font-semibold text-white mb-4" style="background-color:${statusBg}">${statusLabel}</div><h3 class="font-semibold text-gray-900 mb-3">Benefits</h3><ul class="space-y-2">${benefitsList.map(b => `<li class="flex items-start gap-2 text-sm text-gray-600"><i data-lucide="check-circle" class="w-4 h-4 text-green-500 mt-0.5 shrink-0"></i>${b.trim()}</li>`).join('')}</ul>`;

  // FAQ
  const faqPairs = p.faq.split('|').filter(f => f.trim());
  document.getElementById('detail-faq').innerHTML = faqPairs.length ? `<h3 class="font-semibold text-gray-900 mb-3">FAQ</h3>${faqPairs.map(pair => { const [q, a] = pair.split('::'); return `<div class="mb-3"><p class="text-sm font-medium text-gray-800">${(q||'').trim()}</p><p class="text-sm text-gray-500 mt-1">${(a||'').trim()}</p></div>`; }).join('')}` : '';

  const addBtn = document.getElementById('detail-add-cart');
  const preorderNote = document.getElementById('detail-preorder-note');
  if (p.status === 'outofstock') { addBtn.textContent = 'Currently Unavailable'; addBtn.disabled = true; addBtn.className = 'btn-premium flex-1 bg-gray-400 text-white py-3 rounded-full font-medium text-sm cursor-not-allowed'; preorderNote.classList.add('hidden'); }
  else if (p.status === 'preorder') { addBtn.textContent = 'Add to Cart (Pre-Order)'; addBtn.disabled = false; addBtn.className = 'btn-premium flex-1 bg-red-600 text-white py-3 rounded-full font-medium text-sm hover:bg-red-700'; preorderNote.classList.remove('hidden'); }
  else { addBtn.textContent = 'Add to Cart'; addBtn.disabled = false; addBtn.className = 'btn-premium flex-1 bg-red-600 text-white py-3 rounded-full font-medium text-sm hover:bg-red-700'; preorderNote.classList.add('hidden'); }
  addBtn.onclick = (e) => addToCart(id, e);
  document.getElementById('detail-whatsapp').onclick = () => { window.open(`https://wa.me/601139771606?text=${encodeURIComponent(`Hi DeltaCare! I'm interested in ${p.name} (RM ${p.price}). Is it available?`)}`, '_blank'); };
  navigateTo('detail');
  setTimeout(() => lucide.createIcons(), 100);
}

function addToCart(id, event) {
  const p = getProductData(id);
  if (!p || p.status === 'outofstock') { showToast('This product is currently unavailable'); return; }
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty++; else cart.push({ id, name: p.name, price: p.price, qty: 1 });
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartBadge();
  showToast(`${p.name}${p.status === 'preorder' ? ' (Pre-Order)' : ''} added to cart`);
  if (event && event.target) {
    const btn = event.target; const rect = btn.getBoundingClientRect();
    const cartBtn = document.getElementById('nav-cart-btn'); const cartRect = cartBtn.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'fly-item';
    fly.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:40px;height:40px;background:#C41E3A;border-radius:50%;opacity:0.8;`;
    document.body.appendChild(fly);
    requestAnimationFrame(() => { fly.style.left = cartRect.left + cartRect.width/2 - 20 + 'px'; fly.style.top = cartRect.top + 'px'; fly.style.width = '12px'; fly.style.height = '12px'; fly.style.opacity = '0'; });
    setTimeout(() => fly.remove(), 700);
    setTimeout(() => { cartBtn.classList.add('cart-shake'); setTimeout(() => cartBtn.classList.remove('cart-shake'), 400); }, 500);
  }
}

function updateCartBadge() {
  localStorage.setItem('deltacare_cart', JSON.stringify(cart));

  const count = cart.reduce((s, i) => s + i.qty, 0);
  
  // 1. Badge Desktop
  const badgeDesktop = document.getElementById('nav-cart-badge');
  if (badgeDesktop) {
    badgeDesktop.textContent = count;
    badgeDesktop.classList.toggle('hidden', count === 0);
    badgeDesktop.classList.add('badge-bounce');
    setTimeout(() => badgeDesktop.classList.remove('badge-bounce'), 400);
  }

  // 2. Badge Mobile (Ikon Troli Atas)
  const badgeMobile = document.getElementById('mobile-cart-badge');
  if (badgeMobile) {
    badgeMobile.textContent = count;
    badgeMobile.classList.toggle('hidden', count === 0);
    badgeMobile.classList.add('badge-bounce');
    setTimeout(() => badgeMobile.classList.remove('badge-bounce'), 400);
  }

  // 3. Badge Mobile (Dalam Menu Hamburger)
  const badgeMobileMenu = document.getElementById('mobile-menu-cart-badge');
  if (badgeMobileMenu) {
    badgeMobileMenu.textContent = count;
    badgeMobileMenu.classList.toggle('hidden', count === 0);
  }
}

function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const empty = document.getElementById('cart-empty');
  const summary = document.getElementById('cart-summary');
  if (cart.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); summary.classList.add('hidden'); return; }
  empty.classList.add('hidden'); summary.classList.remove('hidden');
  list.innerHTML = cart.map((item, i) => `
    <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl" style="animation: pageIn 0.3s ease ${i*60}ms both">
      <div><p class="font-medium text-gray-900">${item.name}</p><p class="text-sm text-gray-500">RM ${item.price} × ${item.qty}</p></div>
      <div class="flex items-center gap-3">
        <button onclick="changeQty(${i},-1)" class="w-8 h-8 rounded-full bg-white border border-gray-200 text-sm font-bold hover:bg-gray-100">−</button>
        <span class="text-sm font-medium w-4 text-center">${item.qty}</span>
        <button onclick="changeQty(${i},1)" class="w-8 h-8 rounded-full bg-white border border-gray-200 text-sm font-bold hover:bg-gray-100">+</button>
        <button onclick="removeFromCart(${i})" class="ml-2 text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    </div>`).join('');
  document.getElementById('cart-total').textContent = `RM ${cart.reduce((s, i) => s + i.price * i.qty, 0)}`;
  lucide.createIcons();
}

window.changeQty = (i, d) => { cart[i].qty += d; if (cart[i].qty <= 0) cart.splice(i, 1); updateCartBadge(); renderCart(); };
window.removeFromCart = (i) => { cart.splice(i, 1); updateCartBadge(); renderCart(); };

document.getElementById('cart-checkout-btn').addEventListener('click', () => {
  if (!cart.length) return;
  const lines = cart.map(i => `• ${i.name} x${i.qty} — RM${i.price * i.qty}`);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  window.open(`https://wa.me/601139771606?text=${encodeURIComponent(`Hello DeltaCare,\n\nI would like to order:\n\n${lines.join('\n')}\n\nTotal: RM ${total}\n\nPlease confirm availability.`)}`, '_blank');
});

// Ripple effect
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-premium');
  if (!btn) return;
  const ripple = document.createElement('span'); ripple.className = 'ripple';
  const rect = btn.getBoundingClientRect(); const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
  btn.appendChild(ripple); setTimeout(() => ripple.remove(), 600);
});

// Dosage Calculator Logic
let selectedDose = null;
let selectedStrength = null;
let selectedWater = null;

function setupOptionGroup(btnClass, inputId, onSelect) {
  const buttons = document.querySelectorAll('.' + btnClass);
  const customInput = document.getElementById(inputId);

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.dataset.val;

      if (val === 'other') {
        customInput.classList.remove('hidden');
        customInput.focus();
        onSelect(parseFloat(customInput.value) || null);
      } else {
        customInput.classList.add('hidden');
        onSelect(parseFloat(val));
      }
      calculateVolume();
    });
  });

  customInput.addEventListener('input', () => {
    onSelect(parseFloat(customInput.value) || null);
    calculateVolume();
  });
}

setupOptionGroup('dose-btn', 'custom-dose', val => selectedDose = val);
setupOptionGroup('strength-btn', 'custom-strength', val => selectedStrength = val);
setupOptionGroup('water-btn', 'custom-water', val => selectedWater = val);

function calculateVolume() {
  if (selectedDose && selectedStrength && selectedWater && selectedStrength > 0) {
    // Formula Pengiraan Volume Injection (ml) = (Dose / Strength) * Water Volume
    const volume = (selectedDose / selectedStrength) * selectedWater;
    updateSyringeDisplay(volume);
  } else {
    updateSyringeDisplay(0);
  }
}

// dosage calculator
function updateSyringeDisplay(ml) {
  const maxSyringeCapacity = 2.0; // Maksimum julat pada skala jarum (2.0 ml)
  const maxH = 272; // Tinggi fizikal cecair dalam SVG
  
  // Tentukan ketinggian cecair (clampkan maksimum pada 2.0 ml untuk paparan)
  const clampedMl = Math.min(ml, maxSyringeCapacity);
  const fillH = (clampedMl / maxSyringeCapacity) * maxH;

  document.getElementById('syringe-liquid').setAttribute('height', fillH);
  document.getElementById('syringe-liquid').setAttribute('y', 338 - fillH);
  document.getElementById('syringe-plunger').setAttribute('y', 338 - fillH - 10);
  
  // Kemaskini Paparan Teks
  document.getElementById('viz-volume-display').textContent = ml === 0 ? '0.00 ml' : ml.toFixed(2) + ' ml';

  const container = document.getElementById('syringe-container');
  container.classList.add('zoom');
  setTimeout(() => container.classList.remove('zoom'), 400);
}

// Back to top
const btt = document.getElementById('back-to-top');
window.addEventListener('scroll', () => btt.classList.toggle('visible', window.scrollY > 400));
btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Parallax
document.addEventListener('mousemove', (e) => {
  const hero = document.querySelector('.hero-parallax');
  if (!hero || window.innerWidth < 768) return;
  const x = (e.clientX / window.innerWidth - 0.5) * 8;
  const y = (e.clientY / window.innerHeight - 0.5) * 8;
  hero.style.transform = `translate(${x}px, ${y}px)`;
});

lucide.createIcons();
window.addEventListener('load', () => {
  updateCartBadge();
});

document.addEventListener('DOMContentLoaded', () => {
  // Render semula semua ikon Lucide (seperti ikon shopping-cart)
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  // Kemaskini badge nombor troli
  updateCartBadge();
});
