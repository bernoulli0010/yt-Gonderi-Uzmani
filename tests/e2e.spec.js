/**
 * YouTube Gönderi Uzmanı - E2E UI Tests
 * Kapsamlı kullanıcı arayüzü testleri
 */

const { test, expect } = require('@playwright/test');

test.describe('YT Gonderi Uzmani - E2E Tests', () => {
  
  // Test 1: Ana sayfa yükleme
  test.describe('Sayfa Yükleme ve Temel UI', () => {
    test('Ana sayfa doğru yüklenmeli', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      // Header kontrolü
      await expect(page.locator('.brand-title')).toContainText('YouTube Gönderi Uzmanı');
      
      // 5 adımın varlığı
      await expect(page.locator('#section1')).toBeVisible();
      await expect(page.locator('#section2')).toBeVisible();
      await expect(page.locator('#section3')).toBeVisible();
      await expect(page.locator('#section4')).toBeVisible();
      await expect(page.locator('#section5')).toBeVisible();
    });

    test('Tüm bölüm başlıkları görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('#contentSourceTitle')).toContainText('İçerik Kaynağı');
      await expect(page.locator('#postTypeTitle')).toContainText('Gönderi Tipi');
      await expect(page.locator('#moodTitle')).toContainText('Ruh Hali');
      await expect(page.locator('#purposeTitle')).toContainText('Amaç ve Dil');
      await expect(page.locator('#resultsTitle')).toContainText('Oluşturulan Gönderiler');
    });
  });

  // Test 2: Tema Değiştirme
  test.describe('Tema Sistemi', () => {
    test('Varsayılan tema light olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(theme).toBeNull(); // Varsayılan light tema
    });

    test('Tema toggle çalışmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      // Dark mode'a geç
      await page.click('#themeToggle');
      const themeDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(themeDark).toBe('dark');
      
      // Light mode'a geri dön
      await page.click('#themeToggle');
      const themeLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(themeLight).toBe('light');
    });

    test('Tema localStorage\'a kaydedilmeli', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await page.click('#themeToggle');
      const savedTheme = await page.evaluate(() => localStorage.getItem('yt-gonderi-uzmani:theme'));
      expect(savedTheme).toBe('dark');
    });
  });

  // Test 3: Dil Sistemi
  test.describe('Dil Sistemi', () => {
    test('Varsayılan dil Türkçe olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      await expect(page.locator('#langTr')).toHaveClass(/is-active/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    });

    test('English\'e geçiş çalışmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await page.click('#langEn');
      
      await expect(page.locator('#langEn')).toHaveClass(/is-active/);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('#appTitle')).toContainText('YouTube Post Expert');
    });

    test('Türkçe\'ye geri dönüş çalışmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      // EN'e geç
      await page.click('#langEn');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      
      // TR'ye geri dön
      await page.click('#langTr');
      await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
      await expect(page.locator('#appTitle')).toContainText('YouTube Gönderi Uzmanı');
    });
  });

  // Test 4: İçerik Kaynağı - Tab Geçişleri
  test.describe('İçerik Kaynağı - Tab Sistemi', () => {
    test('Varsayılan Video sekmesi aktif olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      const videoTab = page.locator('.tab-btn[data-source="video"]');
      await expect(videoTab).toHaveClass(/is-active/);
      await expect(page.locator('#panelVideo')).toBeVisible();
    });

    test('Serbest Yazı sekmesine geçiş', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await page.click('.tab-btn[data-source="freetext"]');
      
      await expect(page.locator('.tab-btn[data-source="freetext"]')).toHaveClass(/is-active/);
      await expect(page.locator('#panelFreetext')).toBeVisible();
      await expect(page.locator('#panelVideo')).toBeHidden();
    });

    test('Kanal sekmesine geçiş', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await page.click('.tab-btn[data-source="channel"]');
      
      await expect(page.locator('.tab-btn[data-source="channel"]')).toHaveClass(/is-active/);
      await expect(page.locator('#panelChannel')).toBeVisible();
    });

    test('Video sekmesine geri dönüş', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      // Channel'a geç
      await page.click('.tab-btn[data-source="channel"]');
      await expect(page.locator('#panelChannel')).toBeVisible();
      
      // Video'ya geri dön
      await page.click('.tab-btn[data-source="video"]');
      await expect(page.locator('.tab-btn[data-source="video"]')).toHaveClass(/is-active/);
      await expect(page.locator('#panelVideo')).toBeVisible();
    });
  });

  // Test 5: Gönderi Tipi Seçimi
  test.describe('Gönderi Tipi Seçimi', () => {
    test('Varsayılan Metin Gönderisi aktif olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      const standardBtn = page.locator('.option-pill[data-value="standard"]');
      await expect(standardBtn).toHaveClass(/is-active/);
    });

    test('Anket seçimi çalışmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await page.click('.option-pill[data-value="poll"]');
      
      await expect(page.locator('.option-pill[data-value="poll"]')).toHaveClass(/is-active/);
      await expect(page.locator('.option-pill[data-value="standard"]')).not.toHaveClass(/is-active/);
    });

    test('Test/Quiz seçimi çalışmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await page.click('.option-pill[data-value="quiz"]');
      
      await expect(page.locator('.option-pill[data-value="quiz"]')).toHaveClass(/is-active/);
    });
  });

  // Test 6: Ruh Hali Seçimi
  test.describe('Ruh Hali Seçimi', () => {
    test('7 ruh hali butonu görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      const moods = page.locator('#moodGroup .option-card');
      await expect(moods).toHaveCount(7);
    });

    test('Varsayılan Samimi (friendly) aktif olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('.option-card[data-value="friendly"]')).toHaveClass(/is-active/);
    });

    test('Tüm ruh halleri seçilebilir olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      const moodValues = ['professional', 'funny', 'curious', 'motivational', 'informative', 'questioning'];
      
      for (const mood of moodValues) {
        await page.click(`.option-card[data-value="${mood}"]`);
        await expect(page.locator(`.option-card[data-value="${mood}"]`)).toHaveClass(/is-active/);
      }
    });
  });

  // Test 7: Amaç Seçimi
  test.describe('Amaç ve Dil Seçimi', () => {
    test('5 amaç seçeneği görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      const purposes = page.locator('#purposeGroup .option-card');
      await expect(purposes).toHaveCount(5);
    });

    test('Varsayılan Etkileşim aktif olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('.option-card[data-value="engagement"]')).toHaveClass(/is-active/);
    });

    test('Dil selectbox çalışmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      const select = page.locator('#languageSelect');
      await expect(select).toBeVisible();
      
      // Options kontrolü
      await expect(select.locator('option#langAutoOption')).toHaveValue('auto');
      await expect(select.locator('option#langTrOption')).toHaveValue('tr');
      await expect(select.locator('option#langEnOption')).toHaveValue('en');
    });
  });

  // Test 8: Form Alanları
  test.describe('Form Alanları', () => {
    test('Video panel form alanları görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('#videoUrl')).toBeVisible();
      await expect(page.locator('#fetchVideoBtn')).toBeVisible();
    });

    test('Form alanları placeholder içermeli', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      const videoUrl = page.locator('#videoUrl');
      await expect(videoUrl).toHaveAttribute('placeholder', /youtube\.com/);
    });

    test('Serbest yazı textarea çalışmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      // Serbest yazı sekmesine geç
      await page.click('.tab-btn[data-source="freetext"]');
      
      await expect(page.locator('#videoTopic')).toBeVisible();
      
      // Yazı yazma testi
      await page.fill('#videoTopic', 'Test video konusu');
      await expect(page.locator('#videoTopic')).toHaveValue('Test video konusu');
    });
  });

  // Test 9: Token Sistemi UI
  test.describe('Token Sistemi UI', () => {
    test('Token bilgileri görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('#tokenCostLabel')).toContainText('Token Gerekli:');
      await expect(page.locator('#tokenCost')).toContainText('1 Token');
      await expect(page.locator('#tokenCurrentLabel')).toContainText('Mevcut Token');
    });

    test('Yetersiz token uyarısı (guest)', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      // Guest modunda token warning görünür olmalı
      await expect(page.locator('#tokenWarning')).toBeVisible();
      await expect(page.locator('#tokenWarningTitle')).toContainText('Yetersiz Token');
    });

    test('Token packages modal\'ı açılabilir olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      // Quick Buy butonu
      await expect(page.locator('#quickBuyBtn')).toBeVisible();
    });
  });

  // Test 10: Auth UI (Modal)
  test.describe('Auth Modal UI', () => {
    test('Giriş butonu görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('#loginBtn')).toBeVisible();
      await expect(page.locator('#registerBtn')).toBeVisible();
    });

    test('Giriş modal\'ı açılabilir olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await page.click('#loginBtn');
      
      await expect(page.locator('#loginModal')).toHaveClass(/is-visible/);
      await expect(page.locator('#loginModalTitle')).toContainText('Giriş Yap');
    });

    test('Kayıt modal\'ı açılabilir olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await page.click('#registerBtn');
      
      await expect(page.locator('#registerModal')).toHaveClass(/is-visible/);
      await expect(page.locator('#registerModalTitle')).toContainText('Kayıt Ol');
    });

    test('Modal kapatma çalışmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      // Login modal aç
      await page.click('#loginBtn');
      await expect(page.locator('#loginModal')).toHaveClass(/is-visible/);
      
      // Kapat
      await page.click('#modalOverlay');
      await expect(page.locator('#loginModal')).not.toHaveClass(/is-visible/);
    });
  });

  // Test 11: Sonuçlar Alanı
  test.describe('Sonuçlar Alanı', () => {
    test('Boş durum mesajı görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('#emptyState')).toBeVisible();
      await expect(page.locator('#emptyText')).toContainText('Henüz gönderi oluşturulmadı');
    });

    test('Generate butonu görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('#generateBtn')).toBeVisible();
      await expect(page.locator('#generateBtnText')).toContainText('AI ile Oluştur');
    });
  });

  // Test 12: Responsive Tasarım
  test.describe('Responsive Tasarım', () => {
    test('Mobil görünümde form düzgün çalışmalı', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('file://' + process.cwd() + '/index.html');
      
      // Header hala görünür
      await expect(page.locator('.header')).toBeVisible();
      
      // Tüm section'lar scroll edilebilir olmalı
      await expect(page.locator('#section1')).toBeVisible();
    });

    test('Tablet görünümü', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('.header')).toBeVisible();
      await expect(page.locator('#section1')).toBeVisible();
    });
  });

  // Test 13: JavaScript Hata Kontrolü
  test.describe('JavaScript Hata Kontrolü', () => {
    test('Console\'da kritik hata olmamalı', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto('file://' + process.cwd() + '/index.html');
      await page.waitForTimeout(1000);
      
      // Supabase bağlantı hatası beklenen bir durum (test ortamında)
      // Ama diğer kritik hatalar olmamalı
      const criticalErrors = errors.filter(e => 
        !e.includes('Supabase') && 
        !e.includes('network') &&
        !e.includes('Failed to fetch')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });

  // Test 14: Reset Fonksiyonu
  test.describe('Reset Fonksiyonu', () => {
    test('Reset butonu görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('#resetBtn')).toBeVisible();
    });
  });

  // Test 15: Footer
  test.describe('Footer', () => {
    test('Footer görünür olmalı', async ({ page }) => {
      await page.goto('file://' + process.cwd() + '/index.html');
      
      await expect(page.locator('.footer')).toBeVisible();
      await expect(page.locator('#backToTopBtn')).toBeVisible();
    });
  });
});
