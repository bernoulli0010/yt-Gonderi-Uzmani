const https = require('https');

const API_TOKEN = process.env.SHOPIER_TOKEN || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJlZjMzYmE3ZDc2MDE5YmNiNmNjMjNkZjhjZDE3MjM3MiIsImp0aSI6ImNiM2FmNDM3OTgxMmMwYjViNmQ2YTQ5MTZhNjdhNDU1Zjk0ZjhjMmZlMDA4MjA0MDY3ZGU3MTExMTM2NjI0NmIyMmViMjZkNDMzZDg0ZWY5MzQwZmEyMmZiNWUwOTg0ODhlMWRkOGM4ZGIzOTIzY2EzMGVkMGU4M2NjMTE1NGZmMGYzOGRmYTQ4NDI5Y2U0ZjVmODNjYWVmM2Q4YWY0Y2MiLCJpYXQiOjE3NzE4MTAwOTIsIm5iZiI6MTc3MTgxMDA5MiwiZXhwIjoxOTI5NTk0ODUyLCJzdWIiOiIyNTMyODQzIiwic2NvcGVzIjpbIm9yZGVyczpyZWFkIiwib3JkZXJzOndyaXRlIiwicHJvZHVjdHM6cmVhZCIsInByb2R1Y3RzOndyaXRlIiwic2hpcHBpbmdzOnJlYWQiLCJzaGlwcGluZ3M6d3JpdGUiLCJkaXNjb3VudHM6cmVhZCIsImRpc2NvdW50czp3cml0ZSIsInBheW91dHM6cmVhZCIsInJlZnVuZHM6cmVhZCIsInJlZnVuZHM6d3JpdGUiLCJzaG9wOnJlYWQiLCJzaG9wOndyaXRlIl19.OUQNgYCHFXI8K7aqR2vzvzEZOKf4un_7WZiiQOF8HRdCF_t9gQvLKj6gNzCh5FT2oiR5a_cuzCIA_E1ZN4etVVD2UtSV6V_Fq59I2gf3ZCdNk7gG_h4Go_qOrSGpU8xTTLV_Wqdb5ahxgGSNyOTmofMIaiInmcUYnUZtQTnNinGwiwwVzxRiDsUcH9usw6StYH9MwIl8vXIsPj-Xfe4HglQrph71eiP10nsLAeTF9ARr-EztY9AHsuwJJmo4HC6utWBaMSEcpCzCtsvffC5zjmw2mxQWiCT7kchPHs-glu23kG6aDMwARKWdx6eV0k4JeLSnb8OkwOoLghlhPzSsXQ';

const products = [
  { name: 'YouTube Gonderi Uzmanı - 100 Token', price: 100 },
  { name: 'YouTube Gonderi Uzmanı - 500 Token', price: 400 },
  { name: 'YouTube Gonderi Uzmanı - 1000 Token', price: 750 }
];

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.shopier.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createProducts() {
  console.log('Shopier mevcut ürünler kontrol ediliyor...\n');
  
  try {
    const productsList = await makeRequest('/v1/products');
    console.log('Mevcut ürünler:', JSON.stringify(productsList, null, 2));
  } catch (e) {
    console.log('Ürün listeleme hatası:', e.message);
  }

  console.log('\n--- Yeni ürün oluşturma denemeleri ---');
  
  for (const product of products) {
    console.log(`\n"${product.name}" (${product.price} TL) oluşturuluyor...`);
    
    const body = JSON.stringify({
      title: product.name,
      type: 'digital',
      price: product.price,
      currency: 'TRY',
      description: 'YouTube Gonderi Uzmanı Token Paketi',
      media: [{ type: 'image', url: 'https://via.placeholder.com/300.png', placement: 1 }]
    });
    
    try {
      const result = await makeRequest('/v1/products', 'POST', body);
      console.log('Sonuç:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('Hata:', e.message);
    }
  }
}

createProducts();
