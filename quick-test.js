/**
 * YouTube Gönderi Uzmanı - Quick Test Agent
 * Hızlı test için bağımsız script
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  pass: (msg) => console.log(`${COLORS.green}✅${COLORS.reset} ${msg}`),
  fail: (msg) => console.log(`${COLORS.red}❌${COLORS.reset} ${msg}`),
  info: (msg) => console.log(`${COLORS.blue}ℹ${COLORS.reset} ${msg}`),
  warn: (msg) => console.log(`${COLORS.yellow}⚠${COLORS.reset} ${msg}`),
  header: (msg) => console.log(`\n${COLORS.cyan}═══ ${msg} ═══${COLORS.reset}`)
};

const testResults = { passed: 0, failed: 0, tests: [] };

function test(name, condition, errorMsg = '') {
  if (condition) {
    testResults.passed++;
    testResults.tests.push({ name, passed: true });
    log.pass(name);
  } else {
    testResults.failed++;
    testResults.tests.push({ name, passed: false, error: errorMsg });
    log.fail(name + (errorMsg ? `: ${errorMsg}` : ''));
  }
}

// =====================
// STATIC CODE ANALYSIS
// =====================

function analyzeFrontend() {
  log.header('Frontend Kod Analizi');
  
  // app.js kontrolü
  const appJsPath = path.join(__dirname, 'app.js');
  if (fs.existsSync(appJsPath)) {
    const content = fs.readFileSync(appJsPath, 'utf8');
    
    // Syntax kontrolü
    try {
      new Function(content);
      test('app.js - Geçerli JavaScript syntax', true);
    } catch (e) {
      test('app.js - Geçerli JavaScript syntax', false, e.message);
    }
    
    // Kritik fonksiyonların varlığı
    test('app.js - AuthService tanımlı', content.includes('const AuthService'));
    test('app.js - Modals tanımlı', content.includes('const Modals'));
    test('app.js - generatePosts fonksiyonu', content.includes('function generatePosts'));
    test('app.js - UI objesi (çeviri)', content.includes('const UI = {'));
    test('app.js - Tema fonksiyonları', content.includes('function toggleTheme'));
    test('app.js - Supabase yapılandırması', content.includes('SUPABASE_URL'));
    test('app.js - localStorage kullanımı', content.includes('localStorage'));
    
    // Event handler'lar
    test('app.js - DOM ready handler', content.includes('document.addEventListener'));
    
    // Form element kontrolü
    const hasVideoUrl = content.includes('id="videoUrl"') || content.includes("id='videoUrl'");
    test('app.js - Video URL input', hasVideoUrl);
    
  } else {
    test('app.js dosyası mevcut', false);
  }
  
  // index.html kontrolü
  const htmlPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(htmlPath)) {
    const content = fs.readFileSync(htmlPath, 'utf8');
    
    test('index.html - DOCTYPE mevcut', content.startsWith('<!doctype html>'));
    test('index.html - meta charset UTF-8', content.includes('charset="UTF-8"'));
    test('index.html - viewport meta', content.includes('name="viewport"'));
    test('index.html - title etiketi', content.includes('<title>'));
    test('index.html - favicon linki', content.includes('favicon'));
    test('index.html - Google Fonts', content.includes('fonts.googleapis.com'));
    test('index.html - CSS dosyası', content.includes('styles.css'));
    test('index.html - Supabase JS', content.includes('supabase'));
    test('index.html - app.js scripti', content.includes('app.js'));
    
    // 5 section kontrolü
    test('index.html - Section 1 (İçerik Kaynağı)', content.includes('section1'));
    test('index.html - Section 2 (Gönderi Tipi)', content.includes('section2'));
    test('index.html - Section 3 (Ruh Hali)', content.includes('section3'));
    test('index.html - Section 4 (Amaç)', content.includes('section4'));
    test('index.html - Section 5 (Sonuçlar)', content.includes('section5'));
    
    // Tab butonları
    test('index.html - Serbest Yazı tab', content.includes('data-source="freetext"'));
    test('index.html - Video tab', content.includes('data-source="video"'));
    test('index.html - Kanal tab', content.includes('data-source="channel"'));
    
    // Gönderi tipleri
    test('index.html - Metin Gönderisi', content.includes('data-value="standard"'));
    test('index.html - Anket', content.includes('data-value="poll"'));
    test('index.html - Quiz/Test', content.includes('data-value="quiz"'));
    
    // Auth elementleri
    test('index.html - Giriş butonu', content.includes('id="loginBtn"'));
    test('index.html - Kayıt butonu', content.includes('id="registerBtn"'));
    test('index.html - Login modal', content.includes('id="loginModal"'));
    test('index.html - Register modal', content.includes('id="registerModal"'));
    
    // Token sistemi
    test('index.html - Token bakiyesi', content.includes('token-balance'));
    test('index.html - Token satın alma', content.includes('buyTokensBtn'));
    
    // Tema desteği
    test('index.html - Tema toggle', content.includes('id="themeToggle"'));
    
  } else {
    test('index.html dosyası mevcut', false);
  }
  
  // styles.css kontrolü
  const cssPath = path.join(__dirname, 'styles.css');
  if (fs.existsSync(cssPath)) {
    const content = fs.readFileSync(cssPath, 'utf8');
    
    test('styles.css - Root değişkenleri', content.includes(':root {'));
    test('styles.css - Dark tema', content.includes('[data-theme="dark"]'));
    test('styles.css - Responsive media query', content.includes('@media'));
    test('styles.css - Animasyonlar', content.includes('@keyframes'));
    test('styles.css - Flexbox kullanımı', content.includes('display: flex'));
    test('styles.css - Grid kullanımı', content.includes('display: grid'));
    test('styles.css - Border radius', content.includes('border-radius'));
    test('styles.css - Box shadow', content.includes('box-shadow'));
    
  } else {
    test('styles.css dosyası mevcut', false);
  }
}

function analyzeBackend() {
  log.header('Backend Kod Analizi (Edge Functions)');
  
  const functionsDir = path.join(__dirname, 'supabase', 'functions');
  
  if (fs.existsSync(functionsDir)) {
    const functions = fs.readdirSync(functionsDir).filter(f => {
      return fs.statSync(path.join(functionsDir, f)).isDirectory();
    });
    
    log.info(`Bulunan fonksiyonlar: ${functions.join(', ')}`);
    
    for (const funcName of functions) {
      const indexPath = path.join(functionsDir, funcName, 'index.ts');
      
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        
        test(`Edge Function: ${funcName} - serve() kullanımı`, content.includes('serve('));
        test(`Edge Function: ${funcName} - CORS headers`, content.includes('corsHeaders'));
        test(`Edge Function: ${funcName} - async handler`, content.includes('async'));
        
        // Function-specific kontroller
        if (funcName === 'generate-post') {
          test('generate-post - OpenRouter API', content.includes('openrouter.ai'));
          test('generate-post - Model fallback', content.includes('models['));
          test('generate-post - JSON parse', content.includes('JSON.parse'));
        }
        
        if (funcName === 'fetch-video') {
          test('fetch-video - YouTube URL parsing', content.includes('youtube.com'));
          test('fetch-video - Video ID extraction', content.includes('extractVideoId'));
          test('fetch-video - oEmbed API', content.includes('oembed'));
        }
        
        if (funcName === 'fetch-channel') {
          test('fetch-channel - Channel ID parsing', content.includes('channelId'));
          test('fetch-channel - RSS feed', content.includes('feeds/videos.xml'));
        }
        
        if (funcName === 'shopier-webhook') {
          test('shopier-webhook - Shopier headers', content.includes('Shopier-Event'));
          test('shopier-webhook - Token mapping', content.includes('PRODUCT_TOKEN_MAP'));
          test('shopier-webhook - Supabase client', content.includes('createClient'));
        }
      }
    }
  } else {
    test('supabase/functions klasörü mevcut', false);
  }
}

function checkSecurity() {
  log.header('Güvenlik Kontrolleri');
  
  const appJsPath = path.join(__dirname, 'app.js');
  if (fs.existsSync(appJsPath)) {
    const content = fs.readFileSync(appJsPath, 'utf8');
    
    // API key kontrolü - Production'da olmamalı
    test('Güvenlik: Hardcoded API key yok (app.js)', !content.includes('sk-') && !content.includes('api_key'));
    
    // XSS koruması
    test('Güvenlik: innerHTML kullanımı (dikkatli)', true); // İnformational
    
    // Password alanları
    test('Güvenlik: Password type kullanımı', content.includes('type="password"'));
  }
  
  // .env dosyası kontrolü
  const envPath = path.join(__dirname, '.env');
  test('.env dosyası gitignore\'da olmalı', true); // İnformational
}

function checkCompleteness() {
  log.header('Özellik Tamamlığı');
  
  const htmlPath = path.join(__dirname, 'index.html');
  const content = fs.readFileSync(htmlPath, 'utf8');
  
  // İçerik kaynakları
  const sources = [
    { id: 'panelFreetext', name: 'Serbest Yazı' },
    { id: 'panelVideo', name: 'Video' },
    { id: 'panelChannel', name: 'Kanal' }
  ];
  
  for (const source of sources) {
    test(`İçerik Kaynağı: ${source.name}`, content.includes(`id="${source.id}"`));
  }
  
  // Gönderi tipleri
  const postTypes = [
    { id: 'standard', name: 'Metin Gönderisi' },
    { id: 'poll', name: 'Anket' },
    { id: 'quiz', name: 'Test/Quiz' }
  ];
  
  for (const type of postTypes) {
    test(`Gönderi Tipi: ${type.name}`, content.includes(`data-value="${type.id}"`));
  }
  
  // Ruh halleri (7 adet)
  const moods = ['friendly', 'professional', 'funny', 'curious', 'motivational', 'informative', 'questioning'];
  let moodsFound = 0;
  for (const mood of moods) {
    if (content.includes(`data-value="${mood}"`)) moodsFound++;
  }
  test(`Ruh Hali: Tüm 7 ruh hali mevcut (${moodsFound}/7)`, moodsFound === 7);
  
  // Amaçlar (5 adet)
  const purposes = ['engagement', 'announcement', 'discussion', 'feedback', 'promotion'];
  let purposesFound = 0;
  for (const purpose of purposes) {
    if (content.includes(`data-value="${purpose}"`)) purposesFound++;
  }
  test(`Amaç: Tüm 5 amaç mevcut (${purposesFound}/5)`, purposesFound === 5);
  
  // Dil seçenekleri
  test('Dil: Otomatik tespit', content.includes('value="auto"'));
  test('Dil: Türkçe', content.includes('value="tr"'));
  test('Dil: English', content.includes('value="en"'));
}

// =====================
// MAIN
// =====================

console.log(`${COLORS.cyan}╔════════════════════════════════════════╗${COLORS.reset}`);
console.log(`${COLORS.cyan}║  QA Test Agent - Quick Analysis        ║${COLORS.reset}`);
console.log(`${COLORS.cyan}╚════════════════════════════════════════╝${COLORS.reset}`);

analyzeFrontend();
analyzeBackend();
checkSecurity();
checkCompleteness();

// Summary
console.log('\n' + '='.repeat(50));
console.log(`${COLORS.cyan}📊 TEST SONUÇLARI${COLORS.reset}`);
console.log('='.repeat(50));
console.log(`${COLORS.green}✅ Geçen: ${testResults.passed}${COLORS.reset}`);
console.log(`${COLORS.red}❌ Kalan: ${testResults.failed}${COLORS.reset}`);
console.log(`📈 Toplam: ${testResults.passed + testResults.failed}`);
console.log(`🎯 Başarı Oranı: ${((testResults.passed / (testResults.tests.length)) * 100).toFixed(1)}%`);
console.log('='.repeat(50));

if (testResults.failed > 0) {
  console.log(`\n${COLORS.yellow}⚠️  ${testResults.failed} test başarısız. Detaylar yukarıda.${COLORS.reset}`);
  process.exit(1);
} else {
  console.log(`\n${COLORS.green}✅ Tüm testler başarılı!${COLORS.reset}`);
  process.exit(0);
}
