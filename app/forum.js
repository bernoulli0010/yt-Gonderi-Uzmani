/* ═══════════════════════════════════════════════════════════
   YTConsole Forum - Complete Forum System
   ═══════════════════════════════════════════════════════════ */

const THEME_KEY = "yt-gonderi-uzmani:theme";
const $ = (id) => document.getElementById(id);

/* ── Supabase ── */
const SUPABASE_URL = "https://bjcsbuvjumaigvsjphor.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ws-ubr-U3Uryo-oJxE0rvg_QTlz2Kqa";

let supabaseClient;
try {
  supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
} catch (e) {
  console.error("Supabase error:", e);
}

/* ── Toast ── */
function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("is-visible");
  setTimeout(() => t.classList.remove("is-visible"), 3000);
}

/* ── Time Helpers ── */
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "az once";
  if (diff < 3600) return Math.floor(diff / 60) + " dk once";
  if (diff < 86400) return Math.floor(diff / 3600) + " saat once";
  if (diff < 604800) return Math.floor(diff / 86400) + " gun once";
  return d.toLocaleDateString("tr-TR");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

/* ── Escape HTML ── */
function esc(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

/* ── Escape for inline JS attribute (onclick etc.) ── */
function escAttr(str) {
  if (!str) return "";
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════════════════════
   BBCODE PARSER & SAFE CONTENT RENDERER
   Security: first esc() all HTML, then parse only whitelisted BBCode
   ═══════════════════════════════════════════════════════════ */
const SUPABASE_STORAGE_HOST = "bjcsbuvjumaigvsjphor.supabase.co";

function renderContent(raw) {
  if (!raw) return "";
  // 1. Escape ALL HTML first (prevents XSS)
  let s = esc(raw);

  // 2. Parse BBCode tags to safe HTML
  // [b]...[/b]
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
  // [i]...[/i]
  s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
  // [u]...[/u]
  s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
  // [s]...[/s]
  s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>');
  // [code]...[/code]
  s = s.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<code class="forum-code">$1</code>');
  // [quote]...[/quote]
  s = s.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="forum-quote">$1</blockquote>');
  // [quote=name]...[/quote]
  s = s.replace(/\[quote=([^\]]{1,50})\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="forum-quote"><cite>$1</cite>$2</blockquote>');
  // [url=...]...[/url] - only http/https
  s = s.replace(/\[url=(https?:\/\/[^\]]{1,500})\]([\s\S]*?)\[\/url\]/gi, (m, url, text) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="forum-link">${text}</a>`;
  });
  // [url]...[/url]
  s = s.replace(/\[url\](https?:\/\/[^\[]{1,500})\[\/url\]/gi, (m, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="forum-link">${url}</a>`;
  });
  // [img]...[/img] - ONLY allow our Supabase storage URLs
  s = s.replace(/\[img\](https?:\/\/[^\[]{1,500})\[\/img\]/gi, (m, url) => {
    try {
      const u = new URL(url);
      if (u.hostname === SUPABASE_STORAGE_HOST || u.hostname.endsWith('.supabase.co')) {
        return `<img src="${url}" alt="forum-image" class="forum-img" loading="lazy" onclick="ForumEditor.previewImage('${url.replace(/'/g, "")}')" />`;
      }
    } catch {}
    return `<span class="forum-img-blocked">[Harici resim engellendi]</span>`;
  });
  // [color=...]...[/color] - only safe color values
  s = s.replace(/\[color=(#[0-9a-fA-F]{3,6}|[a-zA-Z]{1,20})\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>');

  // 3. Convert newlines to <br>
  s = s.replace(/\n/g, '<br>');

  return s;
}

/* ═══════════════════════════════════════════════════════════
   FORUM EDITOR - Toolbar + Image Upload
   ═══════════════════════════════════════════════════════════ */
const ForumEditor = {
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_SIZE: 2 * 1024 * 1024, // 2MB
  uploading: false,

  /** Build toolbar HTML for a textarea */
  buildToolbar(textareaId) {
    return `
      <div class="editor-toolbar" data-target="${textareaId}">
        <button type="button" class="editor-btn" onclick="ForumEditor.wrap('${textareaId}','b')" title="Kalin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </button>
        <button type="button" class="editor-btn" onclick="ForumEditor.wrap('${textareaId}','i')" title="Italik">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </button>
        <button type="button" class="editor-btn" onclick="ForumEditor.wrap('${textareaId}','u')" title="Alti Cizili">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
        </button>
        <button type="button" class="editor-btn" onclick="ForumEditor.wrap('${textareaId}','s')" title="Ustu Cizili">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><path d="M17.5 7.5C17 5 15 4 12 4c-3 0-5 2-5 4 0 3 3 4 5 4.5 2 .5 5 1.5 5 4.5 0 2-2 4-5 4s-5-1-5.5-4"/></svg>
        </button>
        <span class="editor-sep"></span>
        <button type="button" class="editor-btn" onclick="ForumEditor.insertQuote('${textareaId}')" title="Alinti">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button type="button" class="editor-btn" onclick="ForumEditor.wrap('${textareaId}','code')" title="Kod">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>
        <button type="button" class="editor-btn" onclick="ForumEditor.insertLink('${textareaId}')" title="Link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </button>
        <span class="editor-sep"></span>
        <button type="button" class="editor-btn editor-btn-img" onclick="ForumEditor.triggerUpload('${textareaId}')" title="Resim Yukle (maks 2MB)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Resim
        </button>
        <input type="file" id="fileInput-${textareaId}" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;" onchange="ForumEditor.handleUpload(event, '${textareaId}')" />
        <span class="editor-upload-status" id="uploadStatus-${textareaId}"></span>
      </div>`;
  },

  /** Wrap selected text with BBCode tag */
  wrap(textareaId, tag) {
    const ta = $(textareaId);
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.substring(start, end);
    const replacement = `[${tag}]${selected}[/${tag}]`;
    ta.value = text.substring(0, start) + replacement + text.substring(end);
    ta.focus();
    ta.selectionStart = start + tag.length + 2;
    ta.selectionEnd = start + tag.length + 2 + selected.length;
  },

  /** Insert quote BBCode */
  insertQuote(textareaId) {
    const ta = $(textareaId);
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.substring(start, end);
    const replacement = `[quote]${selected || "Alinti metni..."}[/quote]\n`;
    ta.value = text.substring(0, start) + replacement + text.substring(end);
    ta.focus();
  },

  /** Insert link BBCode */
  insertLink(textareaId) {
    const url = prompt("URL girin:", "https://");
    if (!url || url === "https://") return;
    const ta = $(textareaId);
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    const selected = text.substring(start, end) || url;
    const replacement = `[url=${url}]${selected}[/url]`;
    ta.value = text.substring(0, start) + replacement + text.substring(end);
    ta.focus();
  },

  /** Trigger file input click */
  triggerUpload(textareaId) {
    if (!AuthService.currentUser) { ForumModals.open("loginModal"); return; }
    const fileInput = $(`fileInput-${textareaId}`);
    if (fileInput) fileInput.click();
  },

  /** Handle image upload */
  async handleUpload(event, textareaId) {
    const file = event.target.files?.[0];
    if (!file) return;

    const statusEl = $(`uploadStatus-${textareaId}`);
    const setStatus = (msg, isError) => {
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.className = `editor-upload-status ${isError ? 'error' : 'success'}`;
        if (msg) setTimeout(() => { statusEl.textContent = ""; }, 4000);
      }
    };

    // Client-side validation
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      setStatus("Sadece JPEG, PNG, GIF, WebP yuklenir!", true);
      event.target.value = "";
      return;
    }
    if (file.size > this.MAX_SIZE) {
      setStatus("Dosya 2MB'dan buyuk olamaz!", true);
      event.target.value = "";
      return;
    }
    if (this.uploading) {
      setStatus("Yukleme devam ediyor...", true);
      return;
    }

    // Validate file header (magic bytes)
    const isValid = await this.validateMagicBytes(file);
    if (!isValid) {
      setStatus("Gecersiz dosya formati!", true);
      event.target.value = "";
      return;
    }

    this.uploading = true;
    setStatus("Yukleniyor...", false);

    try {
      // Sanitize filename: userId/timestamp_random.ext
      const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
      const safeExt = ['jpg','jpeg','png','gif','webp'].includes(ext) ? ext : 'jpg';
      const userId = AuthService.currentUser.id;
      const ts = Date.now();
      const rand = Math.random().toString(36).substring(2, 8);
      const path = `${userId}/${ts}_${rand}.${safeExt}`;

      const { data, error } = await supabaseClient.storage
        .from('forum-images')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (error) {
        setStatus("Yukleme hatasi: " + error.message, true);
        return;
      }

      // Get public URL
      const { data: urlData } = supabaseClient.storage
        .from('forum-images')
        .getPublicUrl(data.path);

      if (urlData?.publicUrl) {
        // Insert [img] BBCode into textarea
        const ta = $(textareaId);
        if (ta) {
          const pos = ta.selectionStart;
          const text = ta.value;
          const imgTag = `[img]${urlData.publicUrl}[/img]\n`;
          ta.value = text.substring(0, pos) + imgTag + text.substring(pos);
          ta.focus();
        }
        setStatus("Resim yuklendi!", false);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("Yukleme sirasinda hata olustu.", true);
    } finally {
      this.uploading = false;
      event.target.value = "";
    }
  },

  /** Validate file magic bytes (JPEG, PNG, GIF, WebP) */
  async validateMagicBytes(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = function() {
        const arr = new Uint8Array(reader.result);
        if (arr.length < 4) { resolve(false); return; }
        // JPEG: FF D8 FF
        if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) { resolve(true); return; }
        // PNG: 89 50 4E 47
        if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) { resolve(true); return; }
        // GIF: 47 49 46
        if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) { resolve(true); return; }
        // WebP: 52 49 46 46 ... 57 45 42 50
        if (arr.length >= 12 && arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
            arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) { resolve(true); return; }
        resolve(false);
      };
      reader.readAsArrayBuffer(file.slice(0, 16));
    });
  },

  /** Image preview lightbox */
  previewImage(url) {
    // Create a simple fullscreen preview
    const overlay = document.createElement('div');
    overlay.className = 'forum-img-preview-overlay';
    overlay.innerHTML = `
      <div class="forum-img-preview-wrap">
        <img src="${esc(url)}" alt="preview" />
        <button class="forum-img-preview-close" onclick="this.closest('.forum-img-preview-overlay').remove()">&times;</button>
      </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
};

/* ═══════════════════════════════════════════════════════════
   AUTH SERVICE
   ═══════════════════════════════════════════════════════════ */
const AuthService = {
  currentUser: null,

  async init() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      await this.fetchProfile(session.user.id);
    }
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
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          const created = await this.createProfileFallback(userId);
          if (created) return;
        }
        console.error("Profile Error:", error);
        return;
      }

      if (data) {
        this.currentUser = {
          id: data.id,
          email: data.email,
          name: data.full_name || data.email?.split("@")[0],
          tokens: data.token_balance,
          role: data.role || "user",
          created_at: data.created_at
        };
        this.updateUI();
      }
    } catch (err) {
      console.error("Profile system error", err);
    }
  },

  async createProfileFallback(userId) {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) return false;
      const email = user.email;
      const fullName = user.user_metadata?.full_name || email?.split("@")[0] || "";

      const { data, error } = await supabaseClient
        .from("profiles")
        .insert({ id: userId, email, full_name: fullName, token_balance: 5 })
        .select()
        .single();

      if (error) {
        await new Promise(r => setTimeout(r, 2000));
        const { data: retryData, error: retryError } = await supabaseClient
          .from("profiles").select("*").eq("id", userId).single();
        if (!retryError && retryData) {
          this.currentUser = {
            id: retryData.id, email: retryData.email,
            name: retryData.full_name || retryData.email?.split("@")[0],
            tokens: retryData.token_balance, role: retryData.role || "user",
            created_at: retryData.created_at
          };
          this.updateUI();
          return true;
        }
        return false;
      }
      if (data) {
        this.currentUser = {
          id: data.id, email: data.email,
          name: data.full_name || data.email?.split("@")[0],
          tokens: data.token_balance, role: data.role || "user",
          created_at: data.created_at
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
    if (!supabaseClient) { toast("Supabase baglantisi kurulamadi."); return false; }
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        let msg = error.message;
        if (msg.includes("Invalid login credentials")) msg = "Gecersiz e-posta veya sifre.";
        else if (msg.includes("Email not confirmed")) msg = "E-posta dogrulanmamis.";
        toast("Giris hatasi: " + msg);
        return false;
      }
      return true;
    } catch (err) {
      toast("Giris hatasi.");
      return false;
    }
  },

  async register(name, email, password) {
    if (!supabaseClient) { toast("Supabase baglantisi kurulamadi."); return false; }
    if (!password || password.length < 6) { toast("Sifre en az 6 karakter olmalidir."); return false; }
    if (!name || name.trim().length === 0) { toast("Lutfen adinizi girin."); return false; }
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email, password, options: { data: { full_name: name.trim() } }
      });
      if (error) {
        let msg = error.message;
        if (msg.includes("already registered")) msg = "Bu e-posta zaten kayitli.";
        toast("Kayit hatasi: " + msg);
        return false;
      }
      if (data.user && !data.session) {
        if (!data.user.identities || data.user.identities.length === 0) {
          toast("Bu e-posta zaten kayitli. Giris yapmayi deneyin.");
          return false;
        }
        toast("Kayit basarili! E-postanizi dogrulayin.");
        return true;
      }
      toast("Kayit basarili!");
      return true;
    } catch (err) {
      toast("Kayit hatasi: " + err.message);
      return false;
    }
  },

  async logout() {
    await supabaseClient.auth.signOut();
    this.currentUser = null;
    this.updateUI();
    window.location.reload();
  },

  isAdmin() { return this.currentUser?.role === "admin"; },
  isMod() { return this.currentUser?.role === "moderator"; },
  isModOrAdmin() { return this.isAdmin() || this.isMod(); },

  updateUI() {
    const user = this.currentUser;
    if (user) {
      if ($("authGuest")) $("authGuest").style.display = "none";
      if ($("authUser")) $("authUser").style.display = "flex";
      if ($("userTokens")) $("userTokens").textContent = user.tokens;
      if ($("dropdownName")) $("dropdownName").textContent = user.name;
      if ($("dropdownEmail")) $("dropdownEmail").textContent = user.email;
      if ($("userInitials")) $("userInitials").textContent = (user.name || "U")[0].toUpperCase();
      if ($("newThreadBtn")) $("newThreadBtn").style.display = "inline-flex";
      if ($("newThreadBtnCat")) $("newThreadBtnCat").style.display = "inline-flex";
      if ($("adminPanelBtn")) $("adminPanelBtn").style.display = this.isModOrAdmin() ? "inline-flex" : "none";
    } else {
      if ($("authGuest")) $("authGuest").style.display = "flex";
      if ($("authUser")) $("authUser").style.display = "none";
      if ($("newThreadBtn")) $("newThreadBtn").style.display = "none";
      if ($("newThreadBtnCat")) $("newThreadBtnCat").style.display = "none";
      if ($("adminPanelBtn")) $("adminPanelBtn").style.display = "none";
    }
  }
};

/* ═══════════════════════════════════════════════════════════
   MODALS
   ═══════════════════════════════════════════════════════════ */
const ForumModals = {
  open(id) {
    const m = $(id);
    const o = $("forumModalOverlay");
    if (m && o) {
      o.style.display = "block";
      m.classList.add("is-visible");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { m.classList.add("is-open"); });
      });
    }
  },
  close() {
    const overlay = $("forumModalOverlay");
    if (overlay) overlay.style.display = "none";
    document.querySelectorAll(".forum-modal").forEach(m => {
      m.classList.remove("is-open");
      m.classList.remove("is-visible");
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════ */
function setTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const moonIcon = document.querySelector(".icon-moon");
  const sunIcon = document.querySelector(".icon-sun");
  if (moonIcon && sunIcon) {
    moonIcon.style.display = theme === "dark" ? "none" : "block";
    sunIcon.style.display = theme === "dark" ? "block" : "none";
  }
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════
   FORUM CORE
   ═══════════════════════════════════════════════════════════ */
const Forum = {
  // Data caches
  groups: [],
  categories: [],
  subcategories: [],
  recentThreads: [],
  currentTab: "recent",
  recentPage: 0,
  recentPageSize: 10,
  currentCategoryId: null,
  currentSubcategoryId: null,
  currentThreadId: null,
  threadPage: 0,
  threadPageSize: 20,
  searchQuery: "",

  /* ── Navigate between views ── */
  navigate(view, params) {
    document.querySelectorAll(".forum-view").forEach(v => v.classList.remove("is-active"));

    if (view === "home") {
      $("viewHome").classList.add("is-active");
      this.loadHome();
    } else if (view === "category") {
      $("viewCategory").classList.add("is-active");
      this.currentCategoryId = params?.categoryId;
      this.currentSubcategoryId = params?.subcategoryId || null;
      this.threadPage = 0;
      this.loadCategory();
    } else if (view === "thread") {
      $("viewThread").classList.add("is-active");
      this.currentThreadId = params?.threadId;
      this.loadThread();
    } else if (view === "admin") {
      $("viewAdmin").classList.add("is-active");
      AdminPanel.load("groups");
    }
  },

  /* ── Load Home View ── */
  async loadHome() {
    this.recentPage = 0;
    await Promise.all([
      this.loadRecentThreads(),
      this.loadCategoryGroups()
    ]);
  },

  /* ── Load Recent Threads ── */
  async loadRecentThreads() {
    const container = $("recentThreadsList");
    container.innerHTML = '<div class="forum-loading"><div class="spinner"></div>Yukleniyor...</div>';

    try {
      let query = supabaseClient
        .from("forum_threads")
        .select("*, profiles!forum_threads_user_id_fkey(full_name, email, role), forum_categories!inner(name)")
        .range(0, (this.recentPage + 1) * this.recentPageSize - 1);

      if (this.searchQuery) {
        query = query.ilike("title", `%${this.searchQuery}%`);
      }

      if (this.currentTab === "popular") {
        query = query.order("like_count", { ascending: false }).order("reply_count", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        container.innerHTML = '<div class="forum-empty"><p>Veriler yuklenirken hata olustu.</p></div>';
        console.error("Recent threads error:", error);
        return;
      }

      if (!data || data.length === 0) {
        container.innerHTML = '<div class="forum-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>Henuz konu acilmamis.</p></div>';
        $("loadMoreBtn").style.display = "none";
        return;
      }

      this.recentThreads = data;
      let html = "";
      data.forEach(t => {
        const authorName = t.profiles?.full_name || t.profiles?.email?.split("@")[0] || "Anonim";
        const initial = (authorName || "A")[0].toUpperCase();
        const catName = t.forum_categories?.name || "";
        html += `
          <div class="forum-recent-row" onclick="Forum.navigate('thread', {threadId:'${t.id}'})">
            <div class="recent-thread-info">
              <div class="recent-avatar">
                <div class="avatar">${esc(initial)}</div>
              </div>
              <span class="recent-title">
                ${t.is_pinned ? '<span class="pin-icon">&#128204;</span>' : ""}
                ${t.is_locked ? '<span class="lock-icon">&#128274;</span>' : ""}
                ${esc(t.title)}
              </span>
            </div>
            <div class="recent-reply">
              <span class="recent-reply-user">${esc(t.last_reply_user || authorName)}</span>
              <span class="recent-reply-time">${timeAgo(t.last_reply_at || t.created_at)}</span>
            </div>
            <div class="recent-category">${esc(catName)}</div>
          </div>`;
      });
      container.innerHTML = html;

      // Show load more if there might be more
      $("loadMoreBtn").style.display = data.length >= (this.recentPage + 1) * this.recentPageSize ? "block" : "none";

    } catch (err) {
      container.innerHTML = '<div class="forum-empty"><p>Hata olustu.</p></div>';
      console.error(err);
    }
  },

  /* ── Load Category Groups ── */
  async loadCategoryGroups() {
    const container = $("categoryGroupsList");
    container.innerHTML = '<div class="forum-loading"><div class="spinner"></div>Yukleniyor...</div>';

    try {
      // Load groups
      const { data: groups, error: gErr } = await supabaseClient
        .from("forum_category_groups")
        .select("*")
        .order("sort_order", { ascending: true });

      if (gErr) { console.error(gErr); container.innerHTML = ""; return; }

      // Load categories
      const { data: cats, error: cErr } = await supabaseClient
        .from("forum_categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (cErr) { console.error(cErr); }

      // Load subcategories
      const { data: subs, error: sErr } = await supabaseClient
        .from("forum_subcategories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (sErr) { console.error(sErr); }

      this.groups = groups || [];
      this.categories = cats || [];
      this.subcategories = subs || [];

      if (this.groups.length === 0) {
        container.innerHTML = '<div class="forum-empty"><p>Henuz kategori grubu olusturulmamis.</p></div>';
        return;
      }

      let html = "";
      this.groups.forEach(g => {
        const groupCats = this.categories.filter(c => c.group_id === g.id);
        const collapsed = g.is_collapsed ? " collapsed" : "";

        html += `<div class="forum-group">`;
        html += `<div class="forum-group-title${collapsed}" onclick="Forum.toggleGroup(this)">
          <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          <span>${esc(g.name)}</span>
        </div>`;
        html += `<div class="forum-group-body${collapsed}">`;

        groupCats.forEach(cat => {
          const catSubs = this.subcategories.filter(s => s.category_id === cat.id);
          html += `
            <div class="forum-category-row">
              <div class="cat-info" onclick="Forum.navigate('category', {categoryId:'${cat.id}'})">
                <div class="cat-icon">${cat.icon || "&#128172;"}</div>
                <div class="cat-details">
                  <div class="cat-name">${esc(cat.name)}</div>
                  <div class="cat-desc">${esc(cat.description || "")}</div>
                  ${catSubs.length > 0 ? `<div class="cat-subcategories">
                    ${catSubs.map(s => `<span class="cat-sub-tag" onclick="event.stopPropagation(); Forum.navigate('category', {categoryId:'${cat.id}', subcategoryId:'${s.id}'})">\u{1F4C1} ${esc(s.name)}</span>`).join("")}
                  </div>` : ""}
                </div>
              </div>
              <div class="cat-last-post">
                ${cat.last_thread_title
                  ? `<span class="cat-last-title" onclick="event.stopPropagation(); ${cat.last_thread_id ? `Forum.navigate('thread', {threadId:'${cat.last_thread_id}'})` : ''}">${esc(cat.last_thread_title)}</span>
                     <span class="cat-last-user">${esc(cat.last_reply_user || "")}</span>
                     <span class="cat-last-time">${timeAgo(cat.last_reply_at)}</span>`
                  : '<span class="cat-last-user" style="color:var(--text-faint);">Henuz mesaj yok</span>'}
              </div>
              <div class="cat-stats">
                <span>${(cat.thread_count || 0).toLocaleString("tr-TR")}</span>
                <span class="stat-dot"></span>
                <span>${(cat.reply_count || 0).toLocaleString("tr-TR")}</span>
              </div>
            </div>`;
        });

        html += "</div></div>";
      });
      container.innerHTML = html;

    } catch (err) {
      console.error(err);
      container.innerHTML = '<div class="forum-empty"><p>Hata olustu.</p></div>';
    }
  },

  toggleGroup(el) {
    el.classList.toggle("collapsed");
    const body = el.nextElementSibling;
    if (body) body.classList.toggle("collapsed");
  },

  /* ── Load Category (Thread List) ── */
  async loadCategory() {
    const cat = this.categories.find(c => c.id === this.currentCategoryId);
    if (!cat && this.categories.length === 0) {
      // Categories might not be cached yet
      const { data } = await supabaseClient.from("forum_categories").select("*").eq("id", this.currentCategoryId).single();
      if (data) this.categories.push(data);
    }
    const catObj = this.categories.find(c => c.id === this.currentCategoryId);
    const catName = catObj?.name || "Kategori";

    // Find group
    const group = this.groups.find(g => g.id === catObj?.group_id);

    // Breadcrumb
    let bc = `<a onclick="Forum.navigate('home')">Forum</a><span class="sep">&gt;</span>`;
    if (group) bc += `<span>${esc(group.name)}</span><span class="sep">&gt;</span>`;
    bc += `<span>${esc(catName)}</span>`;
    if (this.currentSubcategoryId) {
      const sub = this.subcategories.find(s => s.id === this.currentSubcategoryId);
      if (sub) bc += `<span class="sep">&gt;</span><span>${esc(sub.name)}</span>`;
    }
    $("categoryBreadcrumb").innerHTML = bc;
    $("categoryViewTitle").textContent = catName;

    // Load threads
    const container = $("threadListContent");
    container.innerHTML = '<div class="forum-loading"><div class="spinner"></div>Yukleniyor...</div>';

    try {
      let query = supabaseClient
        .from("forum_threads")
        .select("*, profiles!forum_threads_user_id_fkey(full_name, email, role)")
        .eq("category_id", this.currentCategoryId);

      if (this.currentSubcategoryId) {
        query = query.eq("subcategory_id", this.currentSubcategoryId);
      }

      // Pinned first, then by date
      query = query
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .range(this.threadPage * this.threadPageSize, (this.threadPage + 1) * this.threadPageSize - 1);

      const { data, error, count } = await query;

      if (error) {
        container.innerHTML = '<div class="forum-empty"><p>Hata olustu.</p></div>';
        console.error(error);
        return;
      }

      if (!data || data.length === 0) {
        if (this.threadPage > 0) {
          this.threadPage--;
          return this.loadCategory();
        }
        container.innerHTML = '<div class="forum-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>Bu kategoride henuz konu yok.</p></div>';
        $("threadPagination").innerHTML = "";
        return;
      }

      let html = "";
      let hasPinned = false;

      data.forEach(t => {
        if (t.is_pinned && !hasPinned) {
          html += '<div class="pinned-label">Sabitlenmis Konular</div>';
          hasPinned = true;
        }
        if (!t.is_pinned && hasPinned) {
          hasPinned = false; // Reset after pinned section
        }

        const authorName = t.profiles?.full_name || t.profiles?.email?.split("@")[0] || "Anonim";
        const initial = (authorName || "A")[0].toUpperCase();

        html += `
          <div class="thread-row${t.is_pinned ? ' pinned' : ''}" onclick="Forum.navigate('thread', {threadId:'${t.id}'})">
            <div class="thread-info">
              <div class="recent-avatar">
                <div class="avatar" style="width:32px;height:32px;font-size:12px;">${esc(initial)}</div>
              </div>
              <div style="min-width:0;">
                <div class="thread-title-text">
                  <span class="thread-meta-icons" style="display:inline;">
                    ${t.is_pinned ? '<span class="icon-pin">&#128204;</span> ' : ""}
                    ${t.is_locked ? '<span class="icon-lock">&#128274;</span> ' : ""}
                  </span>
                  ${esc(t.title)}
                </div>
                <div class="thread-author">${esc(authorName)} &middot; ${timeAgo(t.created_at)}</div>
              </div>
            </div>
            <div class="thread-replies-count">${t.reply_count || 0}</div>
            <div class="thread-views-count">${t.view_count || 0}</div>
            <div class="thread-last-reply">${t.last_reply_user ? esc(t.last_reply_user) + "<br>" + timeAgo(t.last_reply_at) : "-"}</div>
          </div>`;
      });
      container.innerHTML = html;

      // Simple pagination
      this.renderPagination(data.length);

    } catch (err) {
      console.error(err);
      container.innerHTML = '<div class="forum-empty"><p>Hata olustu.</p></div>';
    }
  },

  renderPagination(count) {
    const pag = $("threadPagination");
    if (count < this.threadPageSize && this.threadPage === 0) {
      pag.innerHTML = "";
      return;
    }
    let html = "";
    if (this.threadPage > 0) {
      html += `<button class="page-btn" onclick="Forum.threadPage--;Forum.loadCategory();">&lt; Onceki</button>`;
    }
    html += `<span class="page-btn is-active">${this.threadPage + 1}</span>`;
    if (count >= this.threadPageSize) {
      html += `<button class="page-btn" onclick="Forum.threadPage++;Forum.loadCategory();">Sonraki &gt;</button>`;
    }
    pag.innerHTML = html;
  },

  /* ── Load Thread Detail ── */
  async loadThread() {
    const container = $("threadDetailArea");
    container.innerHTML = '<div class="forum-loading"><div class="spinner"></div>Yukleniyor...</div>';

    try {
      // Fetch thread
      const { data: thread, error: tErr } = await supabaseClient
        .from("forum_threads")
        .select("*, profiles!forum_threads_user_id_fkey(id, full_name, email, role, created_at), forum_categories!inner(id, name, group_id)")
        .eq("id", this.currentThreadId)
        .single();

      if (tErr || !thread) {
        container.innerHTML = '<div class="forum-empty"><p>Konu bulunamadi.</p></div>';
        return;
      }

      // Increment view count via RPC
      supabaseClient.rpc("forum_increment_view", { p_thread_id: thread.id }).then();

      // Fetch replies
      const { data: replies, error: rErr } = await supabaseClient
        .from("forum_replies")
        .select("*, profiles!forum_replies_user_id_fkey(id, full_name, email, role, created_at)")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });

      // Check if user liked this thread + batch-fetch reply likes
      let userLikedThread = false;
      let userLikedReplies = new Set();
      if (AuthService.currentUser) {
        const [threadLikeRes, replyLikesRes] = await Promise.all([
          supabaseClient.from("forum_likes").select("id").eq("user_id", AuthService.currentUser.id).eq("thread_id", thread.id).maybeSingle(),
          supabaseClient.from("forum_likes").select("reply_id").eq("user_id", AuthService.currentUser.id).not("reply_id", "is", null)
        ]);
        userLikedThread = !!threadLikeRes.data;
        userLikedReplies = new Set((replyLikesRes.data || []).map(l => l.reply_id));
      }

      // Breadcrumb
      const group = this.groups.find(g => g.id === thread.forum_categories?.group_id);
      let bc = `<a onclick="Forum.navigate('home')">Forum</a><span class="sep">&gt;</span>`;
      if (group) bc += `<span>${esc(group.name)}</span><span class="sep">&gt;</span>`;
      bc += `<a onclick="Forum.navigate('category', {categoryId:'${thread.category_id}'})">${esc(thread.forum_categories?.name || "")}</a>`;
      bc += `<span class="sep">&gt;</span><span>${esc(thread.title)}</span>`;
      $("threadBreadcrumb").innerHTML = bc;

      // Author info
      const author = thread.profiles;
      const authorName = author?.full_name || author?.email?.split("@")[0] || "Anonim";
      const authorInitial = (authorName || "A")[0].toUpperCase();
      const authorRole = author?.role || "user";
      const roleBadgeClass = authorRole === "admin" ? "admin" : authorRole === "moderator" ? "moderator" : "user";
      const roleBadgeText = authorRole === "admin" ? "Admin" : authorRole === "moderator" ? "Moderator" : "Kullanici";

      // Count author stats
      let authorThreadCount = 0, authorReplyCount = 0;
      if (author?.id) {
        const [tc, rc] = await Promise.all([
          supabaseClient.from("forum_threads").select("id", { count: "exact", head: true }).eq("user_id", author.id),
          supabaseClient.from("forum_replies").select("id", { count: "exact", head: true }).eq("user_id", author.id)
        ]);
        authorThreadCount = tc.count || 0;
        authorReplyCount = rc.count || 0;
      }

      // Mod actions
      const canMod = AuthService.isModOrAdmin();
      const isOwner = AuthService.currentUser?.id === thread.user_id;

      let modHtml = "";
      if (canMod || isOwner) {
        modHtml = `<div class="thread-mod-actions">`;
        if (canMod) {
          modHtml += `<button class="${thread.is_pinned ? 'active' : ''}" onclick="Forum.togglePin('${thread.id}', ${!thread.is_pinned})" title="Sabitle/Kaldir">&#128204; ${thread.is_pinned ? "Sabit" : "Sabitle"}</button>`;
          modHtml += `<button class="${thread.is_locked ? 'active' : ''}" onclick="Forum.toggleLock('${thread.id}', ${!thread.is_locked})" title="Kilitle/Ac">&#128274; ${thread.is_locked ? "Kilitli" : "Kilitle"}</button>`;
        }
        if (canMod || isOwner) {
          modHtml += `<button class="danger" onclick="Forum.deleteThread('${thread.id}')">&#128465; Sil</button>`;
        }
        modHtml += `</div>`;
      }

      // Tags
      let tagsHtml = "";
      if (thread.tags && thread.tags.length > 0) {
        tagsHtml = `<div class="thread-tags">${thread.tags.map(t => `<span class="thread-tag">#${esc(t)}</span>`).join("")}</div>`;
      }

      // Build HTML
      let html = `
        <div class="thread-head-card">
          <div class="thread-head-top">
            <span class="thread-head-title">
              ${thread.is_pinned ? '&#128204; ' : ''}${thread.is_locked ? '&#128274; ' : ''}${esc(thread.title)}
            </span>
            ${modHtml}
          </div>
          <div class="thread-head-body">
            <div class="thread-author-card">
              <div class="thread-author-avatar" onclick="Forum.showProfile('${author?.id}')">${esc(authorInitial)}</div>
              <div class="thread-author-name">${esc(authorName)}</div>
              <div class="role-badge ${roleBadgeClass}">${roleBadgeText}</div>
              <div class="thread-author-stats">
                Kayit: ${author?.created_at ? new Date(author.created_at).toLocaleDateString("tr-TR") : "-"}<br>
                ${authorThreadCount || 0} konu &middot; ${authorReplyCount || 0} mesaj
              </div>
            </div>
            <div class="thread-content-area">
              <div class="thread-content-text">${renderContent(thread.content)}</div>
              ${tagsHtml}
              <div class="thread-footer-bar">
                <button class="like-btn${userLikedThread ? ' liked' : ''}" onclick="Forum.toggleThreadLike('${thread.id}')">
                  <svg viewBox="0 0 24 24" fill="${userLikedThread ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  ${thread.like_count || 0}
                </button>
                <span>&#128065; ${thread.view_count || 0} goruntulenme</span>
                <span>${formatDate(thread.created_at)}</span>
              </div>
            </div>
          </div>
        </div>`;

      // Replies
      const allReplies = replies || [];
      const topReplies = allReplies.filter(r => !r.parent_id);

      html += `<div class="replies-section">
        <div class="replies-header"><h3>${allReplies.length} Cevap</h3></div>`;

      for (const reply of topReplies) {
        html += this.renderReply(reply, allReplies, userLikedReplies);
      }

      // Reply compose
      if (!thread.is_locked && AuthService.currentUser) {
        html += `
          <div class="reply-compose">
            <h4>Cevap Yaz</h4>
            ${ForumEditor.buildToolbar('replyInput')}
            <textarea id="replyInput" placeholder="Cevabinizi yazin... BBCode desteklenir: [b]kalin[/b] [i]italik[/i] [img]url[/img]"></textarea>
            <div class="reply-compose-footer">
              <button class="btn-primary" onclick="Forum.submitReply('${thread.id}')">Gonder</button>
            </div>
          </div>`;
      } else if (thread.is_locked) {
        html += `<div class="thread-locked-msg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Bu konu kilitlenmistir. Yeni cevap yazilamaz.
        </div>`;
      } else if (!AuthService.currentUser) {
        html += `<div class="thread-locked-msg">Cevap yazmak icin <a href="#" onclick="ForumModals.open('loginModal');return false;" style="color:var(--brand);font-weight:700;">giris yapin</a>.</div>`;
      }

      html += "</div>";
      container.innerHTML = html;

    } catch (err) {
      console.error(err);
      container.innerHTML = '<div class="forum-empty"><p>Hata olustu.</p></div>';
    }
  },

  renderReply(reply, allReplies, userLikedReplies) {
    const author = reply.profiles;
    const authorName = author?.full_name || author?.email?.split("@")[0] || "Anonim";
    const initial = (authorName || "A")[0].toUpperCase();
    const role = author?.role || "user";
    const roleBadgeClass = role === "admin" ? "admin" : role === "moderator" ? "moderator" : "user";
    const roleBadgeText = role === "admin" ? "Admin" : role === "moderator" ? "Moderator" : "Kullanici";
    const isNested = !!reply.parent_id;
    const canDelete = AuthService.isModOrAdmin() || AuthService.currentUser?.id === reply.user_id;

    const userLiked = userLikedReplies.has(reply.id);

    let html = `
      <div class="reply-card${isNested ? ' nested' : ''}">
        <div class="reply-card-body">
          <div class="reply-author-area">
            <div class="reply-avatar" onclick="Forum.showProfile('${author?.id}')">${esc(initial)}</div>
            <div class="reply-author-name">${esc(authorName)}</div>
            <div class="role-badge ${roleBadgeClass}" style="font-size:9px;padding:1px 6px;">${roleBadgeText}</div>
          </div>
          <div class="reply-content-area">
            <div class="reply-content-text">${renderContent(reply.content)}</div>
            <div class="reply-footer">
              <span>${timeAgo(reply.created_at)}</span>
              <button class="${userLiked ? 'liked' : ''}" onclick="Forum.toggleReplyLike('${reply.id}')">
                <svg viewBox="0 0 24 24" fill="${userLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                ${reply.like_count || 0}
              </button>
              ${!isNested && AuthService.currentUser ? `<button onclick="Forum.showReplyBox('${reply.id}')">Cevapla</button>` : ""}
              ${canDelete ? `<button onclick="Forum.deleteReply('${reply.id}')">Sil</button>` : ""}
            </div>
            <div id="replyBox-${reply.id}" style="display:none;margin-top:10px;">
              ${ForumEditor.buildToolbar('replyInput-' + reply.id)}
              <textarea id="replyInput-${reply.id}" placeholder="Cevabinizi yazin..." style="min-height:80px;"></textarea>
              <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;">
                <button class="btn-secondary" onclick="document.getElementById('replyBox-${reply.id}').style.display='none';" style="padding:6px 12px;font-size:12px;">Iptal</button>
                <button class="btn-primary" onclick="Forum.submitReply('${this.currentThreadId}', '${reply.id}')" style="padding:6px 12px;font-size:12px;">Gonder</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    // Render child replies
    const children = allReplies.filter(r => r.parent_id === reply.id);
    for (const child of children) {
      html += this.renderReply(child, allReplies, userLikedReplies);
    }

    return html;
  },

  showReplyBox(replyId) {
    if (!AuthService.currentUser) { ForumModals.open("loginModal"); return; }
    const box = $(`replyBox-${replyId}`);
    if (box) box.style.display = box.style.display === "none" ? "block" : "none";
  },

  /* ── Thread Actions ── */
  async submitReply(threadId, parentId) {
    if (!AuthService.currentUser) { ForumModals.open("loginModal"); return; }

    const inputId = parentId ? `replyInput-${parentId}` : "replyInput";
    const input = $(inputId);
    const content = input?.value?.trim();
    if (!content) { toast("Cevap bos olamaz."); return; }

    try {
      const { data, error } = await supabaseClient
        .from("forum_replies")
        .insert({
          thread_id: threadId,
          user_id: AuthService.currentUser.id,
          content: content,
          parent_id: parentId || null
        })
        .select()
        .single();

      if (error) { toast("Cevap gonderilirken hata olustu."); console.error(error); return; }

      // Update counters via RPC (atomic, secure)
      const userName = AuthService.currentUser.name;
      const { data: threadData } = await supabaseClient.from("forum_threads").select("category_id, user_id, title").eq("id", threadId).single();

      await supabaseClient.rpc("forum_on_reply", { p_thread_id: threadId, p_user_name: userName });

      if (threadData) {
        await supabaseClient.rpc("forum_on_category_reply", { p_category_id: threadData.category_id, p_user_name: userName });

        // Create notification for thread owner
        if (threadData.user_id !== AuthService.currentUser.id) {
          await supabaseClient.from("forum_notifications").insert({
            user_id: threadData.user_id, type: "reply",
            from_user_id: AuthService.currentUser.id, from_user_name: userName,
            thread_id: threadId, thread_title: threadData.title || "", reply_id: data.id
          });
        }

        // If replying to another reply, notify that reply's author
        if (parentId) {
          const { data: parentReply } = await supabaseClient.from("forum_replies").select("user_id").eq("id", parentId).single();
          if (parentReply && parentReply.user_id !== AuthService.currentUser.id) {
            await supabaseClient.from("forum_notifications").insert({
              user_id: parentReply.user_id, type: "reply",
              from_user_id: AuthService.currentUser.id, from_user_name: userName,
              thread_id: threadId, thread_title: threadData.title || "", reply_id: data.id
            });
          }
        }
      }

      toast("Cevap gonderildi!");
      this.loadThread();
    } catch (err) {
      console.error(err);
      toast("Hata olustu.");
    }
  },

  async togglePin(threadId, pin) {
    try {
      await supabaseClient.from("forum_threads").update({ is_pinned: pin }).eq("id", threadId);
      toast(pin ? "Konu sabitlendi." : "Sabitleme kaldirildi.");
      this.loadThread();
    } catch (err) { console.error(err); }
  },

  async toggleLock(threadId, lock) {
    try {
      await supabaseClient.from("forum_threads").update({ is_locked: lock }).eq("id", threadId);
      toast(lock ? "Konu kilitlendi." : "Kilit acildi.");
      this.loadThread();
    } catch (err) { console.error(err); }
  },

  async deleteThread(threadId) {
    if (!confirm("Bu konuyu silmek istediginize emin misiniz?")) return;
    try {
      // Get thread info for cache update
      const { data: thread } = await supabaseClient.from("forum_threads").select("category_id, reply_count").eq("id", threadId).single();

      await supabaseClient.from("forum_threads").delete().eq("id", threadId);

      // Update category counts via RPC
      if (thread) {
        await supabaseClient.rpc("forum_on_thread_delete", { p_category_id: thread.category_id, p_reply_count: thread.reply_count || 0 });
      }

      toast("Konu silindi.");
      this.navigate("home");
    } catch (err) { console.error(err); toast("Silme hatasi."); }
  },

  async deleteReply(replyId) {
    if (!confirm("Bu cevabi silmek istediginize emin misiniz?")) return;
    try {
      // Get reply info
      const { data: reply } = await supabaseClient.from("forum_replies").select("thread_id").eq("id", replyId).single();

      await supabaseClient.from("forum_replies").delete().eq("id", replyId);

      // Update counts via RPC
      if (reply) {
        const { data: tData } = await supabaseClient.from("forum_threads").select("category_id").eq("id", reply.thread_id).single();
        await supabaseClient.rpc("forum_on_reply_delete", { p_thread_id: reply.thread_id });
        if (tData) {
          await supabaseClient.rpc("forum_on_cat_reply_delete", { p_category_id: tData.category_id });
        }
      }

      toast("Cevap silindi.");
      this.loadThread();
    } catch (err) { console.error(err); toast("Silme hatasi."); }
  },

  /* ── Likes ── */
  async toggleThreadLike(threadId) {
    if (!AuthService.currentUser) { ForumModals.open("loginModal"); return; }
    try {
      const { data: existing } = await supabaseClient
        .from("forum_likes")
        .select("id")
        .eq("user_id", AuthService.currentUser.id)
        .eq("thread_id", threadId)
        .maybeSingle();

      if (existing) {
        await supabaseClient.from("forum_likes").delete().eq("id", existing.id);
        await supabaseClient.rpc("forum_update_thread_likes", { p_thread_id: threadId, p_delta: -1 });
      } else {
        await supabaseClient.from("forum_likes").insert({ user_id: AuthService.currentUser.id, thread_id: threadId });
        await supabaseClient.rpc("forum_update_thread_likes", { p_thread_id: threadId, p_delta: 1 });

        // Notification
        const { data: t } = await supabaseClient.from("forum_threads").select("user_id, title").eq("id", threadId).single();
        if (t && t.user_id !== AuthService.currentUser.id) {
          await supabaseClient.from("forum_notifications").insert({
            user_id: t.user_id, type: "like",
            from_user_id: AuthService.currentUser.id,
            from_user_name: AuthService.currentUser.name,
            thread_id: threadId, thread_title: t.title
          });
        }
      }
      this.loadThread();
    } catch (err) { console.error(err); }
  },

  async toggleReplyLike(replyId) {
    if (!AuthService.currentUser) { ForumModals.open("loginModal"); return; }
    try {
      const { data: existing } = await supabaseClient
        .from("forum_likes")
        .select("id")
        .eq("user_id", AuthService.currentUser.id)
        .eq("reply_id", replyId)
        .maybeSingle();

      if (existing) {
        await supabaseClient.from("forum_likes").delete().eq("id", existing.id);
        await supabaseClient.rpc("forum_update_reply_likes", { p_reply_id: replyId, p_delta: -1 });
      } else {
        await supabaseClient.from("forum_likes").insert({ user_id: AuthService.currentUser.id, reply_id: replyId });
        await supabaseClient.rpc("forum_update_reply_likes", { p_reply_id: replyId, p_delta: 1 });

        // Notification
        const { data: r } = await supabaseClient.from("forum_replies").select("user_id, thread_id").eq("id", replyId).single();
        if (r && r.user_id !== AuthService.currentUser.id) {
          const { data: tInfo } = await supabaseClient.from("forum_threads").select("title").eq("id", r.thread_id).single();
          await supabaseClient.from("forum_notifications").insert({
            user_id: r.user_id, type: "like",
            from_user_id: AuthService.currentUser.id,
            from_user_name: AuthService.currentUser.name,
            thread_id: r.thread_id, thread_title: tInfo?.title || "",
            reply_id: replyId
          });
        }
      }
      this.loadThread();
    } catch (err) { console.error(err); }
  },

  /* ── New Thread ── */
  async openNewThreadModal(categoryId) {
    if (!AuthService.currentUser) { ForumModals.open("loginModal"); return; }

    // Populate category select
    const select = $("threadCategorySelect");
    select.innerHTML = '<option value="">Kategori sec...</option>';
    const cats = this.categories.length > 0 ? this.categories : (await supabaseClient.from("forum_categories").select("*").order("sort_order")).data || [];
    cats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      if (categoryId === c.id) opt.selected = true;
      select.appendChild(opt);
    });

    // Reset subcategory
    $("threadSubcategorySelect").innerHTML = '<option value="">Yok</option>';
    if (categoryId) this.updateSubcategorySelect(categoryId);

    $("threadTitleInput").value = "";
    $("threadContentInput").value = "";
    $("threadTagsInput").value = "";

    // Inject toolbar for thread content
    const toolbarContainer = $("threadContentToolbar");
    if (toolbarContainer) toolbarContainer.innerHTML = ForumEditor.buildToolbar("threadContentInput");

    ForumModals.open("newThreadModal");
  },

  updateSubcategorySelect(categoryId) {
    const select = $("threadSubcategorySelect");
    select.innerHTML = '<option value="">Yok</option>';
    const subs = this.subcategories.filter(s => s.category_id === categoryId);
    subs.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      select.appendChild(opt);
    });
  },

  async submitNewThread() {
    if (!AuthService.currentUser) return;

    const categoryId = $("threadCategorySelect").value;
    const subcategoryId = $("threadSubcategorySelect").value || null;
    const title = $("threadTitleInput").value.trim();
    const content = $("threadContentInput").value.trim();
    const tagsRaw = $("threadTagsInput").value.trim();

    if (!categoryId) { toast("Kategori secin."); return; }
    if (!title) { toast("Baslik bos olamaz."); return; }
    if (!content) { toast("Icerik bos olamaz."); return; }

    const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(t => t) : [];

    const btn = $("threadSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Gonderiliyor...";

    try {
      const { data, error } = await supabaseClient
        .from("forum_threads")
        .insert({
          category_id: categoryId,
          subcategory_id: subcategoryId,
          user_id: AuthService.currentUser.id,
          title, content, tags
        })
        .select()
        .single();

      if (error) { toast("Konu olusturulurken hata: " + error.message); console.error(error); return; }

      // Update category stats via RPC
      await supabaseClient.rpc("forum_on_new_thread", {
        p_category_id: categoryId, p_thread_id: data.id,
        p_title: title, p_user_name: AuthService.currentUser.name
      });

      // Update subcategory count via RPC
      if (subcategoryId) {
        await supabaseClient.rpc("forum_inc_sub_threads", { p_sub_id: subcategoryId });
      }

      ForumModals.close();
      toast("Konu olusturuldu!");
      this.navigate("thread", { threadId: data.id });

    } catch (err) {
      console.error(err);
      toast("Hata olustu.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Konuyu Ac";
    }
  },

  /* ── Search ── */
  async performSearch(query) {
    this.searchQuery = query;
    this.recentPage = 0;
    if (document.querySelector("#viewHome.is-active")) {
      await this.loadRecentThreads();
    }
  },

  /* ── Profile Popover ── */
  async showProfile(userId) {
    if (!userId) return;
    try {
      const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", userId).single();
      if (!profile) return;

      const { count: threadCount } = await supabaseClient.from("forum_threads").select("id", { count: "exact", head: true }).eq("user_id", userId);
      const { count: replyCount } = await supabaseClient.from("forum_replies").select("id", { count: "exact", head: true }).eq("user_id", userId);

      const name = profile.full_name || profile.email?.split("@")[0] || "Anonim";
      const role = profile.role || "user";

      $("popoverAvatar").textContent = (name || "A")[0].toUpperCase();
      $("popoverName").textContent = name;
      $("popoverRole").textContent = role === "admin" ? "Admin" : role === "moderator" ? "Moderator" : "Kullanici";
      $("popoverRole").className = `role-badge ${role === "admin" ? "admin" : role === "moderator" ? "moderator" : "user"}`;
      $("popoverThreads").textContent = threadCount || 0;
      $("popoverReplies").textContent = replyCount || 0;

      const pop = $("profilePopover");
      pop.style.top = "50%";
      pop.style.left = "50%";
      pop.style.transform = "translate(-50%, -50%)";
      pop.classList.add("is-open");

    } catch (err) { console.error(err); }
  }
};

/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════════════ */
const Notifications = {
  async load() {
    if (!AuthService.currentUser) return;
    try {
      const { data, error } = await supabaseClient
        .from("forum_notifications")
        .select("*")
        .eq("user_id", AuthService.currentUser.id)
        .order("created_at", { ascending: false })
        .limit(15);

      if (error) { console.error(error); return; }

      const unread = (data || []).filter(n => !n.is_read).length;
      const badge = $("notifCount");
      if (unread > 0) {
        badge.textContent = unread;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }

      const list = $("notifList");
      if (!data || data.length === 0) {
        list.innerHTML = '<div class="notif-empty">Bildirim yok</div>';
        return;
      }

      list.innerHTML = data.map(n => {
        const icon = n.type === "like" ? "&#10084;" : "&#128172;";
        const text = n.type === "like"
          ? `<strong>${esc(n.from_user_name)}</strong> konunuzu begendi: "${esc(n.thread_title)}"`
          : `<strong>${esc(n.from_user_name)}</strong> konunuza cevap yazdi: "${esc(n.thread_title)}"`;

        return `<div class="notif-item${n.is_read ? '' : ' unread'}" onclick="Notifications.clickNotif('${n.id}', '${n.thread_id}')">
          <div class="notif-icon">${icon}</div>
          <div>
            <div class="notif-text">${text}</div>
            <div class="notif-time">${timeAgo(n.created_at)}</div>
          </div>
        </div>`;
      }).join("");
    } catch (err) { console.error(err); }
  },

  async clickNotif(notifId, threadId) {
    // Mark as read
    await supabaseClient.from("forum_notifications").update({ is_read: true }).eq("id", notifId);
    $("notifDropdown").classList.remove("is-open");
    Forum.navigate("thread", { threadId });
    this.load();
  },

  async readAll() {
    if (!AuthService.currentUser) return;
    await supabaseClient.from("forum_notifications").update({ is_read: true }).eq("user_id", AuthService.currentUser.id).eq("is_read", false);
    toast("Tum bildirimler okundu.");
    this.load();
  },

  _pollInterval: null,
  startPolling() {
    if (this._pollInterval) clearInterval(this._pollInterval);
    this._pollInterval = setInterval(() => this.load(), 30000);
  }
};

/* ═══════════════════════════════════════════════════════════
   ADMIN PANEL
   ═══════════════════════════════════════════════════════════ */
const AdminPanel = {
  currentTab: "groups",
  editingId: null,
  editingType: null,

  load(tab) {
    this.currentTab = tab || "groups";
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.toggle("is-active", t.dataset.adminTab === this.currentTab));

    if (this.currentTab === "groups") this.loadGroups();
    else if (this.currentTab === "categories") this.loadCategories();
    else if (this.currentTab === "users") this.loadUsers();
  },

  async loadGroups() {
    const c = $("adminContent");
    const { data: groups } = await supabaseClient.from("forum_category_groups").select("*").order("sort_order");

    let html = `
      <div class="admin-section-header">
        <h3>Kategori Gruplari</h3>
      </div>
      <div class="admin-add-form">
        <input type="text" id="addGroupName" placeholder="Yeni grup adi...">
        <button class="btn-primary" onclick="AdminPanel.addGroup()">Ekle</button>
      </div>`;

    if (groups && groups.length > 0) {
      groups.forEach((g, i) => {
        html += `
          <div class="admin-item">
            <span class="admin-item-name">${esc(g.name)}</span>
            <div class="admin-item-actions">
              <button onclick="AdminPanel.editItem('group', '${g.id}', '${escAttr(g.name)}')">Duzenle</button>
              ${i > 0 ? `<button onclick="AdminPanel.moveGroup('${g.id}', ${g.sort_order - 1})">&#9650;</button>` : ""}
              ${i < groups.length - 1 ? `<button onclick="AdminPanel.moveGroup('${g.id}', ${g.sort_order + 1})">&#9660;</button>` : ""}
              <button class="danger" onclick="AdminPanel.deleteGroup('${g.id}')">Sil</button>
            </div>
          </div>`;
      });
    } else {
      html += '<div class="forum-empty"><p>Henuz grup yok.</p></div>';
    }
    c.innerHTML = html;
  },

  async addGroup() {
    if (!AuthService.isAdmin()) { toast("Yetkiniz yok."); return; }
    const name = $("addGroupName")?.value?.trim();
    if (!name) { toast("Grup adi bos olamaz."); return; }

    const { data: existing } = await supabaseClient.from("forum_category_groups").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    const maxOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { error } = await supabaseClient.from("forum_category_groups").insert({ name, sort_order: maxOrder });
    if (error) { toast("Hata: " + error.message); return; }
    toast("Grup eklendi.");
    this.loadGroups();
  },

  async moveGroup(id, newOrder) {
    await supabaseClient.from("forum_category_groups").update({ sort_order: newOrder }).eq("id", id);
    this.loadGroups();
  },

  async deleteGroup(id) {
    if (!confirm("Bu grubu ve icindeki tum kategorileri silmek istediginize emin misiniz?")) return;
    await supabaseClient.from("forum_category_groups").delete().eq("id", id);
    toast("Grup silindi.");
    this.loadGroups();
    Forum.loadCategoryGroups();
  },

  async loadCategories() {
    const c = $("adminContent");

    const { data: groups } = await supabaseClient.from("forum_category_groups").select("*").order("sort_order");
    const { data: cats } = await supabaseClient.from("forum_categories").select("*").order("sort_order");
    const { data: subs } = await supabaseClient.from("forum_subcategories").select("*").order("sort_order");

    let html = `
      <div class="admin-section-header">
        <h3>Kategoriler</h3>
      </div>
      <div class="admin-add-form" style="flex-wrap:wrap;">
        <select id="addCatGroup" style="min-width:150px;">
          <option value="">Grup sec...</option>
          ${(groups || []).map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}
        </select>
        <input type="text" id="addCatName" placeholder="Kategori adi...">
        <input type="text" id="addCatDesc" placeholder="Aciklama...">
        <input type="text" id="addCatIcon" placeholder="Ikon (emoji)" style="max-width:80px;">
        <button class="btn-primary" onclick="AdminPanel.addCategory()">Ekle</button>
      </div>`;

    if (groups && groups.length > 0) {
      groups.forEach(g => {
        const gCats = (cats || []).filter(c => c.group_id === g.id);
        html += `<div style="margin-bottom:16px;"><strong style="color:var(--brand);">${esc(g.name)}</strong></div>`;

        gCats.forEach(cat => {
          const catSubs = (subs || []).filter(s => s.category_id === cat.id);
          html += `
            <div class="admin-item">
              <span class="admin-item-name">${cat.icon || "&#128172;"} ${esc(cat.name)}</span>
              <div class="admin-item-actions">
                <button onclick="AdminPanel.editItem('category', '${cat.id}', '${escAttr(cat.name)}', '${escAttr(cat.description || '')}', '${escAttr(cat.icon || '')}')">Duzenle</button>
                <button class="danger" onclick="AdminPanel.deleteCategory('${cat.id}')">Sil</button>
              </div>
            </div>`;

          // Subcategories
          if (catSubs.length > 0) {
            html += '<div class="admin-sublist">';
            catSubs.forEach(s => {
              html += `<div class="admin-item">
                <span class="admin-item-name">\u{1F4C1} ${esc(s.name)}</span>
                <div class="admin-item-actions">
                  <button onclick="AdminPanel.editItem('subcategory', '${s.id}', '${escAttr(s.name)}')">Duzenle</button>
                  <button class="danger" onclick="AdminPanel.deleteSubcategory('${s.id}')">Sil</button>
                </div>
              </div>`;
            });
            html += '</div>';
          }

          // Add subcategory form
          html += `<div class="admin-add-form" style="margin-left:32px;margin-bottom:12px;">
            <input type="text" id="addSub-${cat.id}" placeholder="Alt kategori adi...">
            <button class="btn-primary" style="padding:8px 14px;font-size:12px;" onclick="AdminPanel.addSubcategory('${cat.id}')">Alt Kat. Ekle</button>
          </div>`;
        });
      });
    }
    c.innerHTML = html;
  },

  async addCategory() {
    if (!AuthService.isAdmin()) { toast("Yetkiniz yok."); return; }
    const groupId = $("addCatGroup")?.value;
    const name = $("addCatName")?.value?.trim();
    const desc = $("addCatDesc")?.value?.trim();
    const icon = $("addCatIcon")?.value?.trim() || "&#128172;";
    if (!groupId) { toast("Grup secin."); return; }
    if (!name) { toast("Kategori adi bos olamaz."); return; }

    const { data: existing } = await supabaseClient.from("forum_categories").select("sort_order").eq("group_id", groupId).order("sort_order", { ascending: false }).limit(1);
    const maxOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { error } = await supabaseClient.from("forum_categories").insert({ group_id: groupId, name, description: desc, icon, sort_order: maxOrder });
    if (error) { toast("Hata: " + error.message); return; }
    toast("Kategori eklendi.");
    this.loadCategories();
    Forum.loadCategoryGroups();
  },

  async deleteCategory(id) {
    if (!confirm("Bu kategoriyi ve icindeki tum konulari silmek istediginize emin misiniz?")) return;
    await supabaseClient.from("forum_categories").delete().eq("id", id);
    toast("Kategori silindi.");
    this.loadCategories();
    Forum.loadCategoryGroups();
  },

  async addSubcategory(categoryId) {
    if (!AuthService.isAdmin()) { toast("Yetkiniz yok."); return; }
    const input = $(`addSub-${categoryId}`);
    const name = input?.value?.trim();
    if (!name) { toast("Alt kategori adi bos olamaz."); return; }

    const { error } = await supabaseClient.from("forum_subcategories").insert({ category_id: categoryId, name });
    if (error) { toast("Hata: " + error.message); return; }
    toast("Alt kategori eklendi.");
    this.loadCategories();
    Forum.loadCategoryGroups();
  },

  async deleteSubcategory(id) {
    if (!confirm("Bu alt kategoriyi silmek istediginize emin misiniz?")) return;
    await supabaseClient.from("forum_subcategories").delete().eq("id", id);
    toast("Alt kategori silindi.");
    this.loadCategories();
    Forum.loadCategoryGroups();
  },

  /* ── Users Management ── */
  async loadUsers() {
    if (!AuthService.isAdmin()) { $("adminContent").innerHTML = '<div class="forum-empty"><p>Sadece adminler kullanici yonetebilir.</p></div>'; return; }

    const c = $("adminContent");
    c.innerHTML = '<div class="forum-loading"><div class="spinner"></div>Yukleniyor...</div>';

    const { data: users, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) { c.innerHTML = '<div class="forum-empty"><p>Hata olustu.</p></div>'; return; }

    let html = `
      <div class="admin-section-header">
        <h3>Kullanicilar</h3>
      </div>
      <div class="admin-add-form">
        <input type="text" id="userSearchInput" placeholder="E-posta veya isim ile ara..." oninput="AdminPanel.filterUsers(this.value)">
      </div>
      <div id="usersListAdmin">`;

    (users || []).forEach(u => {
      const name = u.full_name || u.email?.split("@")[0] || "Anonim";
      const role = u.role || "user";
      html += `
        <div class="admin-item" data-email="${(u.email || '').toLowerCase()}" data-name="${name.toLowerCase()}">
          <div style="flex:1;">
            <span class="admin-item-name">${esc(name)}</span>
            <div style="font-size:12px;color:var(--text-muted);">${esc(u.email || "")}</div>
          </div>
          <div class="admin-item-actions">
            <select onchange="AdminPanel.changeRole('${u.id}', this.value)">
              <option value="user"${role === "user" ? " selected" : ""}>Kullanici</option>
              <option value="moderator"${role === "moderator" ? " selected" : ""}>Moderator</option>
              <option value="admin"${role === "admin" ? " selected" : ""}>Admin</option>
            </select>
          </div>
        </div>`;
    });

    html += '</div>';
    c.innerHTML = html;
  },

  filterUsers(query) {
    const q = query.toLowerCase();
    document.querySelectorAll("#usersListAdmin .admin-item").forEach(el => {
      const email = el.dataset.email || "";
      const name = el.dataset.name || "";
      el.style.display = (email.includes(q) || name.includes(q)) ? "flex" : "none";
    });
  },

  async changeRole(userId, newRole) {
    if (!AuthService.isAdmin()) { toast("Yetkiniz yok."); return; }
    if (userId === AuthService.currentUser.id) { toast("Kendi rolunuzu degistiremezsiniz."); return; }

    const { error } = await supabaseClient.from("profiles").update({ role: newRole }).eq("id", userId);
    if (error) { toast("Hata: " + error.message); return; }
    toast("Rol guncellendi: " + newRole);
  },

  /* ── Edit Item ── */
  editItem(type, id, name, desc, icon) {
    this.editingId = id;
    this.editingType = type;

    $("adminEditTitle").textContent = type === "group" ? "Grubu Duzenle" : type === "category" ? "Kategoriyi Duzenle" : "Alt Kategoriyi Duzenle";
    $("adminEditLabel1").textContent = "Ad";
    $("adminEditInput1").value = name || "";

    if (type === "category") {
      $("adminEditField2").style.display = "block";
      $("adminEditLabel2").textContent = "Aciklama";
      $("adminEditInput2").value = desc || "";
      $("adminEditField3").style.display = "block";
      $("adminEditLabel3").textContent = "Ikon (emoji)";
      $("adminEditInput3").value = icon || "";
    } else {
      $("adminEditField2").style.display = "none";
      $("adminEditField3").style.display = "none";
    }

    ForumModals.open("adminEditModal");
  },

  async saveEdit() {
    const name = $("adminEditInput1").value.trim();
    if (!name) { toast("Ad bos olamaz."); return; }

    try {
      if (this.editingType === "group") {
        await supabaseClient.from("forum_category_groups").update({ name }).eq("id", this.editingId);
      } else if (this.editingType === "category") {
        const desc = $("adminEditInput2").value.trim();
        const icon = $("adminEditInput3").value.trim();
        await supabaseClient.from("forum_categories").update({ name, description: desc, icon: icon || "&#128172;" }).eq("id", this.editingId);
      } else if (this.editingType === "subcategory") {
        await supabaseClient.from("forum_subcategories").update({ name }).eq("id", this.editingId);
      }
      ForumModals.close();
      toast("Guncellendi.");
      this.load(this.currentTab);
      Forum.loadCategoryGroups();
    } catch (err) {
      console.error(err);
      toast("Hata olustu.");
    }
  }
};

/* ═══════════════════════════════════════════════════════════
   WIRE EVENTS
   ═══════════════════════════════════════════════════════════ */
function wire() {
  // Theme
  $("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  });

  // Auth - Login
  $("loginBtn").addEventListener("click", () => ForumModals.open("loginModal"));
  $("registerBtn").addEventListener("click", () => ForumModals.open("registerModal"));

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("loginSubmitBtn");
    btn.disabled = true; btn.textContent = "Giris yapiliyor...";
    const ok = await AuthService.login($("loginEmail").value, $("loginPassword").value);
    if (ok) { ForumModals.close(); toast("Giris yapildi!"); Notifications.load(); Notifications.startPolling(); Forum.loadHome(); }
    btn.disabled = false; btn.textContent = "Giris Yap";
  });

  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("regSubmitBtn");
    btn.disabled = true; btn.textContent = "Hesap olusturuluyor...";
    const ok = await AuthService.register($("regName").value, $("regEmail").value, $("regPassword").value);
    if (ok) ForumModals.close();
    btn.disabled = false; btn.textContent = "Hesap Olustur";
  });

  // Switchers
  $("swToRegister")?.addEventListener("click", (e) => { e.preventDefault(); ForumModals.close(); setTimeout(() => ForumModals.open("registerModal"), 50); });
  $("swToLogin")?.addEventListener("click", (e) => { e.preventDefault(); ForumModals.close(); setTimeout(() => ForumModals.open("loginModal"), 50); });

  // Logout
  $("logoutBtn").addEventListener("click", () => AuthService.logout());

  // User dropdown
  $("userProfileBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    $("userDropdown")?.classList.toggle("is-open");
  });

  document.addEventListener("click", (e) => {
    if ($("userDropdown")) $("userDropdown").classList.remove("is-open");
    if ($("notifDropdown") && !e.target.closest("#notifWrap")) $("notifDropdown").classList.remove("is-open");
    if ($("profilePopover") && !e.target.closest(".profile-popover") && !e.target.closest(".thread-author-avatar") && !e.target.closest(".reply-avatar")) {
      $("profilePopover").classList.remove("is-open");
    }
  });

  // Modal overlay
  $("forumModalOverlay").addEventListener("click", ForumModals.close);

  // ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      ForumModals.close();
      $("userDropdown")?.classList.remove("is-open");
      $("notifDropdown")?.classList.remove("is-open");
      $("profilePopover")?.classList.remove("is-open");
    }
  });

  // Forum tabs
  document.querySelectorAll(".forum-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".forum-tab").forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      Forum.currentTab = tab.dataset.tab;
      Forum.recentPage = 0;
      Forum.loadRecentThreads();
    });
  });

  // Load more
  $("loadMoreBtn").addEventListener("click", () => {
    Forum.recentPage++;
    Forum.loadRecentThreads();
  });

  // New thread buttons
  $("newThreadBtn").addEventListener("click", () => Forum.openNewThreadModal(Forum.currentCategoryId));
  $("newThreadBtnCat").addEventListener("click", () => Forum.openNewThreadModal(Forum.currentCategoryId));
  $("newThreadClose").addEventListener("click", ForumModals.close);

  // New thread form
  $("newThreadForm").addEventListener("submit", (e) => {
    e.preventDefault();
    Forum.submitNewThread();
  });

  // Category select change -> update subcategories
  $("threadCategorySelect").addEventListener("change", (e) => {
    Forum.updateSubcategorySelect(e.target.value);
  });

  // Admin panel button
  $("adminPanelBtn").addEventListener("click", () => Forum.navigate("admin"));

  // Admin tabs
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => AdminPanel.load(tab.dataset.adminTab));
  });

  // Admin edit form
  $("adminEditForm").addEventListener("submit", (e) => {
    e.preventDefault();
    AdminPanel.saveEdit();
  });

  // Notifications
  $("notifBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    $("notifDropdown").classList.toggle("is-open");
    Notifications.load();
  });

  $("notifReadAll").addEventListener("click", () => Notifications.readAll());

  // Search
  let searchTimeout;
  $("forumSearchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => Forum.performSearch(e.target.value.trim()), 400);
  });
}

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */
async function init() {
  // Theme
  const storedTheme = getStoredTheme();
  if (storedTheme) setTheme(storedTheme);
  else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  else setTheme("light");

  // Wire events
  wire();

  // Auth
  await AuthService.init();

  // Load forum
  Forum.navigate("home");

  // Load notifications
  if (AuthService.currentUser) {
    Notifications.load();
    Notifications.startPolling();
  }
}

init();
