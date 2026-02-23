---
description: Supabase Edge Functions kurulum ve dağıtım rehberi
---

# Supabase Edge Functions Kurulum Rehberi

Bu iş akışı, AI mantığınızı güvenli bir şekilde Supabase sunucuna taşımak için gereken komutları içerir.

## 1. Supabase CLI Kurulumu
Eğer yüklü değilse, terminale (PowerShell veya CMD) şunu yazın:
```powershell
npm install supabase --save-dev
```

## 2. Giriş ve Proje Bağlantısı
Supabase hesabınıza giriş yapın ve projeyi bağlayın:
```powershell
npx supabase login
npx supabase link --project-ref [PROJE_ID]
```
*(Proje ID'nizi Supabase panelindeki URL'de veya Settings > General kısmında bulabilirsiniz. Örn: bjcsbuvjumaigvsjphor)*

## 3. Fonksiyonu Oluşturma
Proje dizininde (yt-Gonderi-Uzmani) şu komutu çalıştırarak klasör yapısını oluşturun:
```powershell
npx supabase functions new generate-post
```

## 4. Kodun Yazılması
Benim size vereceğim `index.ts` kodunu `supabase/functions/generate-post/index.ts` dosyasına yapıştırın.

## 5. Dağıtım (Deploy)
Fonksiyonu canlıya alın:
// turbo
```powershell
npx supabase functions deploy generate-post
```

## 6. API Anahtarını Tanımlama (Kritik)
AI anahtarınızı güvenli bir şekilde sunucuya kaydedin (Örn: Claude veya Gemini anahtarı):
// turbo
```powershell
npx supabase secrets set AI_API_KEY=buraya_anahtari_yazın
```
