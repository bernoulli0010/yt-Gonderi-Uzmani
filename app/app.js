/* YouTube Gönderi Uzmanı - New UI (no build needed) */

const STORAGE_KEY = "yt-gonderi-uzmani:v2";
const THEME_KEY = "yt-gonderi-uzmani:theme";
const USER_KEY = "yt-gonderi-uzmani:user";
// API key moved to Supabase Edge Function (server-side)


const $ = (id) => document.getElementById(id);

// Global Error Handler
window.onerror = function (msg, url, line, col, error) {
  alert("Uygulama Hatası (Satır " + line + "): " + msg);
  console.error("Global Error:", error);
  return false;
};

// Supabase Configuration
console.log("Supabase Client başlatılıyor...");
const SUPABASE_URL = "https://bjcsbuvjumaigvsjphor.supabase.co";
// Yeni Publishable Key formatı kullanılıyor
const SUPABASE_KEY = "sb_publishable_Ws-ubr-U3Uryo-oJxE0rvg_QTlz2Kqa";

let supabaseClient;
try {
  supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  console.log("Supabase Client oluşturuldu:", !!supabaseClient);
} catch (e) {
  console.error("Supabase oluşturulurken hata:", e);
  alert("Supabase Hatası: " + e.message);
}

if (!supabaseClient) {
  console.error("Supabase kütüphanesi yüklenemedi.");
  setTimeout(() => {
    if (!window.supabase) alert("Hata: Supabase kütüphanesi yüklenemedi. İnternet bağlantınızı veya reklam engelleyiciyi kontrol edin.");
  }, 1000);
}

/* ── Auth & Token Services ── */
const AuthService = {
  currentUser: null,

  async init() {
    if (!supabaseClient) return;

    // Check active session
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      await this.fetchProfile(session.user.id);
    }

    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await this.fetchProfile(session.user.id);
      } else {
        this.currentUser = null;
        this.updateUI();
      }
    });
  },

  async fetchProfile(userId) {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // PGRST116 = "JSON object requested, multiple (or no) rows returned"
        // This means profile doesn't exist yet (trigger may have failed)
        if (error.code === 'PGRST116') {
          console.warn("Profile not found, attempting to create...");
          const created = await this.createProfileFallback(userId);
          if (created) return; // createProfileFallback will call fetchProfile again
        }
        console.error("Profile Error:", error);
        toast("Profil hatası: " + error.message);
        return;
      }

      if (data) {
        this.currentUser = {
          id: data.id,
          email: data.email,
          name: data.full_name || data.email.split('@')[0],
          tokens: data.token_balance
        };
        this.updateUI();
      }
    } catch (err) {
      console.error("Profile system error", err);
      toast("Sistem hatası: Profil yüklenemedi.");
    }
  },

  async createProfileFallback(userId) {
    try {
      // Get current auth user info for email and name
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return false;

      const email = user.email;
      const fullName = user.user_metadata?.full_name || email?.split('@')[0] || '';

      const { data, error } = await supabaseClient
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          full_name: fullName,
          token_balance: 5
        })
        .select()
        .single();

      if (error) {
        // If insert fails (e.g., no INSERT policy), try upsert
        console.error("Profile insert failed:", error);

        // Try waiting for trigger to complete (race condition)
        await new Promise(r => setTimeout(r, 2000));
        const { data: retryData, error: retryError } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (!retryError && retryData) {
          this.currentUser = {
            id: retryData.id,
            email: retryData.email,
            name: retryData.full_name || retryData.email?.split('@')[0],
            tokens: retryData.token_balance
          };
          this.updateUI();
          return true;
        }

        console.error("Profile creation fallback also failed:", retryError);
        toast("Profil oluşturulamadı. Lütfen sayfayı yenileyip tekrar giriş yapın.");
        return false;
      }

      if (data) {
        this.currentUser = {
          id: data.id,
          email: data.email,
          name: data.full_name || data.email?.split('@')[0],
          tokens: data.token_balance
        };
        this.updateUI();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Profile creation fallback error:", err);
      return false;
    }
  },

  async login(email, password) {
    if (!supabaseClient) {
      toast("Supabase bağlantısı kurulamadı. Sayfayı yenileyin veya reklam engelleyiciyi kapatın.");
      return false;
    }

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Translate common Supabase login error messages to Turkish
        let msg = error.message;
        if (msg.includes("Invalid login credentials")) {
          msg = "Geçersiz e-posta veya şifre.";
        } else if (msg.includes("Email not confirmed")) {
          msg = "E-posta adresiniz henüz doğrulanmamış. Lütfen e-postanızı kontrol edin.";
        } else if (msg.includes("Too many requests") || msg.includes("rate limit")) {
          msg = "Çok fazla deneme yaptınız. Lütfen biraz bekleyip tekrar deneyin.";
        } else if (msg.includes("User not found")) {
          msg = "Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.";
        } else if (msg.includes("network") || msg.includes("fetch")) {
          msg = "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
        }
        toast("Giriş hatası: " + msg);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Login error:", err);
      toast("Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.");
      return false;
    }
  },

  async register(name, email, password) {
    if (!supabaseClient) {
      toast("Supabase bağlantısı kurulamadı. Sayfayı yenileyin veya reklam engelleyiciyi kapatın.");
      return false;
    }

    // Validate password length (Supabase requires minimum 6 characters)
    if (!password || password.length < 6) {
      toast("Şifre en az 6 karakter olmalıdır.");
      return false;
    }

    // Validate name
    if (!name || name.trim().length === 0) {
      toast("Lütfen adınızı girin.");
      return false;
    }

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name.trim()
          }
        }
      });

      if (error) {
        // Translate common Supabase error messages
        let msg = error.message;
        if (msg.includes("already registered") || msg.includes("already been registered")) {
          msg = "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.";
        } else if (msg.includes("invalid") && msg.includes("email")) {
          msg = "Geçersiz e-posta adresi.";
        } else if (msg.includes("Password")) {
          msg = "Şifre en az 6 karakter olmalıdır.";
        }
        toast("Kayıt hatası: " + msg);
        return false;
      }

      // Supabase returns user without session AND empty identities array
      // when the email is already registered (security measure to prevent enumeration)
      if (data.user && !data.session) {
        if (!data.user.identities || data.user.identities.length === 0) {
          toast("Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapmayı deneyin.");
          return false;
        }
        toast("Kayıt başarılı! Lütfen e-postanızı doğrulayın.");
        return true;
      }

      toast("Kayıt başarılı! Giriş yapılıyor...");
      return true;
    } catch (err) {
      console.error("Register error:", err);
      toast("Kayıt sırasında bir hata oluştu: " + err.message);
      return false;
    }
  },

  async logout() {
    await supabaseClient.auth.signOut();
    this.currentUser = null;
    this.updateUI();
    window.location.reload();
  },

  async deductToken() {
    if (!this.currentUser || this.currentUser.tokens < 1) return false;

    // Optimistic UI update
    this.currentUser.tokens -= 1;
    this.updateUI();

    // DB Update
    const { error } = await supabaseClient
      .from('profiles')
      .update({ token_balance: this.currentUser.tokens })
      .eq('id', this.currentUser.id);

    if (error) {
      console.error("Token Update Error:", error);
      toast("Token güncellenemedi: " + error.message);
      // Revert if failed
      this.currentUser.tokens += 1;
      this.updateUI();
      return false;
    }
    return true;
  },

  async addTokens(amount) {
    if (!this.currentUser) return;

    this.currentUser.tokens += amount;
    this.updateUI();

    const { error } = await supabaseClient
      .from('profiles')
      .update({ token_balance: this.currentUser.tokens })
      .eq('id', this.currentUser.id);

    if (error) {
      toast("Token satın alma işlendi fakat veritabanına yazılamadı.");
    }
  },

  updateUI() {
    const user = this.currentUser;
    if (user) {
      if ($("authGuest")) $("authGuest").style.display = "none";
      if ($("authUser")) $("authUser").style.display = "flex";
      if ($("userTokens")) $("userTokens").textContent = user.tokens;
      if ($("tokenCurrent")) $("tokenCurrent").textContent = user.tokens;
      if ($("dropdownName")) $("dropdownName").textContent = user.name;
      if ($("dropdownEmail")) $("dropdownEmail").textContent = user.email;
      if ($("userInitials")) $("userInitials").textContent = (user.name || "U")[0].toUpperCase();

      // Update token warning
      if ($("tokenWarning")) {
        $("tokenWarning").style.display = user.tokens < 1 ? "flex" : "none";
      }
    } else {
      if ($("authGuest")) $("authGuest").style.display = "flex";
      if ($("authUser")) $("authUser").style.display = "none";
      if ($("tokenCurrent")) $("tokenCurrent").textContent = "0";
      if ($("tokenWarning")) $("tokenWarning").style.display = "none";
    }
  }
};

const Modals = {
  open(id) {
    const m = $(id);
    const o = $("modalOverlay");
    if (m && o) {
      o.style.display = "block";
      // First make visible (display:block), then animate in next frame
      m.classList.add("is-visible");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          m.classList.add("is-open");
        });
      });
    }
  },
  closeAll() {
    const overlay = $("modalOverlay");
    if (overlay) overlay.style.display = "none";
    document.querySelectorAll(".modal").forEach(m => {
      m.classList.remove("is-open");
      m.classList.remove("is-visible");
    });
  }
};

/* ── Theme Toggle ── */
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { }
}

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
}

/* ── Mood → Tone mapping ── */
const MOOD_TO_TONE = {
  friendly: "friendly",
  professional: "professional",
  funny: "funny",
  curious: "energetic",
  motivational: "emotional",
  informative: "professional",
  questioning: "friendly",
};

/* ── UI Strings ── */
const UI = {
  tr: {
    appTitle: "YouTube Gönderi Uzmanı",
    appSubtitle: "Topluluk gönderilerini kolayca oluşturun",
    contentSourceTitle: "İçerik Kaynağı",
    postTypeTitle: "Gönderi Tipi",
    moodTitle: "Ruh Hali",
    purposeTitle: "Amaç ve Dil",
    resultsTitle: "Oluşturulan Gönderiler",
    emptyText: "Henüz gönderi oluşturulmadı",
    generateBtn: "Gönderi Oluştur",
    export: "Başa dön",

    tabs: {
      freetext: "Serbest Yazı",
      video: "Video",
      channel: "Kanal",
    },

    postTypes: {
      standard: "Metin Gönderisi",
      poll: "Anket",
      quiz: "Test",
    },

    moods: {
      friendly: { title: "Samimi", desc: "Dostça ve yakın" },
      professional: { title: "Resmi", desc: "Resmi ve profesyonel" },
      funny: { title: "Eğlenceli", desc: "Eğlenceli ve neşeli" },
      curious: { title: "Merak Uyandırıcı", desc: "İlgi çekici ve merak uyandırıcı" },
      motivational: { title: "Motive Edici", desc: "Motivasyon verici" },
      informative: { title: "Bilgilendirici", desc: "Bilgi verici" },
      questioning: { title: "Soru Soran", desc: "Soru soran ve etkileşimli" },
    },

    purposes: {
      engagement: "Etkileşim",
      announcement: "Duyuru",
      discussion: "Tartışma",
      feedback: "Geri Bildirim",
      promotion: "Tanıtım",
    },

    fields: {
      videoTitle: "Video başlığı",
      videoTopic: "Video konusu (kısa)",
      keyPoints: "Ana noktalar (madde madde)",
      audience: "Hedef kitle",
      cta: "CTA (çağrı)",
      link: "Video linki (opsiyonel)",
      hashtags: "Hashtagler (opsiyonel)",
      videoUrl: "Video URL",
    },

    placeholders: {
      videoTitle: "Örn: 7 günde odaklanma artışı",
      videoTopic: "Örn: odak, dikkat, alışkanlık",
      keyPoints: "- 2 dakika kuralı\n- Bildirimleri kapat\n- 1 görev, 1 zaman",
      audience: "Örn: öğrenciler / yeni başlayanlar",
      cta: "Örn: Videoyu izle / yorum yaz",
      link: "https://youtube.com/...",
      hashtags: "#youtube #odak #alışkanlık",
      videoUrl: "https://www.youtube.com/watch?v=... veya https://www.youtube.com/shorts/...",
      channelSearch: "Kanal ara...",
    },

    fetchVideo: "Videoyu Getir",
    clearBtn: "Kaldır",
    purposeLabel: "Amaç",
    languageLabel: "Dil",
    tokenCostLabel: "Token Gerekli:",
    tokenCost: "1 Token",
    tokenCurrentLabel: "Mevcut Token Sayınız:",
    tokenWarningTitle: "Yetersiz Token",
    tokenWarningText: "Gönderi oluşturmak için en az 1 token gereklidir. Lütfen token satın alın.",

    toasts: {
      copied: "Kopyalandı",
      copiedAll: "Hepsi kopyalandı",
      exported: "Dışa aktarıldı",
      reset: "Sıfırlandı",
      autoFilled: "Otomatik dolduruldu",
    },

    meta: {
      charCount: "Karakter",
      tip: "İpucu",
      tipText: "YouTube topluluk gönderi limiti ≈ 500 karakter.",
    },

    auth: {
      login: "Giriş Yap",
      register: "Kayıt Ol",
      logout: "Çıkış Yap",
      email: "E-posta",
      password: "Şifre",
      name: "Ad Soyad",
      noAccount: "Hesabın yok mu?",
      haveAccount: "Zaten üye misin?",
      createAccount: "Hesap Oluştur",
      user: "Kullanıcı",
      emailPlaceholder: "ornek@email.com",
      passwordPlaceholder: "******",
      namePlaceholder: "Adınız",
    },

    modals: {
      buyTokensTitle: "Token Satın Al",
      buyTokensSubtitle: "Shopier ile güvenli ödeme yaparak token satın alın.",
      howItWorks: "Nasıl çalışır?",
      step1: "1. Paket seçin, Shopier'e yönlendirileceksiniz",
      step2: "2. Sipariş notuna uygulama e-posta adresinizi yazın",
      step3: "3. Ödeme sonrası tokenler otomatik yüklenir",
      buyWithShopier: "Shopier ile Satın Al",
      testPackage: "Test Paketi",
      securePayment: "Güvenli ödeme altyapısı: Shopier.com",
      copyEmail: "E-postayı Kopyala",
      copied: "Kopyalandı!",
      emailNotice: "Sipariş notuna e-posta adresinizi yazın:",
      loading: "Shopier yükleniyor...",
    },

    actions: {
      search: "Ara",
      reset: "Sıfırla",
      theme: "Tema Değiştir",
    },
    selects: {
      langAuto: "Otomatik Tespit",
      langTr: "Türkçe",
      langEn: "English",
    }
  },

  en: {
    appTitle: "YouTube Post Expert",
    appSubtitle: "Easily create community posts",
    contentSourceTitle: "Content Source",
    postTypeTitle: "Post Type",
    moodTitle: "Mood",
    purposeTitle: "Purpose & Language",
    resultsTitle: "Generated Posts",
    emptyText: "No posts generated yet",
    generateBtn: "Generate Post",
    export: "Back to top",

    tabs: {
      freetext: "Free Text",
      video: "Video",
      channel: "Channel",
    },

    postTypes: {
      standard: "Text Post",
      poll: "Poll",
      quiz: "Quiz",
    },

    moods: {
      friendly: { title: "Friendly", desc: "Warm and approachable" },
      professional: { title: "Formal", desc: "Professional and formal" },
      funny: { title: "Fun", desc: "Fun and cheerful" },
      curious: { title: "Intriguing", desc: "Engaging and curious" },
      motivational: { title: "Motivational", desc: "Inspiring and motivating" },
      informative: { title: "Informative", desc: "Educational and insightful" },
      questioning: { title: "Questioning", desc: "Interactive and questioning" },
    },

    purposes: {
      engagement: "Engagement",
      announcement: "Announcement",
      discussion: "Discussion",
      feedback: "Feedback",
      promotion: "Promotion",
    },

    fields: {
      videoTitle: "Video title",
      videoTopic: "Video topic (short)",
      keyPoints: "Key points (bullet list)",
      audience: "Target audience",
      cta: "CTA (call to action)",
      link: "Video link (optional)",
      hashtags: "Hashtags (optional)",
      videoUrl: "Video URL",
    },

    placeholders: {
      videoTitle: "e.g. Boost focus in 7 days",
      videoTopic: "e.g. focus, attention, habits",
      keyPoints: "- 2-minute rule\n- Turn off notifications\n- 1 task, 1 time block",
      audience: "e.g. students / beginners",
      cta: "e.g. Watch the video / leave a comment",
      link: "https://youtube.com/...",
      hashtags: "#youtube #focus #habits",
      videoUrl: "https://www.youtube.com/watch?v=... or https://www.youtube.com/shorts/...",
      channelSearch: "Search channel...",
    },

    fetchVideo: "Fetch Video",
    clearBtn: "Remove",
    purposeLabel: "Purpose",
    languageLabel: "Language",
    tokenCostLabel: "Token Required:",
    tokenCost: "1 Token",
    tokenCurrentLabel: "Your Token Balance:",
    tokenWarningTitle: "Insufficient Tokens",
    tokenWarningText: "At least 1 token is required to generate a post. Please purchase tokens.",

    toasts: {
      copied: "Copied",
      copiedAll: "All copied",
      exported: "Exported",
      reset: "Reset",
      autoFilled: "Auto-filled",
    },

    meta: {
      charCount: "Characters",
      tip: "Tip",
      tipText: "YouTube community post limit ≈ 500 characters.",
    },

    auth: {
      login: "Login",
      register: "Sign Up",
      logout: "Logout",
      email: "Email",
      password: "Password",
      name: "Full Name",
      noAccount: "Don't have an account?",
      haveAccount: "Already a member?",
      createAccount: "Create Account",
      user: "User",
      emailPlaceholder: "example@email.com",
      passwordPlaceholder: "******",
      namePlaceholder: "Your name",
    },

    modals: {
      buyTokensTitle: "Buy Tokens",
      buyTokensSubtitle: "Purchase tokens securely with Shopier.",
      howItWorks: "How it works?",
      step1: "1. Select a package, you'll be redirected to Shopier",
      step2: "2. Write your app email in the order notes",
      step3: "3. Tokens are added automatically after payment",
      buyWithShopier: "Buy with Shopier",
      testPackage: "Test Package",
      securePayment: "Secure payment infrastructure: Shopier.com",
      copyEmail: "Copy Email",
      copied: "Copied!",
      emailNotice: "Write your email address in the order notes:",
      loading: "Shopier is loading...",
    },

    actions: {
      search: "Search",
      reset: "Reset",
      theme: "Toggle Theme",
    },
    selects: {
      langAuto: "Auto Detect",
      langTr: "Turkish",
      langEn: "English",
    }
  }
};

/* ── Tone data (kept from original) ── */
const Tone = {
  tr: {
    friendly: {
      hooks: ["Kısa bir soru:", "Merak ettim:", "Şunu bir konuşalım:"],
      vibe: "samimi",
      closers: ["Yorumlara yaz", "Ne düşünüyorsun?", "Biraz sohbet edelim"],
    },
    emotional: {
      hooks: ["Bunu yaşadım:", "Bu beni çok etkiledi:", "Durup düşündüm:"],
      vibe: "duygusal",
      closers: ["Senin hikayen ne?", "Hissettiklerimi paylaş", "Birlikte düşünelim"],
    },
    energetic: {
      hooks: ["Hazır mısın?", "Hadi başlayalım!", "Enerji zamanı:"],
      vibe: "enerjik",
      closers: ["Hemen dene!", "Bugün başla!", "Haydi harekete geç!"],
    },
    professional: {
      hooks: ["Dikkat çekici bir veri:", "Araştırmalar gösteriyor:", "İşte gerçekler:"],
      vibe: "profesyonel",
      closers: ["Görüşlerinizi paylaşın", "Değerlendirmenizi bekliyorum", "Sürecinizi anlatın"],
    },
    funny: {
      hooks: ["Şaka değil:", "Bunu yapınca ben:", "İtiraf zamanı:"],
      vibe: "eğlenceli",
      closers: ["Yorumlarda patlat", "Gülerek yaz", "Takılalım"],
    },
  },
  en: {
    friendly: {
      hooks: ["Quick question:", "Curious:", "Let's talk about this:"],
      vibe: "friendly",
      closers: ["Drop a comment", "What do you think?", "Let's chat"],
    },
    emotional: {
      hooks: ["Been through this:", "This hit different:", "Had to pause and think:"],
      vibe: "emotional",
      closers: ["What's your story?", "Share how you feel", "Let's reflect together"],
    },
    energetic: {
      hooks: ["Ready?", "Let's go!", "Energy time:"],
      vibe: "energetic",
      closers: ["Try it now!", "Start today!", "Let's move!"],
    },
    professional: {
      hooks: ["Eye-opening data:", "Research shows:", "Here are the facts:"],
      vibe: "professional",
      closers: ["Share your thoughts", "I'd love your take", "Tell me your process"],
    },
    funny: {
      hooks: ["No joke:", "Me when I do this:", "Confession time:"],
      vibe: "funny",
      closers: ["Roast me in comments", "Make it spicy", "Let's vibe"],
    },
  },
};

/* ── Helpers ── */
function pick(arr, salt = 0) {
  if (!arr || arr.length === 0) return "";
  const idx = Math.abs(salt + Date.now()) % arr.length;
  return arr[idx];
}

function normalizeLines(text) {
  return (text || "")
    .split(/\n/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function splitComma(text) {
  return (text || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("is-visible");
  setTimeout(() => el.classList.remove("is-visible"), 1600);
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  } catch {
    return false;
  }
}

function safeTitle(s) {
  return (s || "").trim().replace(/["'""'']/g, "");
}

/* ── Stopwords ── */
const STOPWORDS = {
  tr: new Set([
    "ve", "ile", "için", "icin", "ama", "fakat", "ancak", "ya", "ya da", "yada",
    "bir", "bu", "şu", "su", "o", "ben", "sen", "biz", "siz",
    "da", "de", "ki", "ne", "mi", "mı", "mu", "mü",
    "çok", "cok", "en", "daha", "gibi", "hangi", "kadar",
    "var", "yok", "olan", "olur", "değil", "degil",
  ]),
  en: new Set([
    "the", "a", "an", "and", "or", "but", "to", "it", "i", "you", "he", "she", "we", "they",
    "is", "are", "was", "were", "be", "been", "being",
    "for", "with", "in", "on", "of", "from", "how", "what", "why",
    "vs", "versus", "guide", "tutorial", "best", "top", "new", "2024", "2025", "2026",
  ]),
};

/* ── Category & Inference (from original) ── */
const CATEGORY = {
  focus: {
    trLabel: "Odak / Verimlilik",
    enLabel: "Focus / Productivity",
    trKeywords: ["odak", "dikkat", "verim", "verimlilik", "pomodoro", "alışkanlık", "erteleme", "disiplin"],
    enKeywords: ["focus", "attention", "productivity", "pomodoro", "habit", "procrastination", "discipline"],
    trPoints: ["İlk adım — zihinsel netlik", "Zaman bloğu oluştur", "En sık dikkat dağıtıcıyı tespit et", "1 ipucuyla bugün başla"],
    enPoints: ["First step — mental clarity", "Create a time block", "Identify your #1 distraction", "Start today with 1 tip"],
  },
  fitness: {
    trLabel: "Fitness / Sağlık",
    enLabel: "Fitness / Health",
    trKeywords: ["fitness", "spor", "egzersiz", "antrenman", "diyet", "beslenme", "kilo", "kas", "koşu"],
    enKeywords: ["fitness", "workout", "exercise", "training", "diet", "nutrition", "weight", "muscle", "running"],
    trPoints: ["Isınma + hareketlilik ile başla", "Progressif yük artışı uygula", "Temel beslenmeyi kur (protein/kalori)", "Uyku ve dinlenme planla"],
    enPoints: ["Start with warm-up + mobility", "Apply progressive overload", "Build nutrition basics (protein/calories)", "Plan sleep and recovery"],
  },
  finance: {
    trLabel: "Para / Finans",
    enLabel: "Money / Finance",
    trKeywords: ["para", "finans", "bütçe", "butce", "tasarruf", "yatırım", "yatirim", "borsa", "kripto", "gelir"],
    enKeywords: ["money", "finance", "budget", "saving", "investment", "stock", "crypto", "income"],
    trPoints: ["Gelir & gider tablosunu çıkart", "Bir hedef belirle (miktar + süre)", "Otomasyonla tasarruf kur", "Ayda 1 gözden geçirme yap"],
    enPoints: ["Map your income & expenses", "Set a goal (amount + timeline)", "Automate savings", "Monthly review ritual"],
  },
  tech: {
    trLabel: "Teknoloji / Yazılım",
    enLabel: "Tech / Software",
    trKeywords: ["yazılım", "yazilim", "kod", "programlama", "python", "javascript", "react", "api", "hata", "ayar"],
    enKeywords: ["software", "code", "programming", "python", "javascript", "react", "api", "bug", "setup", "config"],
    trPoints: ["Amaç ve senaryoyu netleştir", "Kurulum/ayar adımlarını sırala", "Sık hataları ve çözümü ekle", "Kısa bir demo ile bitir"],
    enPoints: ["Define the goal and use case", "List setup/config steps", "Include common pitfalls + fixes", "End with a quick demo"],
  },
  general: {
    trLabel: "Genel",
    enLabel: "General",
    trKeywords: [],
    enKeywords: [],
    trPoints: ["Önemli kavramı 1 cümlede özetle", "3 adımda uygulanabilir yol haritası ver", "Sık yapılan hatayı söyle", "Bugün denenebilecek mini görev öner"],
    enPoints: ["Summarize the core idea in 1 sentence", "Share a 3-step actionable plan", "Call out a common mistake", "Suggest a tiny task to try today"],
  },
};

function toWords(text) {
  return (text || "")
    .replace(/[#@][0-9A-Za-zçğıöşüÇĞİÖŞÜ_-]+/g, " ")
    .replace(/[^0-9A-Za-zçğıöşüÇĞİÖŞÜ]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function extractKeywords(title, lang) {
  const words = toWords(title);
  const stop = STOPWORDS[lang] || STOPWORDS.tr;
  const scores = new Map();
  for (const w of words) {
    if (w.length < 3) continue;
    if (stop.has(w)) continue;
    scores.set(w, (scores.get(w) || 0) + w.length);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 6);
}

function detectCategory(lang, titleLower, keywords) {
  const entries = Object.entries(CATEGORY);
  for (const [key, cfg] of entries) {
    if (key === "general") continue;
    const list = lang === "tr" ? cfg.trKeywords : cfg.enKeywords;
    for (const k of list) {
      if (titleLower.includes(k)) return key;
    }
  }
  for (const [key, cfg] of entries) {
    if (key === "general") continue;
    const list = lang === "tr" ? cfg.trKeywords : cfg.enKeywords;
    if (keywords.some((kw) => list.includes(kw))) return key;
  }
  return "general";
}

function inferTopicAndPoints(lang, title) {
  const raw = (title || "").trim();
  const tl = raw.toLowerCase();
  const keywords = extractKeywords(raw, lang);

  const flags = {
    vs: /(\bvs\b|versus|karşılaştır|karsilastir|compare)/i.test(raw),
    howTo: /(nasıl|nasil|how to|how-to|rehber|guide|tutorial)/i.test(raw),
    best: /(en iyi|best|top|favori|favorite)/i.test(raw),
    beginner: /(başlangıç|baslangic|beginner|temel|basics)/i.test(raw),
    mistakes: /(hata|mistake|yanlış|yanlis|wrong)/i.test(raw),
    days: null,
  };
  const m = raw.match(/(\d+)\s*(gün|gun|day|days)/i);
  if (m) flags.days = m[1];

  const catKey = detectCategory(lang, tl, keywords);
  const cat = CATEGORY[catKey] || CATEGORY.general;
  const catLabel = lang === "tr" ? cat.trLabel : cat.enLabel;

  let topic = "";
  if (flags.vs && keywords.length >= 2) {
    topic = lang === "tr" ? `${keywords[0]} vs ${keywords[1]} karşılaştırması` : `${keywords[0]} vs ${keywords[1]} comparison`;
  } else if (flags.days) {
    topic = lang === "tr" ? `${flags.days} günlük ${catLabel.toLowerCase()} planı` : `${flags.days}-day ${catLabel.toLowerCase()} plan`;
  } else if (flags.howTo) {
    topic = lang === "tr" ? `${catLabel} için pratik yöntemler` : `Practical tips for ${catLabel.toLowerCase()}`;
  } else if (keywords.length >= 2) {
    topic = keywords.slice(0, 3).join(", ");
  } else {
    topic = catLabel;
  }

  let points = [];
  if (flags.vs) {
    points = lang === "tr"
      ? ["Karşılaştırma kriterleri (performans, fiyat, kullanım)", "Artılar / eksiler", "Kimler için daha uygun?", "Ben olsam hangisini seçerdim?"]
      : ["Comparison criteria (performance, price, use-case)", "Pros / cons", "Who is it best for?", "My pick (and why)"];
  } else if (flags.days) {
    points = lang === "tr"
      ? [`Gün gün mini plan (${flags.days} gün)`, "Takip metriği (ne ölçeceğiz?)", "Zorlandığın anda uygulanacak B planı", "Sürdürülebilir hale getirme"]
      : [`Day-by-day mini plan (${flags.days} days)`, "Tracking metric (what to measure)", "Plan B for hard days", "Make it sustainable"];
  } else if (flags.best) {
    points = lang === "tr"
      ? ["Kısa kriter: neye göre seçiyoruz?", "Top öneriler + kime uygun", "Hızlı karşılaştırma", "Benim favorim"]
      : ["Quick criteria: what matters?", "Top picks + who they're for", "Fast comparison", "My favorite"];
  } else if (flags.howTo) {
    points = lang === "tr"
      ? ["Gerekli hazırlık", "Adım adım uygulama", "Sık hata ve çözüm", "Bugün denenecek mini görev"]
      : ["Prerequisites", "Step-by-step", "Common mistake + fix", "Tiny task to try today"];
  } else {
    points = (lang === "tr" ? cat.trPoints : cat.enPoints).slice();
  }

  if (flags.beginner) {
    points.unshift(lang === "tr" ? "Temel kavramlar (hızlı)" : "Core basics (quick)");
  }
  if (flags.mistakes) {
    points[points.length - 1] = lang === "tr" ? "Sık yapılan hata + nasıl kaçınırız?" : "Common mistake + how to avoid it";
  }

  points = points.slice(0, 4);
  return { topic, points };
}

/* ── Post Generation ── */
// buildContext() moved to Supabase Edge Function (server-side)

function lengthBudget(length) {
  if (length === "short") return { points: 1, extraLine: false, question: true };
  if (length === "long") return { points: 4, extraLine: true, question: true };
  return { points: 2, extraLine: true, question: true };
}

function withLinkAndTags(lang, ctx) {
  const parts = [];
  if (ctx.link) parts.push(ctx.link);
  if (ctx.hashtags) parts.push(ctx.hashtags);
  if (parts.length === 0) return "";
  return `\n\n${parts.join("\n")}`;
}

function formatBullets(lang, points, maxPoints) {
  const used = points.slice(0, maxPoints);
  if (used.length === 0) return "";
  return used.map((p) => `• ${p}`).join("\n");
}

function defaultPollOptions(lang, ctx) {
  if (lang === "tr") {
    const base = ["Evet, başlıyorum", "Denemek istiyorum", "Zaten yapıyorum", "Emin değilim"];
    if (ctx.topic.toLowerCase().includes("odak")) return ["Bildirimler", "Erteleme", "Yorgunluk", "Çok görev"];
    return base;
  }
  const base = ["Yes, I'm in", "I want to try", "Already doing it", "Not sure"];
  if (ctx.topic.toLowerCase().includes("focus")) return ["Notifications", "Procrastination", "Fatigue", "Multitasking"];
  return base;
}

function defaultQuiz(lang, ctx) {
  if (lang === "tr") {
    return { q: "Sence en büyük zaman hırsızı hangisi?", a: ["Bildirimler", "Kararsızlık", "Erteleme", "Plansızlık"] };
  }
  return { q: "What's your biggest time thief?", a: ["Notifications", "Indecision", "Procrastination", "No plan"] };
}

function imagePrompts(lang, ctx, state) {
  const idea = (state.imageIdeas || "").trim();
  const topic = ctx.topic ? `(${ctx.topic})` : "";
  if (lang === "tr") {
    return [
      idea || `Minimal karşılaştırma görseli ${topic}`,
      "2 sütun: Sol 'Önce' / Sağ 'Sonra' (çok kısa metin)",
      "Renk: koyu arka plan + neon vurgu, okunaklı büyük yazı",
    ];
  }
  return [
    idea || `Minimal comparison image ${topic}`,
    "2 columns: Left 'Before' / Right 'After' (very short text)",
    "Dark background + neon accent, big readable typography",
  ];
}

function makeStandardPost(lang, ctx, state, salt) {
  const t = Tone[lang][state.tone];
  const b = lengthBudget(state.length);
  const hook = pick(t.hooks, salt);
  const closer = pick(t.closers, salt + 17);

  const topicLine = ctx.topic
    ? lang === "tr" ? `Konu: ${ctx.topic}` : `Topic: ${ctx.topic}`
    : "";

  const audienceLine = ctx.audience && b.extraLine
    ? lang === "tr" ? `Bu özellikle ${ctx.audience} için.` : `This is especially for ${ctx.audience}.`
    : "";

  const ctaLine = ctx.cta
    ? `${ctx.cta}${ctx.cta.endsWith("!") ? "" : "!"}`
    : lang === "tr" ? "Videoda detayını anlattım." : "Full breakdown in the video.";

  const question = lang === "tr" ? "Sende en çok hangisi işe yarıyor?" : "What works best for you?";
  const bullets = formatBullets(lang, ctx.points, b.points);

  let text = `${hook} "${ctx.title}"`;
  if (topicLine) text += `\n${topicLine}`;
  if (audienceLine) text += `\n${audienceLine}`;
  if (bullets) text += `\n${bullets}`;
  text += `\n\n${b.question ? `${question} ${closer}.` : closer}\n${ctaLine}`;

  return text.trim() + withLinkAndTags(lang, ctx);
}

function makePoll(lang, ctx, state, salt) {
  const t = Tone[lang][state.tone];
  const hook = pick(t.hooks, salt);
  const closer = pick(t.closers, salt + 21);

  const userOptions = splitComma(state.pollOptions);
  const options = (userOptions.length >= 2 ? userOptions : defaultPollOptions(lang, ctx)).slice(0, 4);

  const question = lang === "tr"
    ? ctx.topic ? `${ctx.topic} için senin en büyük zorlayan ne?` : "Sana en çok hangisi zor geliyor?"
    : ctx.topic ? `What's your biggest struggle with ${ctx.topic}?` : "What's your biggest struggle?";

  const prompt = lang === "tr" ? `Oy ver, sonra da yorumlara nedenini yaz.` : `Vote, then tell me why in the comments.`;

  const ctaLine = ctx.cta
    ? `${ctx.cta}${ctx.cta.endsWith("!") ? "" : "!"}`
    : lang === "tr" ? "Videoda çözüm adımlarını paylaştım." : "I shared the solution steps in the video.";

  const body = [
    `${hook} ${question}`, "",
    options.map((o) => `- ${o}`).join("\n"), "",
    `${prompt} ${closer}.`, ctaLine,
  ].join("\n");

  return body.trim() + withLinkAndTags(lang, ctx);
}

function makeQuiz(lang, ctx, state, salt) {
  const t = Tone[lang][state.tone];
  const hook = pick(t.hooks, salt);
  const closer = pick(t.closers, salt + 31);

  const fallback = defaultQuiz(lang, ctx);
  const q = (state.quizQuestion || "").trim() || fallback.q;
  const answersInput = splitComma(state.quizAnswers);
  const answers = (answersInput.length >= 2 ? answersInput : fallback.a).slice(0, 4);
  const letters = ["A", "B", "C", "D"];

  const reveal = lang === "tr" ? "Cevabı videoda söylüyorum." : "Answer reveal is in the video.";

  const ctaLine = ctx.cta
    ? `${ctx.cta}${ctx.cta.endsWith("!") ? "" : "!"}`
    : reveal;

  const body = [
    `${hook} ${q}`, "",
    answers.map((a, i) => `- ${letters[i]}) ${a}`).join("\n"), "",
    lang === "tr" ? `Yorumlara sadece harfi bırak: ${closer}.` : `Comment with just the letter: ${closer}.`,
    ctaLine,
  ].join("\n");

  return body.trim() + withLinkAndTags(lang, ctx);
}

function makeImagePoll(lang, ctx, state, salt) {
  const t = Tone[lang][state.tone];
  const hook = pick(t.hooks, salt);
  const closer = pick(t.closers, salt + 41);

  const options = splitComma(state.pollOptions);
  const baseOptions = options.length >= 2
    ? options.slice(0, 2)
    : lang === "tr" ? ["Seçenek A", "Seçenek B"] : ["Option A", "Option B"];

  const q = lang === "tr"
    ? ctx.topic ? `${ctx.topic} için hangisini seçersin? (Görselde A/B)` : "Hangisini seçersin? (Görselde A/B)"
    : ctx.topic ? `Which one would you pick for ${ctx.topic}? (Image shows A/B)` : "Which one would you pick? (Image shows A/B)";

  const prompts = imagePrompts(lang, ctx, state);
  const promptBlock = lang === "tr"
    ? `Görsel fikri:\n- ${prompts.join("\n- ")}`
    : `Image idea:\n- ${prompts.join("\n- ")}`;

  const ctaLine = ctx.cta
    ? `${ctx.cta}${ctx.cta.endsWith("!") ? "" : "!"}`
    : lang === "tr" ? "Videoda detay var." : "Full details in the video.";

  const body = [
    `${hook} ${q}`, "",
    `- A) ${baseOptions[0]}`, `- B) ${baseOptions[1]}`, "",
    lang === "tr" ? `A mı B mi? ${closer}.` : `A or B? ${closer}.`, ctaLine, "",
    promptBlock,
  ].join("\n");

  return body.trim() + withLinkAndTags(lang, ctx);
}

function generatePosts(state) {
  const ctx = buildContext(state);
  const n = clamp(parseInt(state.variations, 10) || 3, 1, 3);
  const posts = [];
  for (let i = 0; i < n; i++) {
    const salt = i * 97 + (state.tone || "").length * 13;
    let text = "";
    if (state.postType === "poll") text = makePoll(state.lang, ctx, state, salt);
    else if (state.postType === "quiz") text = makeQuiz(state.lang, ctx, state, salt);
    else if (state.postType === "imagePoll") text = makeImagePoll(state.lang, ctx, state, salt);
    else text = makeStandardPost(state.lang, ctx, state, salt);
    posts.push(text.trim());
  }
  return posts;
}

/* ── UI State Management ── */
let currentState = {
  lang: "tr",
  source: "video",
  postType: "standard",
  mood: "friendly",
  purpose: "engagement",
  language: "auto",
  videoTitle: "",
  videoTopic: "",
  keyPoints: "",
  audience: "",
  cta: "",
  videoLink: "",
  hashtags: "",
  videoUrl: "",
  channelSearch: "",
  // Video & Channel fetched data
  videoData: null,      // { title, channel, summary, thumbnailUrl, hasCaptions }
  channelData: null,    // { channelName, videos, contentKeywords }
  pollOptions: "",
  quizQuestion: "",
  quizAnswers: "",
  imageIdeas: "",
  length: "medium",
  variations: "3",
};

function getActiveValue(groupEl) {
  const active = groupEl.querySelector(".is-active");
  return active ? active.dataset.value : null;
}

function setActiveCard(groupEl, value) {
  groupEl.querySelectorAll("[data-value]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.value === value);
  });
}

function getState() {
  const lang = document.documentElement.lang === "en" ? "en" : "tr";
  return {
    lang,
    source: currentState.source,
    postType: getActiveValue($("postTypeGroup")) || "standard",
    mood: getActiveValue($("moodGroup")) || "friendly",
    purpose: getActiveValue($("purposeGroup")) || "engagement",
    language: $("languageSelect").value,
    tone: MOOD_TO_TONE[getActiveValue($("moodGroup")) || "friendly"] || "friendly",
    // Input alanları sadece runtime'da okunur, localStorage'a kaydedilmez
    videoTitle: ($("videoTitle")?.value || ""),
    videoTopic: ($("videoTopic")?.value || ""),
    keyPoints: ($("keyPoints")?.value || ""),
    audience: ($("audience")?.value || ""),
    cta: ($("cta")?.value || ""),
    videoLink: ($("videoLink")?.value || ""),
    hashtags: ($("hashtags")?.value || ""),
    videoUrl: ($("videoUrl")?.value || ""),
    channelSearch: ($("channelSearch")?.value || ""),
    videoData: currentState.videoData,
    channelData: currentState.channelData,
    pollOptions: "",
    quizQuestion: "",
    quizAnswers: "",
    imageIdeas: "",
    length: "medium",
    variations: "3",
  };
}

// Sadece kullanıcı tercihleri kaydedilir (input alanları ve fetch verileri hariç)
function getSaveableState() {
  const lang = document.documentElement.lang === "en" ? "en" : "tr";
  return {
    lang,
    source: currentState.source,
    postType: getActiveValue($("postTypeGroup")) || "standard",
    mood: getActiveValue($("moodGroup")) || "friendly",
    purpose: getActiveValue($("purposeGroup")) || "engagement",
    language: $("languageSelect").value,
  };
}

function applyState(state) {
  // Source tabs
  switchSource(state.source || "video");

  // Post type
  setActiveCard($("postTypeGroup"), state.postType || "standard");

  // Mood
  setActiveCard($("moodGroup"), state.mood || "friendly");

  // Purpose
  setActiveCard($("purposeGroup"), state.purpose || "engagement");

  // Language
  $("languageSelect").value = state.language || "auto";

  // Input alanları F5'te sıfırlanır (localStorage'dan restore edilmez)
  if ($("videoTitle")) $("videoTitle").value = "";
  if ($("videoTopic")) $("videoTopic").value = "";
  if ($("keyPoints")) $("keyPoints").value = "";
  if ($("audience")) $("audience").value = "";
  if ($("cta")) $("cta").value = "";
  if ($("videoLink")) $("videoLink").value = "";
  if ($("hashtags")) $("hashtags").value = "";
  if ($("videoUrl")) $("videoUrl").value = "";
  if ($("channelSearch")) $("channelSearch").value = "";

  // Video/Channel verileri de F5'te temizlenir
  currentState.videoData = null;
  currentState.channelData = null;
  $("videoInfoCard").style.display = "none";
  $("channelResults").style.display = "none";
}

function saveState() {
  const state = getSaveableState();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ── Source Tab Switching ── */
function switchSource(source) {
  currentState.source = source;

  // Update tab buttons
  document.querySelectorAll("#sourceTabGroup .tab-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.source === source);
  });

  // Show/hide panels
  $("panelFreetext").style.display = source === "freetext" ? "" : "none";
  $("panelVideo").style.display = source === "video" ? "" : "none";
  $("panelChannel").style.display = source === "channel" ? "" : "none";
}

/* ── Language System ── */
function setLanguage(lang) {
  document.documentElement.lang = lang;
  if ($("langTr")) $("langTr").classList.toggle("is-active", lang === "tr");
  if ($("langEn")) $("langEn").classList.toggle("is-active", lang === "en");

  const t = UI[lang];
  document.title = t.appTitle;
  $("appTitle").textContent = t.appTitle;
  $("appSubtitle").textContent = t.appSubtitle;
  $("contentSourceTitle").textContent = t.contentSourceTitle;
  $("postTypeTitle").textContent = t.postTypeTitle;
  $("moodTitle").textContent = t.moodTitle;
  $("purposeTitle").textContent = t.purposeTitle;
  $("resultsTitle").textContent = t.resultsTitle;
  $("emptyText").textContent = t.emptyText;
  $("generateBtnText").textContent = t.generateBtn;

  $("backToTopBtn").textContent = t.export;

  // Tabs
  $("freetextTabLabel").textContent = t.tabs.freetext;
  $("videoTabLabel").textContent = t.tabs.video;
  $("channelTabLabel").textContent = t.tabs.channel;

  // Post type labels
  $("postTypeStandard").textContent = t.postTypes.standard;
  $("postTypePoll").textContent = t.postTypes.poll;
  $("postTypeQuiz").textContent = t.postTypes.quiz;

  // Mood labels
  document.querySelectorAll("#moodGroup .option-card").forEach((card) => {
    const val = card.dataset.value;
    const moodData = t.moods[val];
    if (moodData) {
      card.querySelector("strong").textContent = moodData.title;
      const descEl = card.querySelector(".option-card-text span");
      if (descEl) descEl.textContent = moodData.desc;
    }
  });

  // Purpose labels
  document.querySelectorAll("#purposeGroup .option-card").forEach((card) => {
    const val = card.dataset.value;
    if (t.purposes[val]) {
      card.querySelector("strong").textContent = t.purposes[val];
    }
  });

  // Field labels
  if ($("videoTitleLabel")) $("videoTitleLabel").textContent = t.fields.videoTitle;
  if ($("videoTopicLabel")) $("videoTopicLabel").textContent = t.fields.videoTopic;
  if ($("keyPointsLabel")) $("keyPointsLabel").textContent = t.fields.keyPoints;
  if ($("audienceLabel")) $("audienceLabel").textContent = t.fields.audience;
  if ($("ctaLabel")) $("ctaLabel").textContent = t.fields.cta;
  if ($("linkLabel")) $("linkLabel").textContent = t.fields.link;
  if ($("hashtagLabel")) $("hashtagLabel").textContent = t.fields.hashtags;
  if ($("videoUrlLabel")) $("videoUrlLabel").textContent = t.fields.videoUrl;

  // Placeholders
  if ($("videoTitle")) $("videoTitle").placeholder = t.placeholders.videoTitle;
  if ($("videoTopic")) $("videoTopic").placeholder = t.placeholders.videoTopic;
  if ($("keyPoints")) $("keyPoints").placeholder = t.placeholders.keyPoints;
  if ($("audience")) $("audience").placeholder = t.placeholders.audience;
  if ($("cta")) $("cta").placeholder = t.placeholders.cta;
  if ($("videoLink")) $("videoLink").placeholder = t.placeholders.link;
  if ($("hashtags")) $("hashtags").placeholder = t.placeholders.hashtags;
  if ($("videoUrl")) $("videoUrl").placeholder = t.placeholders.videoUrl;
  if ($("channelSearch")) $("channelSearch").placeholder = t.placeholders.channelSearch;

  // Fetch button
  $("fetchVideoText").textContent = t.fetchVideo;

  // Clear buttons
  $("clearVideoBtn").textContent = t.clearBtn;
  $("clearChannelBtn").textContent = t.clearBtn;
  $("clearFreetextBtn").textContent = t.clearBtn;

  // Labels
  if ($("purposeLabel")) $("purposeLabel").textContent = t.purposeLabel;
  if ($("languageLabel")) $("languageLabel").textContent = t.languageLabel;

  // Token info
  if ($("tokenCostLabel")) $("tokenCostLabel").textContent = t.tokenCostLabel;
  if ($("tokenCost")) $("tokenCost").textContent = t.tokenCost;
  if ($("tokenCurrentLabel")) {
    const currentVal = $("tokenCurrent") ? $("tokenCurrent").textContent : "0";
    $("tokenCurrentLabel").innerHTML = `${t.tokenCurrentLabel} <strong class="token-current-val" id="tokenCurrent">${currentVal}</strong>`;
  }
  if ($("tokenWarningTitle")) $("tokenWarningTitle").textContent = t.tokenWarningTitle;
  if ($("tokenWarningText")) $("tokenWarningText").textContent = t.tokenWarningText;

  // Header & Auth
  if ($("loginBtn")) $("loginBtn").textContent = t.auth.login;
  if ($("registerBtn")) $("registerBtn").textContent = t.auth.register;
  if ($("logoutBtnText")) $("logoutBtnText").textContent = t.auth.logout;
  if ($("buyTokensText")) $("buyTokensText").textContent = t.modals.buyTokensTitle;
  if ($("dropdownName") && ($("dropdownName").textContent === "Kullanıcı" || $("dropdownName").textContent === "User")) {
    $("dropdownName").textContent = t.auth.user;
  }

  // Modals - Login
  if ($("loginModalTitle")) $("loginModalTitle").textContent = t.auth.login;
  if ($("loginEmailLabel")) $("loginEmailLabel").textContent = t.auth.email;
  if ($("loginPasswordLabel")) $("loginPasswordLabel").textContent = t.auth.password;
  if ($("loginSubmitBtn")) $("loginSubmitBtn").textContent = t.auth.login;
  if ($("loginFooterText")) {
    $("loginFooterText").innerHTML = `${t.auth.noAccount} <a href="#" id="swToRegister">${t.auth.register}</a>`;
    // Re-wire switcher
    const swReg = $("swToRegister");
    if (swReg) {
      swReg.addEventListener("click", (e) => {
        e.preventDefault();
        Modals.closeAll();
        setTimeout(() => Modals.open("registerModal"), 50);
      });
    }
  }

  // Modals - Register
  if ($("registerModalTitle")) $("registerModalTitle").textContent = t.auth.register;
  if ($("regNameLabel")) $("regNameLabel").textContent = t.auth.name;
  if ($("regEmailLabel")) $("regEmailLabel").textContent = t.auth.email;
  if ($("regPasswordLabel")) $("regPasswordLabel").textContent = t.auth.password;
  if ($("regSubmitBtn")) $("regSubmitBtn").textContent = t.auth.createAccount;
  if ($("registerFooterText")) {
    $("registerFooterText").innerHTML = `${t.auth.haveAccount} <a href="#" id="swToLogin">${t.auth.login}</a>`;
    // Re-wire switcher
    const swLog = $("swToLogin");
    if (swLog) {
      swLog.addEventListener("click", (e) => {
        e.preventDefault();
        Modals.closeAll();
        setTimeout(() => Modals.open("loginModal"), 50);
      });
    }
  }

  // Modals - Buy Tokens
  if ($("buyTokensTitle")) $("buyTokensTitle").textContent = t.modals.buyTokensTitle;
  if ($("buyTokensSubtitle")) $("buyTokensSubtitle").textContent = t.modals.buyTokensSubtitle;
  if ($("howItWorksTitle")) $("howItWorksTitle").textContent = t.modals.howItWorks;
  if ($("step1Text")) $("step1Text").textContent = t.modals.step1;
  const emailStrong = `<strong style="color: var(--accent);">${lang === 'tr' ? 'uygulama e-posta adresinizi' : 'your app email address'}</strong>`;
  if ($("step2Text")) $("step2Text").innerHTML = t.modals.step2.replace(/uygulama e-posta adresinizi|your app email address/, emailStrong);
  if ($("step3Text")) $("step3Text").textContent = t.modals.step3;
  if ($("securePaymentText")) $("securePaymentText").innerHTML = t.modals.securePayment.replace("Shopier.com", "<strong>Shopier.com</strong>");

  document.querySelectorAll(".shopier-buy-label").forEach(el => el.textContent = t.modals.buyWithShopier);
  document.querySelectorAll(".shopier-buy-label-mini").forEach(el => el.textContent = t.modals.testPackage);

  // Shopier Checkout
  if ($("copyEmailText")) $("copyEmailText").textContent = t.modals.copyEmail;
  if ($("shopierEmailNotice")) $("shopierEmailNotice").innerHTML = `${t.modals.emailNotice} <strong id="shopierUserEmail"></strong>`;
  if ($("shopierLoadingText")) $("shopierLoadingText").textContent = t.modals.loading;

  // Actions & Buttons
  if ($("searchChannelBtn")) $("searchChannelBtn").textContent = t.actions.search;
  if ($("resetBtn")) $("resetBtn").title = t.actions.reset;
  if ($("themeToggle")) $("themeToggle").title = t.actions.theme;

  // Placeholders for dynamic fields
  if ($("loginEmail")) $("loginEmail").placeholder = t.auth.emailPlaceholder;
  if ($("loginPassword")) $("loginPassword").placeholder = t.auth.passwordPlaceholder;
  if ($("regName")) $("regName").placeholder = t.auth.namePlaceholder;
  if ($("regEmail")) $("regEmail").placeholder = t.auth.emailPlaceholder;
  if ($("regPassword")) $("regPassword").placeholder = t.auth.passwordPlaceholder;

  // Select Options
  if ($("langAutoOption")) $("langAutoOption").textContent = t.selects.langAuto;
  if ($("langTrOption")) $("langTrOption").textContent = t.selects.langTr;
  if ($("langEnOption")) $("langEnOption").textContent = t.selects.langEn;
}

/* ── Render Results ── */
function renderResults(posts, state) {
  const t = UI[state.lang];
  const resultsEl = $("results");
  resultsEl.innerHTML = "";

  if (!posts || posts.length === 0) {
    resultsEl.innerHTML = `<div class="empty-state"><p>${t.emptyText}</p></div>`;
    return;
  }

  // Add copy all header
  const head = document.createElement("div");
  head.className = "results-head";
  head.innerHTML = `
    <span class="badge"><span class="dot"></span> ${posts.length} ${state.lang === "tr" ? "gönderi" : "posts"}</span>
    <div class="results-actions">
      <button class="btn-secondary" id="copyAllBtn" type="button">${state.lang === "tr" ? "Hepsini kopyala" : "Copy all"}</button>
    </div>
  `;
  resultsEl.appendChild(head);

  // Copy all handler
  head.querySelector("#copyAllBtn").addEventListener("click", async () => {
    const allText = posts.map((p, i) => `#${i + 1}\n${p}`).join("\n\n");
    const ok = await copyToClipboard(allText);
    if (ok) toast(t.toasts.copiedAll);
  });

  posts.forEach((text, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "result";

    const rHead = document.createElement("div");
    rHead.className = "result-head";

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.innerHTML = `<span class="dot" aria-hidden="true"></span> #${idx + 1}`;

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "mini";
    copyBtn.type = "button";
    copyBtn.textContent = state.lang === "tr" ? "Kopyala" : "Copy";
    copyBtn.addEventListener("click", async () => {
      const ok = await copyToClipboard(text);
      if (ok) toast(t.toasts.copied);
    });

    const regenBtn = document.createElement("button");
    regenBtn.className = "mini";
    regenBtn.type = "button";
    regenBtn.textContent = state.lang === "tr" ? "Yenile" : "Refresh";
    regenBtn.addEventListener("click", () => {
      // Re-generate this specific post (simulated with salt change)
      const next = generatePosts(state);
      renderResults(next, state);
    });

    actions.appendChild(copyBtn);
    actions.appendChild(regenBtn);

    rHead.appendChild(badge);
    rHead.appendChild(actions);

    const body = document.createElement("div");
    body.className = "result-body";
    const pre = document.createElement("pre");
    pre.textContent = text;
    body.appendChild(pre);

    const meta = document.createElement("div");
    meta.className = "meta";
    const cc = text.length;
    meta.innerHTML = `
      <div><strong>${t.meta.charCount}:</strong> <code>${cc}</code></div>
      <div><strong>${t.meta.tip}:</strong> ${t.meta.tipText}</div>
    `;
    body.appendChild(meta);

    wrap.appendChild(rHead);
    wrap.appendChild(body);
    resultsEl.appendChild(wrap);
  });
}

/* ── Export ── */
function exportAll(posts, state) {
  const header = state.lang === "tr"
    ? `YouTube Gönderi Uzmanı - Dışa Aktarım\nTarih: ${new Date().toLocaleString()}\n\n`
    : `YouTube Post Expert - Export\nDate: ${new Date().toLocaleString()}\n\n`;
  const text = header + posts.map((p, i) => `--- #${i + 1} ---\n${p}\n`).join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = state.lang === "tr" ? "gonderiler.txt" : "posts.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── Reset ── */
function resetAll(lang) {
  currentState = {
    ...currentState,
    source: "video",
    postType: "standard",
    mood: "friendly",
    purpose: "engagement",
    language: "auto",
    videoTitle: "", videoTopic: "", keyPoints: "",
    audience: "", cta: "", videoLink: "", hashtags: "",
    videoUrl: "", channelSearch: "",
    videoData: null, channelData: null,
    pollOptions: "", quizQuestion: "", quizAnswers: "", imageIdeas: "",
  };
  applyState(currentState);
  // Video/Kanal kartlarını gizle
  $("videoInfoCard").style.display = "none";
  $("channelResults").style.display = "none";
  $("results").innerHTML = `<div class="empty-state"><p>${UI[lang].emptyText}</p></div>`;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  toast(UI[lang].toasts.reset);
}

/* ── Auto-fill from title ── */
function maybeAutoFillFromTitle(lang) {
  const titleEl = $("videoTitle");
  if (!titleEl) return false;
  const title = (titleEl.value || "").trim();
  if (!title) return false;

  const topicEl = $("videoTopic");
  const pointsEl = $("keyPoints");
  const topicEmpty = !(topicEl?.value || "").trim();
  const pointsEmpty = normalizeLines(pointsEl?.value || "").length === 0;
  if (!topicEmpty && !pointsEmpty) return false;

  const inferred = inferTopicAndPoints(lang, title);
  let changed = false;

  if (topicEmpty && inferred.topic && topicEl) {
    topicEl.value = inferred.topic;
    changed = true;
  }
  if (pointsEmpty && inferred.points && inferred.points.length && pointsEl) {
    pointsEl.value = inferred.points.map((p) => `- ${p}`).join("\n");
    changed = true;
  }

  if (changed) saveState();
  return changed;
}

/* ── Settings ── */
const Settings = {
  isAIEnabled() {
    return localStorage.getItem("yt-gonderi-uzmani:ai-enabled") === "true";
  },
  setAIEnabled(enabled) {
    localStorage.setItem("yt-gonderi-uzmani:ai-enabled", enabled);
  }
};

/* ── Anthropic Service ── */
const AnthropicService = {
  async generate(state, apiKey) {
    const ctx = buildContext(state);
    const lang = state.lang;
    const sysPrompt = "You are an expert social media manager for YouTube. Output purely JSON.";
    const userPrompt = AIService.buildPrompt(lang, ctx, state);

    if (!apiKey) throw new Error("API_MISSING");

    // Use the messages API
    const url = "https://api.anthropic.com/v1/messages";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "dangerously-allow-browser": "true" // Client-side specific header for Anthropic
        },
        body: JSON.stringify({
          model: "claude-3-opus-20240229",
          max_tokens: 1024,
          system: sysPrompt,
          messages: [
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error("Anthropic API Error: " + txt);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;
      if (!content) throw new Error("No content from Anthropic API");

      return AIService.parseContent(content);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
};

/* ── Video & Channel Fetch Functions ── */

async function fetchVideoInfo() {
  const lang = document.documentElement.lang === "en" ? "en" : "tr";
  const url = ($("videoUrl")?.value || "").trim();

  if (!url) {
    toast(lang === "tr" ? "Lütfen bir video URL girin" : "Please enter a video URL");
    return;
  }

  const btn = $("fetchVideoBtn");
  const btnText = $("fetchVideoText");
  const originalText = btnText.textContent;

  try {
    btn.disabled = true;
    btnText.textContent = lang === "tr" ? "Yükleniyor..." : "Loading...";

    const { data, error } = await supabaseClient.functions.invoke("fetch-video", {
      body: { url }
    });

    if (error) {
      throw new Error(error.message || "Failed to fetch video");
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (!data?.success) {
      throw new Error(lang === "tr" ? "Video bilgisi alınamadı" : "Could not get video info");
    }

    // Store in state
    currentState.videoData = {
      title: data.title,
      channel: data.channel,
      summary: data.summary,
      thumbnailUrl: data.thumbnailUrl,
      hasCaptions: data.hasCaptions,
    };

    // Update UI
    renderVideoInfo(data);
    saveState();

    toast(lang === "tr" ? "Video bilgileri alındı!" : "Video info fetched!");
  } catch (e) {
    console.error("fetchVideoInfo error:", e);
    toast("Hata: " + (e.message || (lang === "tr" ? "Video bilgisi alınamadı" : "Could not fetch video info")));
  } finally {
    btn.disabled = false;
    btnText.textContent = originalText;
  }
}

async function fetchChannelInfo() {
  const lang = document.documentElement.lang === "en" ? "en" : "tr";
  const query = ($("channelSearch")?.value || "").trim();

  if (!query) {
    toast(lang === "tr" ? "Lütfen bir kanal adı veya URL girin" : "Please enter a channel name or URL");
    return;
  }

  const btn = $("searchChannelBtn");
  const originalText = btn.textContent;

  try {
    btn.disabled = true;
    btn.textContent = lang === "tr" ? "Yükleniyor..." : "Loading...";

    const { data, error } = await supabaseClient.functions.invoke("fetch-channel", {
      body: { query }
    });

    if (error) {
      throw new Error(error.message || "Failed to fetch channel");
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (!data?.success) {
      throw new Error(lang === "tr" ? "Kanal bilgisi alınamadı" : "Could not get channel info");
    }

    // Store in state
    currentState.channelData = {
      channelName: data.channelName,
      videos: data.videos,
      contentKeywords: data.contentKeywords,
    };

    // Update UI
    renderChannelInfo(data);
    saveState();

    toast(lang === "tr" ? "Kanal bilgileri alındı!" : "Channel info fetched!");
  } catch (e) {
    console.error("fetchChannelInfo error:", e);
    toast("Hata: " + (e.message || (lang === "tr" ? "Kanal bilgisi alınamadı" : "Could not fetch channel info")));
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function renderVideoInfo(data) {
  $("videoThumbnail").src = data.thumbnailUrl || "";
  $("videoTitleDisplay").textContent = data.title || "";
  $("videoChannel").textContent = data.channel || "";
  $("videoSummary").textContent = data.summary || "";
  $("videoCaptionBadge").style.display = data.hasCaptions ? "inline-block" : "none";
  $("videoInfoCard").style.display = "block";
}

function renderChannelInfo(data) {
  $("channelNameDisplay").textContent = data.channelName || "";

  // Render videos
  const videosContainer = $("channelVideos");
  videosContainer.innerHTML = "";

  if (data.videos && data.videos.length > 0) {
    data.videos.slice(0, 5).forEach(video => {
      const item = document.createElement("div");
      item.className = "channel-video-item";
      item.innerHTML = `
        <img class="channel-video-thumb" src="${video.thumbnail}" alt="">
        <p class="channel-video-title">${video.title}</p>
      `;
      videosContainer.appendChild(item);
    });
  }

  // Render keywords
  const keywordsContainer = $("channelKeywords");
  keywordsContainer.innerHTML = "";

  if (data.contentKeywords && data.contentKeywords.length > 0) {
    data.contentKeywords.forEach(keyword => {
      const badge = document.createElement("span");
      badge.className = "channel-keyword";
      badge.textContent = keyword;
      keywordsContainer.appendChild(badge);
    });
  }

  $("channelResults").style.display = "block";
}

function clearVideoData() {
  currentState.videoData = null;
  $("videoInfoCard").style.display = "none";
  $("videoUrl").value = "";
  saveState();
}

function clearChannelData() {
  currentState.channelData = null;
  $("channelResults").style.display = "none";
  $("channelSearch").value = "";
  saveState();
}

function clearFreetextData() {
  $("videoTopic").value = "";
  $("clearFreetextBtn").style.display = "none";
}

function updateFreetextClearBtn() {
  const hasText = ($("videoTopic")?.value || "").trim().length > 0;
  $("clearFreetextBtn").style.display = hasText ? "block" : "none";
}

const AIService = {
  // Supabase Edge Function üzerinden AI çağrısı (API key server-side)
  async generate(state) {
    const lang = state.lang;

    console.log("Edge Function çağrılıyor...", { source: state.source, postType: state.postType, mood: state.mood });

    if (!supabaseClient) {
      throw new Error(lang === "tr"
        ? "Supabase bağlantısı kurulamadı. Sayfayı yenileyin."
        : "Supabase connection failed. Refresh the page.");
    }

    try {
      const { data, error } = await supabaseClient.functions.invoke("generate-post", {
        body: { state },
      });

      // Edge Function returned an error
      if (error) {
        console.error("Edge Function hatası:", error);
        throw new Error(lang === "tr"
          ? `AI hatası: ${error.message || "Bilinmeyen hata"}`
          : `AI error: ${error.message || "Unknown error"}`);
      }

      // Check for error in response body (Edge Function may return { error: "..." })
      if (data?.error) {
        console.error("Edge Function yanıt hatası:", data.error);
        throw new Error(data.error);
      }

      // Success — return posts array
      if (data?.posts && Array.isArray(data.posts)) {
        console.log("Edge Function başarılı, gönderi sayısı:", data.posts.length);
        return data.posts;
      }

      // Fallback parse
      return this.parseContent(JSON.stringify(data));
    } catch (e) {
      // Network error (no internet)
      if (e.message === "Failed to fetch" || e.name === "TypeError") {
        throw new Error(lang === "tr"
          ? "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin."
          : "Cannot connect to server. Check your internet connection.");
      }
      // Re-throw known errors
      throw e;
    }
  },

  // buildPrompt() moved to Supabase Edge Function (server-side)

  parseContent(content) {
    try {
      const clean = content.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.posts && Array.isArray(parsed.posts)) return parsed.posts;
      return [clean];
    } catch (e) {
      return [content];
    }
  }
};

/* ── Wire Events ── */
function wire() {
  // Language buttons
  if ($("langTr")) {
    $("langTr").addEventListener("click", () => {
      setLanguage("tr");
      saveState();
    });
  }
  if ($("langEn")) {
    $("langEn").addEventListener("click", () => {
      setLanguage("en");
      saveState();
    });
  }





  // Source tabs
  document.querySelectorAll("#sourceTabGroup .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchSource(btn.dataset.source);
      saveState();
    });
  });

  // Post type pills
  document.querySelectorAll("#postTypeGroup .option-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveCard($("postTypeGroup"), btn.dataset.value);
      saveState();
    });
  });

  // Mood cards
  document.querySelectorAll("#moodGroup .option-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveCard($("moodGroup"), btn.dataset.value);
      saveState();
    });
  });

  // Purpose cards
  document.querySelectorAll("#purposeGroup .option-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveCard($("purposeGroup"), btn.dataset.value);
      saveState();
    });
  });

  // Language select
  $("languageSelect").addEventListener("change", saveState);

  // Reset button
  $("resetBtn").addEventListener("click", () => {
    const lang = document.documentElement.lang === "en" ? "en" : "tr";
    resetAll(lang);
  });

  // Generate button
  // Generate button
  // Generate button
  $("generateBtn").addEventListener("click", async () => {
    const lang = document.documentElement.lang === "en" ? "en" : "tr";

    // 1. Check Auth
    if (!AuthService.currentUser) {
      Modals.open("loginModal");
      toast(lang === "tr" ? "Önce giriş yapmalısınız." : "Please login first.");
      return;
    }

    // 2. Check Tokens
    if (AuthService.currentUser.tokens < 1) {
      Modals.open("buyTokensModal");
      $("tokenWarning").style.display = "flex";
      return;
    }

    // No auto-fill needed here, prompt handles it

    const btn = $("generateBtn");
    const btnText = $("generateBtnText");
    const originalText = btnText.textContent;

    try {
      btn.disabled = true;
      btnText.textContent = lang === "tr" ? "AI Düşünüyor..." : "AI Thinking...";

      const state = getState();
      const posts = await AIService.generate(state);

      // Deduct token only on success
      const ok = await AuthService.deductToken();
      if (!ok) {
        toast(lang === "tr" ? "Yetersiz token!" : "Insufficient tokens!");
        return;
      }
      $("tokenWarning").style.display = "none";

      renderResults(posts, state);
      saveState();
      toast(lang === "tr" ? "Gönderiler oluşturuldu!" : "Posts generated!");
    } catch (err) {
      console.error(err);
      toast("Hata: " + err.message);
    } finally {
      btn.disabled = false;
      btnText.textContent = originalText;
    }
  });

  // Back to Top
  $("backToTopBtn").addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Theme toggle
  $("themeToggle").addEventListener("click", toggleTheme);

  // Fetch video button
  $("fetchVideoBtn").addEventListener("click", fetchVideoInfo);

  // Search channel button
  $("searchChannelBtn").addEventListener("click", fetchChannelInfo);

  // Clear buttons
  $("clearVideoBtn").addEventListener("click", clearVideoData);
  $("clearChannelBtn").addEventListener("click", clearChannelData);
  $("clearFreetextBtn").addEventListener("click", clearFreetextData);

  // Serbest yazı alanında yazı varsa Kaldır butonunu göster
  $("videoTopic").addEventListener("input", updateFreetextClearBtn);

  // Password visibility toggle
  document.querySelectorAll(".password-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = $(targetId);
      if (!input) return;
      const type = input.type === "password" ? "text" : "password";
      input.type = type;
      btn.classList.toggle("is-showing", type === "text");
      const openIcon = btn.querySelector(".eye-open");
      const closedIcon = btn.querySelector(".eye-closed");
      if (openIcon && closedIcon) {
        openIcon.style.display = type === "text" ? "none" : "";
        closedIcon.style.display = type === "text" ? "" : "none";
      }
    });
  });

  // Auto-fill logic removed (will be handled by AI prompt for Zero-Config)


  /* ── Auth Wiring ── */
  // Login Open/Close
  if ($("loginBtn")) {
    $("loginBtn").addEventListener("click", () => Modals.open("loginModal"));
  }
  if ($("loginClose")) {
    $("loginClose").addEventListener("click", Modals.closeAll);
  }

  // Register Open/Close
  if ($("registerBtn")) {
    $("registerBtn").addEventListener("click", () => Modals.open("registerModal"));
  }
  if ($("registerClose")) {
    $("registerClose").addEventListener("click", Modals.closeAll);
  }

  // Buy Open/Close
  if ($("buyTokensBtn")) {
    $("buyTokensBtn").addEventListener("click", () => {
      $("userDropdown").classList.remove("is-open");
      Modals.open("buyTokensModal");
    });
  }
  if ($("buyTokensClose")) {
    $("buyTokensClose").addEventListener("click", Modals.closeAll);
  }

  // Switchers
  $("swToRegister").addEventListener("click", (e) => {
    e.preventDefault();
    Modals.closeAll();
    setTimeout(() => Modals.open("registerModal"), 50);
  });
  $("swToLogin").addEventListener("click", (e) => {
    e.preventDefault();
    Modals.closeAll();
    setTimeout(() => Modals.open("loginModal"), 50);
  });

  // Forms
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Giriş yapılıyor...";
      const ok = await AuthService.login($("loginEmail").value, $("loginPassword").value);
      if (ok) {
        e.target.reset();
        Modals.closeAll();
        toast("Giriş yapıldı");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Hesap oluşturuluyor...";
      const ok = await AuthService.register($("regName").value, $("regEmail").value, $("regPassword").value);
      if (ok) {
        e.target.reset();
        Modals.closeAll();
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // ── Shopier Checkout (in-page iframe) ──

  const SHOPIER_URLS = {
    100: "https://www.shopier.com/bymilyoner/44335263",
    500: "https://www.shopier.com/bymilyoner/44335254",
    1000: "https://www.shopier.com/bymilyoner/44335234",
  };

  const ShopierCheckout = {
    overlay: $("shopierCheckoutOverlay"),
    iframe: $("shopierIframe"),
    loading: $("shopierIframeLoading"),
    emailEl: $("shopierUserEmail"),
    pkgNameEl: $("shopierCheckoutPkgName"),
    emailBanner: $("shopierEmailBanner"),

    open(tokens) {
      const url = SHOPIER_URLS[tokens];
      if (!url) return;

      const email = AuthService.currentUser?.email || "";
      this.emailEl.textContent = email;
      this.pkgNameEl.textContent = `${tokens} Token Satın Al`;

      // Show loading, then load iframe
      this.loading.style.display = "flex";
      this.iframe.src = url;
      this.iframe.onload = () => {
        this.loading.style.display = "none";
      };

      // Show overlay
      this.overlay.style.display = "flex";
      document.body.style.overflow = "hidden";

      // Auto-copy email to clipboard
      if (email) {
        navigator.clipboard.writeText(email).catch(() => { });
      }

      // Close the buy tokens modal
      Modals.closeAll();

      // Start polling
      ShopierPolling.start();
    },

    close() {
      this.overlay.style.display = "none";
      this.iframe.src = "about:blank";
      document.body.style.overflow = "";
    }
  };

  // Close button
  $("shopierCheckoutClose").addEventListener("click", () => ShopierCheckout.close());

  // Close on overlay click (outside modal)
  $("shopierCheckoutOverlay").addEventListener("click", (e) => {
    if (e.target === $("shopierCheckoutOverlay")) {
      ShopierCheckout.close();
    }
  });

  // ESC key to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("shopierCheckoutOverlay").style.display === "flex") {
      ShopierCheckout.close();
    }
  });

  // Copy email button
  $("shopierCopyEmail").addEventListener("click", () => {
    const email = AuthService.currentUser?.email || "";
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      const btn = $("shopierCopyEmail");
      btn.classList.add("copied");
      btn.querySelector("span").textContent = "Kopyalandı!";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.querySelector("span").textContent = "E-postayı Kopyala";
      }, 2000);
    });
  });

  // Package card clicks -> open iframe checkout
  document.querySelectorAll(".package-card").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const amount = parseInt(link.dataset.tokens, 10);
      ShopierCheckout.open(amount);
    });
  });

  // Shopier Token Balance Polling
  const ShopierPolling = {
    _interval: null,
    _initialBalance: 0,
    _attempts: 0,
    _maxAttempts: 60,

    start() {
      this.stop();
      if (!AuthService.currentUser) return;
      this._initialBalance = AuthService.currentUser.tokens;
      this._attempts = 0;
      this._interval = setInterval(() => this._check(), 5000);
    },

    stop() {
      if (this._interval) {
        clearInterval(this._interval);
        this._interval = null;
      }
    },

    async _check() {
      this._attempts++;
      if (this._attempts >= this._maxAttempts || !AuthService.currentUser) {
        this.stop();
        return;
      }
      try {
        await AuthService.fetchProfile(AuthService.currentUser.id);
        if (AuthService.currentUser.tokens > this._initialBalance) {
          const added = AuthService.currentUser.tokens - this._initialBalance;
          toast(`${added} Token hesabınıza eklendi!`);
          $("tokenWarning").style.display = "none";
          ShopierCheckout.close();
          this.stop();
        }
      } catch (e) {
        // Silently retry
      }
    }
  };

  // Quick buy button in warning
  const qBuy = $("quickBuyBtn");
  if (qBuy) {
    qBuy.addEventListener("click", () => {
      Modals.open("buyTokensModal");
    });
  }

  // User Dropdown
  if ($("userProfileBtn")) {
    $("userProfileBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if ($("userDropdown")) $("userDropdown").classList.toggle("is-open");
    });
  }

  document.addEventListener("click", () => {
    $("userDropdown")?.classList.remove("is-open");
  });

  if ($("logoutBtn")) {
    $("logoutBtn").addEventListener("click", () => {
      AuthService.logout();
    });
  }

  // Modal Overlay Close
  if ($("modalOverlay")) {
    $("modalOverlay").addEventListener("click", Modals.closeAll);
  }

  // ESC key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      Modals.closeAll();
      $("userDropdown")?.classList.remove("is-open");
    }
  });

  // Password toggle (show/hide)
  document.querySelectorAll(".password-toggle").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const targetId = btn.getAttribute("data-target");
      const input = $(targetId);
      if (!input) return;
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      const eyeOpen = btn.querySelector(".eye-open");
      const eyeClosed = btn.querySelector(".eye-closed");
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = isPassword ? "none" : "block";
        eyeClosed.style.display = isPassword ? "block" : "none";
      }
    });
  });
}

/* ── Init ── */
function init() {
  // Theme: check saved > system pref > default light
  const storedTheme = getStoredTheme();
  if (storedTheme) {
    setTheme(storedTheme);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    setTheme("dark");
  } else {
    setTheme("light");
  }

  const saved = loadState();
  const lang = saved?.lang === "en" ? "en" : "tr";
  setLanguage(lang);
  if (saved) {
    applyState(saved);
  }

  // No settings to check, AI is always on



  AuthService.init(); // Init User State
  wire();
}

init();
