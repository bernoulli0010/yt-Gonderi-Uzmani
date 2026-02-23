import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function safeStr(val: unknown): string {
  if (typeof val === "string") return val.trim();
  return "";
}

// Parse channel ID from various YouTube channel URL formats
async function extractChannelId(query: string): Promise<{ channelId: string; channelName: string } | null> {
  const trimmedQuery = query.trim();
  
  // Direct channel ID
  if (trimmedQuery.startsWith('UC') && trimmedQuery.length > 20) {
    return { channelId: trimmedQuery, channelName: trimmedQuery };
  }
  
  // Handle URL formats
  let url = trimmedQuery;
  if (!url.startsWith('http')) {
    url = `https://youtube.com/${url}`;
  }
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Handle /channel/UC... format
    if (pathname.includes('/channel/')) {
      const match = pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
      if (match) {
        return { channelId: match[1], channelName: match[1] };
      }
    }
    
    // Handle /@handle format - need to fetch page to get channel ID
    if (pathname.includes('/@') || pathname.startsWith('@')) {
      const handle = pathname.replace('/@', '').replace('@', '').split('/')[0];
      // Try to resolve handle to channel ID
      const channelPageUrl = `https://www.youtube.com/@${handle}`;
      const response = await fetch(channelPageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
      });
      
      if (!response.ok) return null;
      
      const html = await response.text();
      // Look for channel ID in the page
      const channelIdMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
      if (channelIdMatch) {
        return { channelId: channelIdMatch[1], channelName: `@${handle}` };
      }
      
      // Alternative pattern
      const altMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/);
      if (altMatch) {
        return { channelId: altMatch[1], channelName: `@${handle}` };
      }
    }
    
    // Handle /c/ or /user/ format
    if (pathname.includes('/c/') || pathname.includes('/user/')) {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });
      
      if (!response.ok) return null;
      
      const html = await response.text();
      const channelIdMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
      if (channelIdMatch) {
        const nameMatch = pathname.match(/\/(c|user)\/([^/]+)/);
        return { channelId: channelIdMatch[1], channelName: nameMatch ? nameMatch[2] : channelIdMatch[1] };
      }
    }
  } catch (e) {
    console.error("URL parse error:", e);
  }
  
  // If just a search term, try searching
  return null;
}

// Fetch channel RSS feed
async function fetchChannelVideos(channelId: string) {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  
  const response = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  
  if (!response.ok) {
    throw new Error(`RSS feed error: ${response.status}`);
  }
  
  const xml = await response.text();
  
  // Parse XML manually (simple regex approach for Deno)
  const titleMatch = xml.match(/<title>([^<]*)<\/title>/);
  const channelName = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Unknown Channel';
  
  // Extract video entries
  const entries: { title: string; videoId: string; publishedAt: string; thumbnail: string }[] = [];
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null && entries.length < 10) {
    const entry = match[1];
    
    const videoTitleMatch = entry.match(/<title>([^<]*)<\/title>/);
    const videoIdMatch = entry.match(/<yt:videoId>([^<]*)<\/yt:videoId>/);
    const publishedMatch = entry.match(/<published>([^<]*)<\/published>/);
    const mediaMatch = entry.match(/<media:thumbnail[^>]*url="([^"]+)"/);
    
    if (videoTitleMatch && videoIdMatch) {
      entries.push({
        title: videoTitleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
        videoId: videoIdMatch[1],
        publishedAt: publishedMatch ? publishedMatch[1] : '',
        thumbnail: mediaMatch ? mediaMatch[1] : `https://i.ytimg.com/vi/${videoIdMatch[1]}/mqdefault.jpg`,
      });
    }
  }
  
  return { channelName, videos: entries };
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    const searchQuery = safeStr(query);

    if (!searchQuery) {
      throw new Error("Channel query is required");
    }

    // Extract channel ID
    const channelInfo = await extractChannelId(searchQuery);
    if (!channelInfo) {
      throw new Error("Channel not found. Please use a valid channel URL, @handle, or channel ID.");
    }

    // Fetch videos
    const { channelName, videos } = await fetchChannelVideos(channelInfo.channelId);
    
    if (videos.length === 0) {
      throw new Error("No videos found for this channel");
    }

    // Analyze content type from video titles
    const titles = videos.map(v => v.title).join(" ");
    const commonWords = titles.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const wordFreq: Record<string, number> = {};
    commonWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return new Response(
      JSON.stringify({
        success: true,
        channelId: channelInfo.channelId,
        channelName,
        channelUrl: `https://youtube.com/channel/${channelInfo.channelId}`,
        videos: videos.slice(0, 5), // Return first 5 videos
        contentKeywords: topWords,
        totalVideos: videos.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("fetch-channel error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
