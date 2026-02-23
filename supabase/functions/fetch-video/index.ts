import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function safeStr(val: unknown): string {
  if (typeof val === "string") return val.trim();
  return "";
}

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Fetch video metadata from YouTube oEmbed
async function fetchVideoMetadata(videoId: string) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`oEmbed API error: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    title: data.title,
    authorName: data.author_name,
    authorUrl: data.author_url,
    thumbnailUrl: data.thumbnail_url,
    type: data.type,
  };
}

// Try to fetch captions/transcript (best effort - may not always work)
async function fetchCaptions(videoId: string): Promise<string | null> {
  try {
    // Try to get caption tracks from YouTube's timedtext endpoint
    const captionUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
    const response = await fetch(captionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!response.ok) return null;
    
    const text = await response.text();
    
    // Look for Turkish or English captions
    const langMatch = text.match(/lang_code="(tr|en)"/);
    if (!langMatch) return null;
    
    // Fetch actual caption content
    const captionContentUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langMatch[1]}`;
    const captionResponse = await fetch(captionContentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!captionResponse.ok) return null;
    
    const captionText = await captionResponse.text();
    
    // Parse XML and extract text content
    const textMatches = captionText.match(/<text[^>]*>([^<]*)<\/text>/g);
    if (!textMatches) return null;
    
    const transcript = textMatches
      .map(match => match.replace(/<text[^>]*>|<\/text>/g, ''))
      .map(text => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
      .join(' ')
      .substring(0, 2000); // Limit length
    
    return transcript;
  } catch (e) {
    console.error("Caption fetch error:", e);
    return null;
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const videoUrl = safeStr(url);

    if (!videoUrl) {
      throw new Error("Video URL is required");
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    // Fetch metadata
    const metadata = await fetchVideoMetadata(videoId);
    
    // Try to get captions
    const captions = await fetchCaptions(videoId);
    
    // Build summary
    let summary = "";
    if (captions) {
      summary = captions.length > 500 
        ? captions.substring(0, 500) + "..."
        : captions;
    } else {
      summary = `Video başlığı: "${metadata.title}". Bu video ${metadata.authorName} kanalında yayınlanmıştır.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        title: metadata.title,
        channel: metadata.authorName,
        channelUrl: metadata.authorUrl,
        thumbnailUrl: metadata.thumbnailUrl,
        summary,
        hasCaptions: !!captions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("fetch-video error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
