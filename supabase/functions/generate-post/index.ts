import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Helpers ──

function safeStr(val: unknown): string {
  if (typeof val === "string") return val.trim();
  return "";
}

function normalizeLines(raw: unknown): string[] {
  const s = safeStr(raw);
  if (!s) return [];
  return s.split(/\n|,/).map(l => l.trim()).filter(Boolean);
}

// ── Build Context (server-side) ──

function buildContext(state: Record<string, unknown>) {
  const topic = safeStr(state.videoTopic);
  const points = normalizeLines(state.keyPoints);
  const audience = safeStr(state.audience);
  const cta = safeStr(state.cta);
  const link = safeStr(state.videoLink);
  const hashtags = safeStr(state.hashtags);
  const source = safeStr(state.source) || "freetext";
  const videoUrl = safeStr(state.videoUrl);
  const channelSearch = safeStr(state.channelSearch);
  const videoData = state.videoData as Record<string, unknown> | undefined;
  const channelData = state.channelData as Record<string, unknown> | undefined;
  return { topic, points, audience, cta, link, hashtags, source, videoUrl, channelSearch, videoData, channelData };
}

// ── Build Prompt (server-side) ──

function buildPrompt(state: Record<string, unknown>) {
  const lang = safeStr(state.lang) || "tr";
  const ctx = buildContext(state);

  // Content language from dropdown
  let contentLang = safeStr(state.language); // "auto", "tr", or "en"
  if (!contentLang || contentLang === "auto") contentLang = lang;
  const langName = contentLang === "tr" ? "Turkce" : "English";

  const mood = safeStr(state.mood) || "friendly";
  const purpose = safeStr(state.purpose) || "engagement";
  const postType = safeStr(state.postType) || "standard";

  // Source block - use fetched data if available
  let sourceBlock = "";
  if (ctx.source === "video" && ctx.videoUrl) {
    if (ctx.videoData) {
      // Use fetched video data
      const v = ctx.videoData;
      sourceBlock = `Video: "${safeStr(v.title)}"
Kanal: ${safeStr(v.channel)}
Video Ozeti: ${safeStr(v.summary)}
Bu video hakkinda 3 farkli YouTube topluluk gonderisi olustur.`;
    } else {
      // Fallback: URL only
      sourceBlock = `Kullanici bir YouTube video linki verdi: ${ctx.videoUrl}
Bu videonun konusunu, basligini ve icerigini tahmin et. Eger bu populer bir video ise bilgilerini kullan. Bilinmeyen bir videoysa URL'den ve baglamdan cikarim yap.`;
    }
  } else if (ctx.source === "channel" && ctx.channelSearch) {
    if (ctx.channelData) {
      // Use fetched channel data
      const c = ctx.channelData;
      const videos = Array.isArray(c.videos) ? c.videos.map((v: any) => safeStr(v.title)).slice(0, 5).join("; ") : "";
      const keywords = Array.isArray(c.contentKeywords) ? c.contentKeywords.join(", ") : "";
      sourceBlock = `Kanal: "${safeStr(c.channelName)}"
Son Videolar: ${videos}
Icerik Anahtar Kelimeleri: ${keywords}
Bu kanal icin 3 farkli YouTube topluluk gonderisi olustur.`;
    } else {
      // Fallback: channel name only
      sourceBlock = `Kullanici bir YouTube kanali belirtti: ${ctx.channelSearch}
Bu kanalin tarzini, icerik turunu ve hedef kitlesini tahmin et. Eger bilinen bir kanalsa bilgilerini kullan. Bilinmeyen bir kanalsa isimden cikarim yap.`;
    }
  } else if (ctx.topic) {
    sourceBlock = `Kullanicinin serbest metin girisi: "${ctx.topic}"`;
  } else {
    sourceBlock = `Kullanici henuz detayli bir konu belirtmedi. Genel bir YouTube icerik ureticisi olarak yaratici gonderiler olustur.`;
  }

  // Extras
  const extras: string[] = [];
  if (ctx.points.length > 0) extras.push(`Anahtar noktalar: ${ctx.points.join(", ")}`);
  if (ctx.audience) extras.push(`Hedef kitle: ${ctx.audience}`);
  if (ctx.cta) extras.push(`Eylem cagrisi (CTA): ${ctx.cta}`);
  if (ctx.link) extras.push(`Referans linki: ${ctx.link}`);
  if (ctx.hashtags) extras.push(`Hashtag'ler: ${ctx.hashtags}`);
  const extraBlock = extras.length > 0 ? "\n\nEk bilgiler:\n" + extras.join("\n") : "";

  // Post type instructions
  let postTypeBlock = "";
  if (postType === "standard") {
    postTypeBlock = `Normal metin gonderisi olustur. Kisa paragraflar, emoji kullanimi, satir aralari ile okunabilir yap. YouTube topluluk gonderisi formatinda ol (max 500 karakter hedefle).`;
  } else if (postType === "poll") {
    postTypeBlock = `Anket formatinda gonderi olustur. Su yapida olmali:
- Dikkat cekici bir giris/soru cumlesi
- 4 anket secenegi (her biri kisa ve net)
- Secenekleri su formatta yaz: "Secenek 1 / Secenek 2 / Secenek 3 / Secenek 4"
- Anket sorusu ve secenekler gonderinin icinde acikca belirtilmeli`;
  } else if (postType === "quiz") {
    postTypeBlock = `Test/Quiz formatinda gonderi olustur. Su yapida olmali:
- Merak uyandirici bir soru
- 4 sik (A, B, C, D olarak isaretle)
- Dogru cevabi belirtme, izleyiciler tahmin etsin
- "Cevabi yorumlarda yaz!" gibi bir etkilesim cagrisi ekle`;
  }

  // Mood descriptions
  const moodDescriptions: Record<string, string> = {
    friendly: 'Samimi, sicak, dostca bir ton kullan. Arkadasinla konusur gibi yaz. "Beyler bakin ne yaptim!", "Bir sey soyleyecegim..." gibi samimi giris cumleleri kullan.',
    professional: 'Resmi, ciddi ve profesyonel bir ton kullan. Bilimsel ve otoriter bir dil tercih et. "Arastirmalar gosteriyor ki...", "Dikkat edilmesi gereken onemli bir konu..." gibi profesyonel giris cumleleri kullan.',
    funny: 'Komik, espirili ve eglenceli bir ton kullan. Mizahi dil, sakalar, absurt benzetmeler kullan. Guldururken bilgi ver.',
    curious: 'Merak uyandirici, gizemli ve ilgi cekici bir ton kullan. Okuyucunun "devamini okumak istiyorum" demesini sagla.',
    motivational: 'Motive edici, ilham verici ve guclendirici bir ton kullan. Okuyucuya enerji ver.',
    informative: 'Bilgilendirici, ogretici ve aciklayici bir ton kullan. Liste formatinda, madde isaretleriyle, net bilgiler ver.',
    questioning: 'Soru soran, tartisma baslatan ve etkilesimli bir ton kullan. Okuyucuyu dusundur ve yorum yazmaya tesvik et.',
  };

  // Purpose descriptions
  const purposeDescriptions: Record<string, string> = {
    engagement: 'Etkilesim artirmak hedefi var. Begeni, yorum ve paylasim isteyen cumleler ekle. "Yorumda yaz!", "Begenmeyi unutma!" gibi CTA\'lar kullan.',
    announcement: 'Duyuru yapmak hedefi var. Yeni video, etkinlik veya haber bildirimi formatinda yaz. "YENI VIDEO", "DUYURU!" gibi dikkat cekici basliklar kullan.',
    discussion: 'Tartisma baslatmak hedefi var. Farkli gorusleri ortaya cikaracak sorular sor. Zit fikirleri yan yana koy.',
    feedback: 'Geri bildirim almak hedefi var. Izleyiciden fikir, oneri ve degerlendirme iste.',
    promotion: 'Tanitim yapmak hedefi var. Urun, video veya kanal tanitimi formatinda yaz. Faydalari vurgula, merak uyandir.',
  };

  const moodBlock = moodDescriptions[mood] || moodDescriptions.friendly;
  const purposeBlock = purposeDescriptions[purpose] || purposeDescriptions.engagement;

  return `Sen profesyonel bir YouTube Community Post uzmanisin. Kullanicinin secimlerine gore 3 farkli, ozgun ve kaliteli YouTube topluluk gonderisi olustur.

## Dil
Gonderileri ${langName} dilinde yaz.

## Kaynak
${sourceBlock}${extraBlock}

## Gonderi Tipi: ${postType}
${postTypeBlock}

## Ruh Hali: ${mood}
${moodBlock}

## Amac: ${purpose}
${purposeBlock}

## Cikti Kurallari
1. SADECE gecerli bir JSON dizisi dondur: ["gonderi 1...", "gonderi 2...", "gonderi 3..."]
2. Her gonderi birbirinden FARKLI olmali (farkli acilar, farkli giris cumleleri)
3. Her gonderi 100-500 karakter arasinda olmali (YouTube Community Post limiti)
4. Uygun emojiler kullan ama abartma
5. Markdown kod bloku (backtick) KULLANMA, sadece duz JSON dizisi dondur
6. Satir aralari icin \\n kullan
7. Her gonderi bagimsiz, tek basina anlamli ve paylasima hazir olmali`;
}

// ── Main Handler ──

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { state } = await req.json();

    if (!state || typeof state !== "object") {
      throw new Error("Missing or invalid 'state' in request body");
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set in Supabase Secrets');
    }

    // Build prompt server-side (client cannot manipulate it)
    const prompt = buildPrompt(state);
    const systemMsg = "You are an expert social media manager for YouTube. Output MUST be a valid JSON array of 3 strings. Do not wrap output in markdown code fences.";

    // Multi-model fallback: try each model, skip on 429
    // Some models (Gemma) don't support system messages, so we prepend it to user prompt
    const models = [
      "google/gemma-3-27b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-4b:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
      "google/gemma-3-12b-it:free",
      "meta-llama/llama-3.2-3b-instruct:free",
    ];

    // Models that support system messages
    const supportsSystem = new Set([
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-4b:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
      "meta-llama/llama-3.2-3b-instruct:free",
    ]);

    let lastError = "";

    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);

        // Build messages based on model capability
        const messages = supportsSystem.has(model)
          ? [
              { role: "system", content: systemMsg },
              { role: "user", content: prompt }
            ]
          : [
              { role: "user", content: systemMsg + "\n\n" + prompt }
            ];
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://yt-gonderi-uzmani.app",
            "X-Title": "YT Gonderi Uzmani",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
          })
        });

        // 429 rate limit — try next model immediately
        if (response.status === 429) {
          console.warn(`429 rate limit for ${model}, trying next...`);
          lastError = `${model} rate limited`;
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error(`API error for ${model}:`, response.status, errText);
          lastError = `${model}: HTTP ${response.status}`;
          continue;
        }

        const data = await response.json();

        // OpenRouter error in body (e.g. provider error)
        if (data.error) {
          console.warn(`Error from ${model}:`, data.error.message);
          lastError = data.error.message || `${model} error`;
          continue;
        }

        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
          console.warn(`Empty response from ${model}`);
          lastError = `${model}: empty response`;
          continue;
        }

        // Success! Parse and return
        console.log(`Success with model: ${model}`);
        const clean = content.replace(/```json/g, "").replace(/```/g, "").trim();
        let posts: string[];

        try {
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed)) {
            posts = parsed;
          } else if (parsed.posts && Array.isArray(parsed.posts)) {
            posts = parsed.posts;
          } else {
            posts = [clean];
          }
        } catch {
          posts = [content];
        }

        return new Response(
          JSON.stringify({ posts }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fetchErr) {
        console.error(`Network error for ${model}:`, fetchErr.message);
        lastError = `${model}: ${fetchErr.message}`;
        continue;
      }
    }

    // All models failed
    const lang = safeStr(state.lang);
    return new Response(
      JSON.stringify({
        error: lang === "tr"
          ? "Tum AI modelleri su an yogun. Lutfen 1-2 dakika bekleyip tekrar deneyin."
          : "All AI models are currently busy. Please wait 1-2 minutes and try again."
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Edge Function error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
