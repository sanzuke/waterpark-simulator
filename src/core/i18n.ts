/**
 * English is the source language: every call site passes its English text and
 * the Indonesian dictionary below translates it. A missing entry falls back to
 * the English text, so adding a string never breaks the game.
 */

export type Lang = "en" | "id";

const STORE_KEY = "kids-waterpark-lang";
let lang: Lang = "en";
try {
  lang = (localStorage.getItem(STORE_KEY) as Lang) === "id" ? "id" : "en";
} catch { /* storage blocked: keep English */ }

export const getLang = (): Lang => lang;

export function setLang(next: Lang) {
  lang = next;
  try { localStorage.setItem(STORE_KEY, next); } catch { /* ignore */ }
  applyStaticTexts();
}

export function toggleLang(): Lang {
  setLang(lang === "en" ? "id" : "en");
  return lang;
}

/** Translate an English string, with `{name}` style slots. */
export function t(en: string, vars?: Record<string, string | number>): string {
  let out = lang === "id" ? ID[en] ?? en : en;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Fill `data-i18n` elements of the static HTML. */
export function applyStaticTexts() {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n]"))) {
    el.textContent = t(el.dataset.i18n!);
  }
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(".btn-lang"))) {
    el.textContent = lang === "en" ? "🌐 English" : "🌐 Indonesia";
  }
}

const ID: Record<string, string> = {
  // Title screen
  "Splash, swim and explore the park!": "Ciprat, berenang, dan jelajahi taman!",
  Move: "Gerak",
  Run: "Lari",
  Jump: "Lompat",
  Interact: "Interaksi",
  Look: "Lihat",
  Continue: "Lanjutkan",
  "New game": "Main baru",
  "Your game saves by itself.": "Game tersimpan otomatis.",

  // Pause, summary
  Paused: "Jeda",
  "Take a break. The pool will wait for you.": "Istirahat dulu. Kolamnya menunggu.",
  "Keep playing": "Lanjut main",
  Stickers: "Stiker",
  "Go home": "Pulang",
  "What a day!": "Hari yang seru!",
  "Here is what you did at the waterpark.": "Ini yang kamu lakukan di taman air.",
  "Swim time": "Waktu berenang",
  Slides: "Perosotan",
  Snacks: "Camilan",
  "Coins found": "Koin ditemukan",
  "Coins spent": "Koin dibelanjakan",
  " min": " mnt",

  // Guide
  "Waterpark Guide": "Panduan Taman Air",
  "Family Pool": "Kolam Keluarga",
  "Shallow beach entry, deep end past the buoys. Chase the beach ball!":
    "Masuk dari pantai dangkal, bagian dalam lewat pelampung. Kejar bola pantainya!",
  "Children's Pool": "Kolam Anak",
  "Warm, shallow and splashy.": "Hangat, dangkal, dan penuh cipratan.",
  "Splash Playground": "Taman Ciprat",
  "Start the fountains and run through them.": "Nyalakan air mancur dan berlarian di bawahnya.",
  "Lazy River": "Sungai Malas",
  "A big loop around the palm island.": "Lingkaran besar mengelilingi pulau palem.",
  "Water Slides": "Perosotan Air",
  "Four slides up north.": "Empat perosotan di sisi utara.",
  "Food Court": "Pujasera",
  "Sit at a table with friends.": "Duduk di meja bersama teman.",
  "Wave Pool": "Kolam Ombak",
  "Ride the waves as they roll in. Stand in the shallow part and jump!": "Ikuti ombak yang datang. Berdiri di bagian dangkal dan lompat!",
  "Lifeguards are always watching the water. Have fun!": "Penjaga pantai selalu mengawasi air. Selamat bermain!",
  "Got it": "Mengerti",

  // Menu chrome
  "Close": "Tutup",
  "What would you like?": "Mau pesan apa?",
  "Finish your snack first!": "Habiskan camilanmu dulu!",

  // Ticket booth
  "Ticket Booth": "Loket Tiket",
  "One ticket lets you play all day!": "Satu tiket bisa main seharian!",
  "Day Ticket": "Tiket Harian",
  "Pools, slides and the whole park": "Semua kolam, perosotan, dan taman",
  "You already have a ticket. Off you go!": "Kamu sudah punya tiket. Ayo masuk!",
  "You need {n} more Water Coins. Shiny coins are hiding around the park!":
    "Kamu butuh {n} Koin Air lagi. Koin berkilau tersembunyi di sekitar taman!",
  "Ticket ready! Walk through the gate.": "Tiket siap! Lewatilah gerbang.",
  "Say Hi": "Sapa",
  "Buy Ticket": "Beli Tiket",
  "Your ticket is ready. Have a splashy day!": "Tiketmu sudah siap. Selamat bermain air!",

  // Shop
  "You need {n} more Water Coins.": "Kamu butuh {n} Koin Air lagi.",
  "Oh! You need {n} more Water Coins for the {name}. Look for shiny coins!":
    "Oh! Kamu butuh {n} Koin Air lagi untuk {name}. Cari koin berkilau!",
  "Preparing your {name}...": "Menyiapkan {name} kamu...",
  "Here you go! Enjoy!": "Ini dia! Nikmati ya!",
  "Ahh, so refreshing!": "Ahh, segar sekali!",
  "Yum! That was tasty!": "Nyam! Enak sekali!",
  "Buy Food": "Beli Makanan",
  "Sit Down": "Duduk",
  "Stand Up": "Berdiri",
  Rest: "Istirahat",

  // Energy tiers and tips
  "Full of energy": "Penuh energi",
  "Getting tired": "Mulai lelah",
  "A little tired? A snack or a rest would feel great!":
    "Agak lelah? Camilan atau istirahat pasti enak!",
  "Needs rest": "Butuh istirahat",
  "Time for a break! Try the food court or a lounger.":
    "Waktunya istirahat! Coba pujasera atau kursi santai.",
  "Very tired": "Sangat lelah",
  "So sleepy... sit on a lounger or grab a juice!":
    "Ngantuk sekali... duduk di kursi santai atau beli jus!",

  // Food and shops
  Burger: "Burger",
  "Big and juicy": "Besar dan berair",
  Pizza: "Pizza",
  "Cheesy slice": "Potongan penuh keju",
  "French Fries": "Kentang Goreng",
  "Crispy and golden": "Renyah dan keemasan",
  "Ice Cream": "Es Krim",
  "Cool and sweet": "Dingin dan manis",
  "Orange Juice": "Jus Jeruk",
  "Fresh and fruity": "Segar dan berbuah",
  "Mineral Water": "Air Mineral",
  "Cold and clear": "Dingin dan jernih",
  "Burger Shop": "Kedai Burger",
  "Pizza Shop": "Kedai Pizza",
  "Snack Shop": "Kedai Camilan",
  "Ice Cream Shop": "Kedai Es Krim",
  "Juice Bar": "Kedai Jus",

  // Interactions
  "Read Info Board": "Baca Papan Info",
  "Go Home": "Pulang",
  "Change Clothes": "Ganti Baju",
  "Ta-da! You brought a new swimsuit!": "Tada! Kamu membawa baju renang baru!",
  "Fountains Are On!": "Air Mancur Menyala!",
  "Start Fountains": "Nyalakan Air Mancur",
  "Run through the splashes!": "Berlari di bawah cipratannya!",
  "Whoosh! Fountains on for a while": "Wus! Air mancur menyala sebentar",
  "Tip the Bucket!": "Tumpahkan Ember!",
  "Bucket is filling...": "Ember sedang terisi...",
  "Here it comes... stand under it!": "Ayo datang... berdiri di bawahnya!",
  "Almost... let it fill a bit more": "Hampir... biarkan terisi sedikit lagi",
  "Wait for your turn...": "Tunggu giliranmu...",
  "Ride {name}": "Naik {name}",
  "Start the waves": "Nyalakan Ombak",
  "Waves are coming!": "Ombaknya datang!",
  "Waves are resting. Try again soon!": "Ombak sedang istirahat. Coba lagi nanti!",

  // Slide names
  "Small Slide": "Perosotan Kecil",
  "Spiral Slide": "Perosotan Spiral",
  "Racing Slide": "Perosotan Balap",
  "Tube Slide": "Perosotan Pelampung",

  // Feedback and world events
  "The park closes at 17:00. Still time for one more splash!":
    "Taman tutup pukul 17:00. Masih ada waktu untuk main air sekali lagi!",
  "What a fun day! Visit the exit gate whenever you like.":
    "Hari yang seru! Kunjungi gerbang keluar kapan pun kamu mau.",
  "SPLASH! You got soaked!": "BYUR! Kamu basah kuyup!",
  "Welcome back!": "Selamat datang kembali!",
  "Buy a ticket at the booth to enter the park!": "Beli tiket di loket untuk masuk taman!",
  "See you next time! Buy a new ticket to come back.":
    "Sampai jumpa lagi! Beli tiket baru untuk kembali.",
  "The gate needs a ticket first. Visit the ticket booth!":
    "Gerbang butuh tiket. Kunjungi loket tiket dulu!",
  "Welcome to the waterpark! Go wherever you like.":
    "Selamat datang di taman air! Pergi ke mana saja sesukamu.",
  "+{n} Water Coins!": "+{n} Koin Air!",

  // Achievements
  "First Swim": "Renang Pertama",
  "Splash into any pool.": "Cebur ke kolam mana saja.",
  "Slide Explorer": "Penjelajah Perosotan",
  "Ride a water slide.": "Naik satu perosotan air.",
  "Lazy River Adventure": "Petualangan Sungai Malas",
  "Float along the lazy river.": "Hanyut mengikuti sungai malas.",
  "Happy Eater": "Pemakan Bahagia",
  "Enjoy a snack at the food court.": "Nikmati camilan di pujasera.",
  "Waterpark Explorer": "Penjelajah Taman Air",
  "Visit six different areas.": "Kunjungi enam area berbeda.",
  "Back in Action": "Segar Kembali",
  "Get your energy back to full after resting.": "Kembalikan energimu penuh setelah istirahat.",
  "Super Waterpark Visitor": "Pengunjung Super",
  "Ride three slides, eat twice and see six areas.": "Naik tiga perosotan, makan dua kali, dan lihat enam area.",
  "⭐ {name}! You earned {reward} Water Coins.": "⭐ {name}! Kamu dapat {reward} Koin Air.",

  // Areas
  Entrance: "Pintu Masuk",
  "Changing Rooms": "Kamar Ganti",
  "Relaxing Pool": "Kolam Santai",
  "Water Playground": "Taman Air",
  Waterpark: "Taman Air",
  "Small Slide Splash Pool": "Kolam Ciprat Perosotan Kecil",
  "Spiral Slide Splash Pool": "Kolam Ciprat Perosotan Spiral",
  "Racing Slide Splash Pool": "Kolam Ciprat Perosotan Balap",
  "Tube Slide Splash Pool": "Kolam Ciprat Perosotan Pelampung",

  // HUD hint
  "WASD move · Shift run · Space jump · E interact · drag to look":
    "WASD gerak · Shift lari · Spasi lompat · E interaksi · seret untuk lihat",
};
