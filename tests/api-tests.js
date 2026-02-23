/**
 * YouTube Gönderi Uzmanı - API Tests
 * Supabase Edge Function'ları için kapsamlı API testleri
 */

// Not: Bu testler gerçek Supabase projesinde çalıştırılmalıdır
// Environment variable'ları ayarlanmalıdır

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjcsbuvjumaigvsjphor.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Ws-ubr-U3Uryo-oJxE0rvg_QTlz2Kqa';

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, error = null) {
  const result = { name, passed, error };
  testResults.tests.push(result);
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}`);
    if (error) console.log(`   Error: ${error}`);
  }
}

async function fetchAPI(endpoint, body) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

// =====================
// TEST SUITES
// =====================

async function runFetchVideoTests() {
  console.log('\n📋 fetch-video Tests');
  console.log('=====================');
  
  // Test 1: Geçerli YouTube URL
  try {
    const result = await fetchAPI('fetch-video', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    
    if (result.status === 200 && result.data.success) {
      logTest('Geçerli video URL - Başarılı', true);
    } else {
      logTest('Geçerli video URL', false, `Status: ${result.status}, Response: ${JSON.stringify(result.data)}`);
    }
  } catch (e) {
    logTest('Geçerli video URL', false, e.message);
  }
  
  // Test 2: Geçersiz URL
  try {
    const result = await fetchAPI('fetch-video', {
      url: 'https://invalid-url.com/video'
    });
    
    if (result.status === 200 && result.data.error) {
      logTest('Geçersiz URL - Hata döndürüyor', true);
    } else {
      logTest('Geçersiz URL', false, 'Hata beklendi ama farklı yanıt');
    }
  } catch (e) {
    logTest('Geçersiz URL', false, e.message);
  }
  
  // Test 3: Boş URL
  try {
    const result = await fetchAPI('fetch-video', {
      url: ''
    });
    
    if (result.status === 200 && result.data.error) {
      logTest('Boş URL - Hata döndürüyor', true);
    } else {
      logTest('Boş URL', false, 'Hata beklendi ama farklı yanıt');
    }
  } catch (e) {
    logTest('Boş URL', false, e.message);
  }
  
  // Test 4: Shorts URL
  try {
    const result = await fetchAPI('fetch-video', {
      url: 'https://www.youtube.com/shorts/abc123'
    });
    
    if (result.status === 200) {
      logTest('YouTube Shorts URL', true);
    } else {
      logTest('YouTube Shorts URL', false, `Status: ${result.status}`);
    }
  } catch (e) {
    logTest('YouTube Shorts URL', false, e.message);
  }
  
  // Test 5: URL ID extraction
  try {
    const result = await fetchAPI('fetch-video', {
      url: 'https://youtu.be/dQw4w9WgXcQ'
    });
    
    if (result.status === 200 && result.data.videoId === 'dQw4w9WgXcQ') {
      logTest('YouTube ID extraction (youtu.be)', true);
    } else {
      logTest('YouTube ID extraction (youtu.be)', false, 'ID eşleşmedi');
    }
  } catch (e) {
    logTest('YouTube ID extraction (youtu.be)', false, e.message);
  }
  
  // Test 6: Video metadata kontrolü
  try {
    const result = await fetchAPI('fetch-video', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
    
    const requiredFields = ['videoId', 'title', 'channel', 'thumbnailUrl', 'summary'];
    const hasAllFields = requiredFields.every(field => result.data[field] !== undefined);
    
    if (hasAllFields) {
      logTest('Video metadata alanları eksiksiz', true);
    } else {
      logTest('Video metadata alanları eksiksiz', false, 'Bazı alanlar eksik');
    }
  } catch (e) {
    logTest('Video metadata alanları eksiksiz', false, e.message);
  }
}

async function runFetchChannelTests() {
  console.log('\n📋 fetch-channel Tests');
  console.log('=======================');
  
  // Test 1: Geçerli kanal URL formatı
  try {
    const result = await fetchAPI('fetch-channel', {
      query: 'https://www.youtube.com/channel/UCuAXFkgswN7Lr5CZvcK1x7Q'
    });
    
    if (result.status === 200 && result.data.success) {
      logTest('Geçerli kanal URL - Başarılı', true);
    } else if (result.status === 200 && result.data.error) {
      logTest('Geçerli kanal URL', false, result.data.error);
    } else {
      logTest('Geçerli kanal URL', false, `Status: ${result.status}`);
    }
  } catch (e) {
    logTest('Geçerli kanal URL', false, e.message);
  }
  
  // Test 2: @handle format
  try {
    const result = await fetchAPI('fetch-channel', {
      query: '@google'
    });
    
    if (result.status === 200) {
      logTest('@handle format kanal araması', true);
    } else {
      logTest('@handle format kanal araması', false, `Status: ${result.status}`);
    }
  } catch (e) {
    logTest('@handle format kanal araması', false, e.message);
  }
  
  // Test 3: Boş sorgu
  try {
    const result = await fetchAPI('fetch-channel', {
      query: ''
    });
    
    if (result.status === 200 && result.data.error) {
      logTest('Boş sorgu - Hata döndürüyor', true);
    } else {
      logTest('Boş sorgu', false, 'Hata beklendi');
    }
  } catch (e) {
    logTest('Boş sorgu', false, e.message);
  }
  
  // Test 4: Kanal yanıt yapısı
  try {
    const result = await fetchAPI('fetch-channel', {
      query: 'https://www.youtube.com/channel/UCuAXFkgswN7Lr5CZvcK1x7Q'
    });
    
    if (result.status === 200 && result.data.success) {
      const requiredFields = ['channelId', 'channelName', 'videos', 'contentKeywords'];
      const hasAllFields = requiredFields.every(field => result.data[field] !== undefined);
      
      if (hasAllFields) {
        logTest('Kanal yanıt yapısı eksiksiz', true);
      } else {
        logTest('Kanal yanıt yapısı eksiksiz', false, 'Eksik alanlar var');
      }
    } else {
      logTest('Kanal yanıt yapısı', false, 'Başarısız yanıt');
    }
  } catch (e) {
    logTest('Kanal yanıt yapısı', false, e.message);
  }
}

async function runGeneratePostTests() {
  console.log('\n📋 generate-post Tests');
  console.log('=====================');
  
  // Test 1: Minimal state ile generate
  try {
    const result = await fetchAPI('generate-post', {
      state: {
        lang: 'tr',
        source: 'freetext',
        postType: 'standard',
        mood: 'friendly',
        purpose: 'engagement',
        videoTopic: 'Test video konusu'
      }
    });
    
    if (result.status === 200 && result.data.posts) {
      logTest('Minimal state ile gönderi oluşturma', true);
    } else if (result.status === 200 && result.data.error) {
      logTest('Minimal state ile gönderi oluşturma', false, result.data.error);
    } else {
      logTest('Minimal state ile gönderi oluşturma', false, `Status: ${result.status}`);
    }
  } catch (e) {
    logTest('Minimal state ile gönderi oluşturma', false, e.message);
  }
  
  // Test 2: Anket gönderisi
  try {
    const result = await fetchAPI('generate-post', {
      state: {
        lang: 'tr',
        source: 'freetext',
        postType: 'poll',
        mood: 'friendly',
        purpose: 'engagement',
        videoTopic: 'En sevdiğiniz renk nedir?'
      }
    });
    
    if (result.status === 200 && result.data.posts) {
      logTest('Anket gönderisi oluşturma', true);
    } else {
      logTest('Anket gönderisi oluşturma', false, result.data.error || 'Başarısız');
    }
  } catch (e) {
    logTest('Anket gönderisi oluşturma', false, e.message);
  }
  
  // Test 3: Quiz/Test gönderisi
  try {
    const result = await fetchAPI('generate-post', {
      state: {
        lang: 'en',
        source: 'freetext',
        postType: 'quiz',
        mood: 'professional',
        purpose: 'engagement',
        videoTopic: 'What is 2+2?'
      }
    });
    
    if (result.status === 200 && result.data.posts) {
      logTest('Quiz gönderisi oluşturma (EN)', true);
    } else {
      logTest('Quiz gönderisi oluşturma (EN)', false, result.data.error || 'Başarısız');
    }
  } catch (e) {
    logTest('Quiz gönderisi oluşturma (EN)', false, e.message);
  }
  
  // Test 4: Tüm ruh halleri
  const moods = ['friendly', 'professional', 'funny', 'curious', 'motivational', 'informative', 'questioning'];
  for (const mood of moods) {
    try {
      const result = await fetchAPI('generate-post', {
        state: {
          lang: 'tr',
          source: 'freetext',
          postType: 'standard',
          mood: mood,
          purpose: 'engagement',
          videoTopic: 'Test konusu'
        }
      });
      
      if (result.status === 200 && result.data.posts) {
        logTest(`Mood: ${mood}`, true);
      } else {
        logTest(`Mood: ${mood}`, false, result.data.error);
      }
    } catch (e) {
      logTest(`Mood: ${mood}`, false, e.message);
    }
  }
  
  // Test 5: Video source ile
  try {
    const result = await fetchAPI('generate-post', {
      state: {
        lang: 'tr',
        source: 'video',
        videoUrl: 'https://www.youtube.com/watch?v=test123',
        postType: 'standard',
        mood: 'friendly',
        purpose: 'engagement'
      }
    });
    
    if (result.status === 200) {
      logTest('Video source ile gönderi oluşturma', true);
    } else {
      logTest('Video source ile gönderi oluşturma', false, `Status: ${result.status}`);
    }
  } catch (e) {
    logTest('Video source ile gönderi oluşturma', false, e.message);
  }
  
  // Test 6: Ekstra parametreler (keyPoints, audience, cta, hashtags)
  try {
    const result = await fetchAPI('generate-post', {
      state: {
        lang: 'tr',
        source: 'freetext',
        postType: 'standard',
        mood: 'friendly',
        purpose: 'engagement',
        videoTopic: 'Test konusu',
        keyPoints: 'Nokta 1\nNokta 2\nNokta 3',
        audience: 'Öğrenciler',
        cta: 'Videoyu izle!',
        hashtags: '#test #youtube'
      }
    });
    
    if (result.status === 200 && result.data.posts) {
      logTest('Ekstra parametreler ile gönderi', true);
    } else {
      logTest('Ekstra parametreler ile gönderi', false, result.data.error);
    }
  } catch (e) {
    logTest('Ekstra parametreler ile gönderi', false, e.message);
  }
  
  // Test 7: Dil seçenekleri
  const langs = ['tr', 'en'];
  for (const lang of langs) {
    try {
      const result = await fetchAPI('generate-post', {
        state: {
          lang: lang,
          language: lang,
          source: 'freetext',
          postType: 'standard',
          mood: 'friendly',
          purpose: 'engagement',
          videoTopic: 'Test'
        }
      });
      
      if (result.status === 200 && result.data.posts) {
        logTest(`Dil: ${lang}`, true);
      } else {
        logTest(`Dil: ${lang}`, false, result.data.error);
      }
    } catch (e) {
      logTest(`Dil: ${lang}`, false, e.message);
    }
  }
  
  // Test 8: Gönderi format kontrolü
  try {
    const result = await fetchAPI('generate-post', {
      state: {
        lang: 'tr',
        source: 'freetext',
        postType: 'standard',
        mood: 'friendly',
        purpose: 'engagement',
        videoTopic: 'Test konusu'
      }
    });
    
    if (result.status === 200 && result.data.posts) {
      const posts = result.data.posts;
      const isArray = Array.isArray(posts);
      const has3Posts = posts.length === 3;
      
      if (isArray && has3Posts) {
        logTest('Gönderi format kontrolü (3 post)', true);
      } else {
        logTest('Gönderi format kontrolü (3 post)', false, `Count: ${posts.length}`);
      }
    } else {
      logTest('Gönderi format kontrolü (3 post)', false, 'Gönderi yok');
    }
  } catch (e) {
    logTest('Gönderi format kontrolü (3 post)', false, e.message);
  }
  
  // Test 9: Karakter limiti kontrolü
  try {
    const result = await fetchAPI('generate-post', {
      state: {
        lang: 'tr',
        source: 'freetext',
        postType: 'standard',
        mood: 'friendly',
        purpose: 'engagement',
        videoTopic: 'Test konusu'
      }
    });
    
    if (result.status === 200 && result.data.posts) {
      const allUnder500 = result.data.posts.every(p => p.length <= 500);
      
      if (allUnder500) {
        logTest('Gönderi karakter limiti (<=500)', true);
      } else {
        const overLimit = result.data.posts.filter(p => p.length > 500);
        logTest('Gönderi karakter limiti (<=500)', false, `${overLimit.length} gönderi 500 karakteri aşıyor`);
      }
    } else {
      logTest('Gönderi karakter limiti (<=500)', false, 'Gönderi yok');
    }
  } catch (e) {
    logTest('Gönderi karakter limiti (<=500)', false, e.message);
  }
}

async function runShopierWebhookTests() {
  console.log('\n📋 shopier-webhook Tests');
  console.log('========================');
  
  // Test 1: OPTIONS isteği (CORS)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/shopier-webhook`, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    
    if (response.ok) {
      logTest('CORS preflight (OPTIONS)', true);
    } else {
      logTest('CORS preflight (OPTIONS)', false, `Status: ${response.status}`);
    }
  } catch (e) {
    logTest('CORS preflight (OPTIONS)', false, e.message);
  }
  
  // Test 2: POST - Başarısız istek (signature yok)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/shopier-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Shopier-Event': 'order.created'
      },
      body: JSON.stringify({
        id: 'test_order_123',
        paymentStatus: 'paid',
        note: 'test@example.com',
        lineItems: [{ productId: '44335263', quantity: 1 }],
        totals: { total: '100' },
        currency: 'TRY'
      })
    });
    
    // Webhook testi - gerçek test için gerçek Shopier signature gerekli
    // Bu sadece endpoint'in çalışıp çalışmadığını kontrol eder
    if (response.ok || response.status === 200) {
      logTest('Webhook endpoint erişilebilir', true);
    } else {
      logTest('Webhook endpoint erişilebilir', false, `Status: ${response.status}`);
    }
  } catch (e) {
    logTest('Webhook endpoint erişilebilir', false, e.message);
  }
  
  // Test 3: GET isteği (method not allowed)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/shopier-webhook`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    
    // 405 veya 404 beklenir
    if (!response.ok) {
      logTest('Yanlış HTTP metodu reddediliyor', true);
    } else {
      logTest('Yanlış HTTP metodu reddediliyor', false, 'Herhangi bir method kabul ediliyor');
    }
  } catch (e) {
    logTest('Yanlış HTTP metodu reddediliyor', false, e.message);
  }
}

// =====================
// MAIN RUNNER
// =====================

async function runAllTests() {
  console.log('='.repeat(50));
  console.log('🧪 YouTube Gönderi Uzmanı - API Test Suite');
  console.log('='.repeat(50));
  console.log(`URL: ${SUPABASE_URL}`);
  console.log(`Tarih: ${new Date().toISOString()}`);
  console.log('='.repeat(50));
  
  await runFetchVideoTests();
  await runFetchChannelTests();
  await runGeneratePostTests();
  await runShopierWebhookTests();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SONUÇLARI');
  console.log('='.repeat(50));
  console.log(`✅ Geçen: ${testResults.passed}`);
  console.log(`❌ Kalan: ${testResults.failed}`);
  console.log(`📈 Toplam: ${testResults.passed + testResults.failed}`);
  console.log(`🎯 Başarı Oranı: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));
  
  // Test sonuçlarını dosyaya kaydet
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    url: SUPABASE_URL,
    summary: {
      passed: testResults.passed,
      failed: testResults.failed,
      total: testResults.passed + testResults.failed,
      successRate: ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)
    },
    tests: testResults.tests
  };
  
  fs.writeFileSync('test-results/api-test-results.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detaylı rapor: test-results/api-test-results.json');
  
  return testResults;
}

// Export for use in test runner
module.exports = { runAllTests, testResults };

// Run if called directly
if (require.main === module) {
  runAllTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(err => {
    console.error('Test suite hatası:', err);
    process.exit(1);
  });
}
