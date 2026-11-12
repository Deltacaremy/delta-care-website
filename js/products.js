/* =========================================================
   DATA WEBSITE DELTACARE
   Semua maklumat produk, featured & pengumuman ada di sini.
   (Nanti admin dashboard akan ubah data dalam fail ini / database.)

   Setiap produk:
     id        : nombor unik (JANGAN tukar id produk lama - troli pelanggan guna id ini)
     name      : nama produk
     price     : harga (RM), nombor sahaja
     status    : 'ready' | 'preorder' | 'outofstock'
     cats      : kategori -> 'fat-loss', 'performance', 'skin', 'wellness'
     img       : gambar dalam folder image/
     strength  : (vial sahaja) kekuatan vial dalam mg -> butang "Kira Dos"
     coa       : (pilihan) gambar COA -> lencana "COA Verified"
     desc / benefits / faq : ada versi en (English) & ms (Bahasa Melayu)
   ========================================================= */

const PRODUCTS = [
  {
    id: 0, name: 'Retatrutide 10mg', price: 350, status: 'ready', cats: ['fat-loss'],
    img: 'image/Reta-10mg.jpeg', strength: 10,
    desc: { en: 'Premium lyophilized peptide', ms: 'Peptide liofilisasi premium' },
    benefits: {
      en: ['Supports advanced weight management', 'Enhances metabolic efficiency', 'Helps control appetite and cravings'],
      ms: ['Menyokong pengurusan berat badan', 'Meningkatkan kecekapan metabolisme', 'Membantu mengawal selera makan']
    },
    faq: {
      en: [['How is it prepared?', 'Reconstitute with bacteriostatic water before administration.'],
           ['Who is this dosage for?', 'Ideal for beginners or those starting their research cycle.']],
      ms: [['Bagaimana cara penyediaannya?', 'Campurkan dengan air bakteriostatik (BAC water) sebelum digunakan.'],
           ['Dos ini sesuai untuk siapa?', 'Sesuai untuk permulaan atau yang baru memulakan kitaran.']]
    }
  },
  {
    id: 1, name: 'Retatrutide 30mg', price: 650, status: 'ready', cats: ['fat-loss'],
    img: 'image/Reta-30mg.jpeg', strength: 30,
    desc: { en: 'Higher concentration formula', ms: 'Formula kepekatan lebih tinggi' },
    benefits: {
      en: ['Supports advanced weight management', 'Enhances metabolic efficiency', 'Helps control appetite and cravings'],
      ms: ['Menyokong pengurusan berat badan', 'Meningkatkan kecekapan metabolisme', 'Membantu mengawal selera makan']
    },
    faq: {
      en: [['How is it prepared?', 'Reconstitute with bacteriostatic water before administration.'],
           ['Who is this dosage for?', 'Designed for advanced research cycles requiring higher concentration.']],
      ms: [['Bagaimana cara penyediaannya?', 'Campurkan dengan air bakteriostatik (BAC water) sebelum digunakan.'],
           ['Dos ini sesuai untuk siapa?', 'Untuk kitaran lanjutan yang memerlukan kepekatan lebih tinggi.']]
    }
  },
  {
    id: 6, name: 'Reta 15mg Pen', price: 650, status: 'ready', cats: ['fat-loss'],
    img: 'image/Reta-pen.webp', coa: 'image/reta-pen-coa.jpeg',
    desc: { en: 'Pre-filled pen format (Full set)', ms: 'Format pen siap diisi (Set penuh)' },
    benefits: {
      en: ['Convenient pre-filled pen format', 'Precise and easy dosage control', 'Maximum bioavailability and effectiveness'],
      ms: ['Pen siap diisi, mudah digunakan', 'Kawalan dos yang tepat dan mudah', 'Bioavailabiliti dan keberkesanan maksimum']
    },
    faq: {
      en: [['Is mixing required?', 'No, it comes pre-filled and ready for immediate use.'],
           ['How do I adjust the dosage?', 'Simply click and dial to your required volume unit.']],
      ms: [['Perlu dicampur ke?', 'Tidak, pen ini sudah diisi dan sedia untuk digunakan.'],
           ['Bagaimana nak laraskan dos?', 'Hanya pusing (dial) ke unit isipadu yang diperlukan.']]
    }
  },
  {
    id: 7, name: 'Reta 30mg Pen', price: 850, status: 'ready', cats: ['fat-loss'],
    img: 'image/Reta-pen.webp', coa: 'image/reta-pen-coa.jpeg',
    desc: { en: 'High-capacity pre-filled pen format (Full set)', ms: 'Pen siap diisi berkapasiti tinggi (Set penuh)' },
    benefits: {
      en: ['Convenient pre-filled pen format', 'Precise and easy dosage control', 'Maximum bioavailability and effectiveness'],
      ms: ['Pen siap diisi, mudah digunakan', 'Kawalan dos yang tepat dan mudah', 'Bioavailabiliti dan keberkesanan maksimum']
    },
    faq: {
      en: [['Is mixing required?', 'No, it comes pre-filled in a high-capacity pen format.'],
           ['How long does one pen last?', 'Depends on dosage protocol, suitable for extended cycles.']],
      ms: [['Perlu dicampur ke?', 'Tidak, ia sudah diisi dalam pen berkapasiti tinggi.'],
           ['Satu pen tahan berapa lama?', 'Bergantung pada protokol dos, sesuai untuk kitaran lebih panjang.']]
    }
  },
  {
    id: 4, name: 'Slupp332 5mg', price: 250, status: 'ready', cats: ['fat-loss', 'performance'],
    img: 'image/Slupp-vial.jpeg', strength: 5,
    desc: { en: 'High purity peptide formulation', ms: 'Formulasi peptide ketulenan tinggi' },
    benefits: {
      en: ['Targeted fat metabolism support', 'Preserves lean muscle tissue', 'Enhances endurance during workouts'],
      ms: ['Menyokong metabolisme lemak', 'Mengekalkan otot tanpa lemak', 'Meningkatkan stamina semasa bersenam']
    },
    faq: {
      en: [['What is the main benefit?', 'Targeted fat metabolism and lean muscle preservation.'],
           ['How to store unmixed vials?', 'Store in a cool, dry place away from direct sunlight.']],
      ms: [['Apa manfaat utamanya?', 'Menyokong metabolisme lemak dan mengekalkan otot.'],
           ['Cara simpan vial yang belum dicampur?', 'Simpan di tempat sejuk dan kering, jauh dari cahaya matahari.']]
    }
  },
  {
    id: 5, name: 'Slupp332 1000mcg (1mg)', price: 200, status: 'outofstock', cats: ['fat-loss', 'performance'],
    img: 'image/Slupp-caps.webp',
    desc: { en: 'Capsule format (60 caps)', ms: 'Format kapsul (60 biji)' },
    benefits: {
      en: ['Convenient oral capsule format', 'Supports daily fat burn and metabolism', 'Sustained energy without jitters'],
      ms: ['Kapsul oral yang mudah diambil', 'Menyokong pembakaran lemak harian', 'Tenaga berpanjangan tanpa rasa gelisah']
    },
    faq: {
      en: [['How many capsules per serving?', 'Take 1-2 capsules daily with water before meals.'],
           ['Does it require injection?', 'No, this is an oral capsule format for easy daily use.']],
      ms: [['Berapa biji kapsul sehari?', 'Ambil 1-2 biji sehari bersama air sebelum makan.'],
           ['Perlu suntik ke?', 'Tidak, ini kapsul oral untuk kegunaan harian.']]
    }
  },
  {
    id: 2, name: 'Mots-C 40mg', price: 550, status: 'ready', cats: ['performance', 'wellness'],
    img: 'image/motsc.jpeg', strength: 40,
    desc: { en: 'Mitochondrial-derived peptide', ms: 'Peptide dari mitokondria' },
    benefits: {
      en: ['Boosts cellular energy & ATP production', 'Supports endurance and physical performance', 'Promotes metabolic & insulin sensitivity'],
      ms: ['Meningkatkan tenaga sel & penghasilan ATP', 'Menyokong stamina dan prestasi fizikal', 'Menyokong metabolisme & sensitiviti insulin']
    },
    faq: {
      en: [['How should it be stored?', 'Keep refrigerated after reconstitution.'],
           ['When is the best time to administer?', 'Best administered prior to endurance sessions or morning routines.']],
      ms: [['Bagaimana cara simpan?', 'Simpan dalam peti sejuk selepas dicampur.'],
           ['Bila masa terbaik untuk digunakan?', 'Sebelum sesi latihan stamina atau rutin pagi.']]
    }
  },
  {
    id: 3, name: 'Ghk-Cu 100mg', price: 220, status: 'preorder', cats: ['skin'],
    img: 'image/ghkcu.jpeg', strength: 100,
    desc: { en: 'Copper peptide', ms: 'Peptide kuprum (copper)' },
    benefits: {
      en: ['Promotes skin elasticity and collagen production', 'Accelerates tissue repair and wound healing', 'Supports anti-aging and skin renewal'],
      ms: ['Meningkatkan keanjalan kulit dan kolagen', 'Mempercepat pemulihan tisu dan luka', 'Menyokong anti-penuaan dan pembaharuan kulit']
    },
    faq: {
      en: [['Does it help with hair & skin?', 'Yes, it promotes collagen synthesis and skin tissue repair.'],
           ['Is reconstitution required?', 'Yes, reconstitute with sterile or bacteriostatic water.']],
      ms: [['Bagus untuk rambut & kulit?', 'Ya, ia menggalakkan penghasilan kolagen dan pemulihan kulit.'],
           ['Perlu dicampur ke?', 'Ya, campurkan dengan air steril atau air bakteriostatik.']]
    }
  },
  {
    id: 8, name: 'HRS HepatoRenal Support (60 caps)', price: 200, status: 'ready', cats: ['wellness'],
    img: 'image/hrs-60caps.jpg',
    desc: { en: 'Liver & kidney support. 1500 mg, 60 capsules (30 servings)', ms: 'Sokongan hati & buah pinggang. 1500 mg, 60 kapsul (30 hidangan)' },
    benefits: {
      en: ['Supports healthy liver function', 'Supports bile flow and natural detoxification pathways', 'Supports kidney health and normal renal filtration'],
      ms: ['Menyokong fungsi hati yang sihat', 'Menyokong aliran hempedu dan detoks semula jadi', 'Menyokong kesihatan buah pinggang dan penapisan normal']
    },
    faq: {
      en: [['How many capsules is one serving?', 'One serving is 2 capsules. One bottle of 60 capsules gives 30 servings.'],
           ['Is it suitable for daily use?', 'Yes, it is designed for daily supplementation. Follow the directions on the label.'],
           ['Can children take this?', 'Not recommended for children. Consult a healthcare professional first.']],
      ms: [['Satu hidangan berapa biji?', 'Satu hidangan ialah 2 kapsul. Satu botol 60 kapsul = 30 hidangan.'],
           ['Sesuai diambil setiap hari?', 'Ya, direka untuk kegunaan harian. Ikut arahan pada label.'],
           ['Kanak-kanak boleh ambil?', 'Tidak disyorkan untuk kanak-kanak. Dapatkan nasihat profesional kesihatan.']]
    }
  },
  {
    id: 9, name: 'HRS HepatoRenal Support (240 caps)', price: 400, status: 'ready', cats: ['wellness'],
    img: 'image/hrs-240caps.jpg',
    desc: { en: 'Best value. Liver & kidney support. 1500 mg, 240 capsules (120 servings)', ms: 'Paling berbaloi. Sokongan hati & buah pinggang. 1500 mg, 240 kapsul (120 hidangan)' },
    benefits: {
      en: ['Supports healthy liver function', 'Supports bile flow and natural detoxification pathways', 'Supports kidney health and normal renal filtration'],
      ms: ['Menyokong fungsi hati yang sihat', 'Menyokong aliran hempedu dan detoks semula jadi', 'Menyokong kesihatan buah pinggang dan penapisan normal']
    },
    faq: {
      en: [['How many capsules is one serving?', 'One serving is 2 capsules. One bottle of 240 capsules gives 120 servings.'],
           ['Is it suitable for daily use?', 'Yes, it is designed for daily supplementation. Follow the directions on the label.'],
           ['Can children take this?', 'Not recommended for children. Consult a healthcare professional first.']],
      ms: [['Satu hidangan berapa biji?', 'Satu hidangan ialah 2 kapsul. Satu botol 240 kapsul = 120 hidangan.'],
           ['Sesuai diambil setiap hari?', 'Ya, direka untuk kegunaan harian. Ikut arahan pada label.'],
           ['Kanak-kanak boleh ambil?', 'Tidak disyorkan untuk kanak-kanak. Dapatkan nasihat profesional kesihatan.']]
    }
  }
];

// Produk di bahagian "Featured Products" (Home). title/desc/img boleh lain dari produk asal.
const FEATURED = [
  { id: 0, title: 'Retatrutide', desc: { en: 'Premium lyophilized peptide', ms: 'Peptide liofilisasi premium' }, img: 'image/Reta-pen.webp' },
  { id: 2, title: 'Mots-C', desc: { en: 'Mitochondrial-derived peptide', ms: 'Peptide dari mitokondria' }, img: 'image/motsc.jpeg' },
  { id: 3, title: 'Ghk-Cu', desc: { en: 'Copper peptide', ms: 'Peptide kuprum (copper)' }, img: 'image/ghkcu.jpeg' },
  { id: 4, title: 'Slupp332', desc: { en: 'High purity peptide formulation', ms: 'Formulasi peptide ketulenan tinggi' }, img: 'image/Slupp-caps.webp' }
];

// Nama kategori (butang penapis di page Products)
const CATEGORIES = [
  { id: 'all', en: 'All Products', ms: 'Semua Produk' },
  { id: 'fat-loss', en: 'Fat Loss', ms: 'Turun Berat' },
  { id: 'performance', en: 'Energy & Performance', ms: 'Tenaga & Prestasi' },
  { id: 'skin', en: 'Skin & Hair', ms: 'Kulit & Rambut' },
  { id: 'wellness', en: 'Wellness', ms: 'Kesejahteraan' }
];

// Bar pengumuman di paling atas. enabled: true = tunjuk, false = sorok.
// link: halaman yang dibuka bila ditekan (contoh 'product-8', 'products'), atau '' untuk tiada pautan.
const ANNOUNCEMENT = {
  enabled: true,
  text: { en: 'NEW: HRS HepatoRenal Support is now available', ms: 'BARU: HRS HepatoRenal Support kini tersedia' },
  link: 'product-8'
};

/* ---------- AGENT ----------
   Setiap agent ada kod sendiri. Link untuk dikongsi kepada pelanggan:
     https://delta-care-website.vercel.app/?ref=KOD
   - code  : huruf besar / nombor sahaja, tanpa jarak (cth. AIMAN, SITI2)
   - name  : nama yang pelanggan nampak ("Dibantu oleh ...")
   - phone : WhatsApp agent (format 60xxxxxxxxx). Kosongkan '' jika belum ada
             -> soalan pelanggan akan pergi ke nombor DeltaCare dulu.
   Order & bayaran SENTIASA pergi ke WhatsApp DeltaCare (bos).
   Kod HQ = pelanggan yang bos sendiri close. */
const AGENTS = [
  { code: 'HQ', name: 'DeltaCare', phone: '' },
  // { code: 'AIMAN', name: 'Aiman', phone: '60123456789' },
];
