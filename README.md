# DELTACARE Website

## Susunan folder

```
Desktop\Delta Care\
├── website\               ← website sebenar (yang di-upload ke GitHub)
│   ├── index.html         ← susun atur page & teks English
│   ├── admin.html         ← ★ DASHBOARD ADMIN (/admin)
│   ├── admin.webmanifest  ← tetapan "Add to Home screen" dashboard (nama + ikon)
│   ├── vercel.json        ← tetapan Vercel (alamat /admin)
│   ├── js\config.js       ← sambungan Supabase (URL + anon key)
│   ├── js\admin.js        ← fungsi dashboard
│   ├── css\admin.css      ← rupa dashboard
│   ├── css\tailwind.css   ← DIJANA AUTOMATIK (jangan edit) - lihat "Tailwind" di bawah
│   ├── css\style.css      ← rupa, warna, animasi
│   ├── js\products.js     ← ★ DATA: produk, harga, stok, featured, kategori, pengumuman
│   ├── js\i18n.js         ← terjemahan Bahasa Melayu
│   ├── js\script.js       ← fungsi (troli, kalkulator, COA, carian, bahasa...)
│   └── image\             ← gambar website (saiz kecil)
├── supabase\setup.sql     ← jadual database (tampal dalam Supabase SQL Editor)
├── supabase\update-promo.sql ← kemas kini ciri promosi (untuk database sedia ada)
├── PANDUAN-ADMIN.md       ← ★ cara setup & guna dashboard
├── tools\                 ← alat untuk bina tailwind.css (tidak di-upload)
├── gambar-asal\           ← gambar asal saiz besar (simpanan)
└── gambar-baru\           ← letak gambar baru di sini
```

## Dashboard admin
Selepas Supabase disambung (`js/config.js` diisi), produk, pengumuman, agent dan order
diurus melalui **/admin**. Lihat `Delta Care\PANDUAN-ADMIN.md`.
`js/products.js` kemudian hanya jadi **data simpanan** (digunakan jika database tidak dapat dicapai).

## Tukar harga / stok / produk (tanpa dashboard)
Semua dalam **`js/products.js`**:
- `price: 350` → harga
- `status: 'ready'` / `'preorder'` / `'outofstock'`
- `cats: ['fat-loss', 'performance']` → kategori (boleh lebih dari satu)
- `strength: 10` → (vial sahaja) butang "Calculate Dosage" akan pilih 10mg
- `coa: 'image/xxx.jpeg'` → lencana "COA Verified" + butang "View COA"
- `desc`, `benefits`, `faq` → ada versi `en` dan `ms`
- `sale: 150` → (pilihan) harga promo; harga asal dipotong + lencana -%
- `saleEnds: '2026-12-31'` → (pilihan) hari terakhir promosi

**Jangan tukar `id` produk lama** (troli pelanggan guna id).

## Bar pengumuman
Dalam `js/products.js` → `ANNOUNCEMENT`:
- `enabled: true` (tunjuk) / `false` (sorok)
- `text` → ayat BM & English
- `link` → page yang dibuka bila ditekan, contoh `'product-8'` atau `'products'`

## Agent (komisen)
Dalam `js/products.js` → `AGENTS`. Tambah satu baris untuk setiap agent:
```js
{ code: 'AIMAN', name: 'Aiman', phone: '60123456789' },
```
- Link untuk agent kongsi: `https://delta-care-website.vercel.app/?ref=AIMAN`
  (boleh tambah page, cth. `...?ref=AIMAN#product-0`)
- Website ingat kod agent selama **30 hari** dalam browser pelanggan.
  Kalau pelanggan buka link agent lain, kod yang baru akan ganti yang lama.
- Pelanggan juga boleh taip kod sendiri dalam troli ("Kod agent").
- **Order & bayaran** → sentiasa ke WhatsApp DeltaCare. Mesej ada `Order No` dan `Agent`:
  - `Agent: AIMAN (Aiman)` → pelanggan agent, bagi komisen
  - `Agent: HQ (DeltaCare)` → pelanggan bos sendiri
  - `Agent: none (website)` → pelanggan datang sendiri
  - `Agent: XYZ (not registered)` → kod salah / agent belum didaftar
- **Soalan** (butang WhatsApp terapung, page FAQ, Contact, butang WhatsApp di page produk)
  → ke WhatsApp agent. Kalau `phone` kosong, soalan pergi ke DeltaCare.

## Tailwind
Website tidak lagi guna Tailwind CDN (lebih laju). Kalau tambah class Tailwind baru
dalam `index.html` atau fail js, double-click **`tools\build-css.bat`** untuk bina semula
`css/tailwind.css`. Kalau tak, class baru itu tidak akan berfungsi.

## Preview link WhatsApp
Dalam `index.html`, cari `LINK-WEBSITE-DELTACARE` dan tukar kepada link sebenar website.

## Ikon app dashboard
`image/app-icon-*.png` dan `image/apple-touch-icon.png` dibina dari `gambar-asal\dc2-logo.png`.
Kalau logo bertukar, klik kanan **`tools\build-app-icons.ps1`** → **Run with PowerShell**.

## Saiz gambar
Gambar website sebaiknya bawah 200 KB.
