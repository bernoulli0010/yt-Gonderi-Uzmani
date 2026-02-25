/**
 * Video Production Line (Video Üretim Hattı)
 * Core Logic & State Management
 */

// API Keys provided by user
const PEXELS_API_KEY = "xaKuGpofQUgZYx6JlPEZJdqhgUnsUu8ZpJmbT4tnhA0J2Rpb5vO3ibx0";
const PIXABAY_API_KEY = "54799067-a3fed06a32d899bc1ede143be";

// State Management
let projectState = {
  title: "Başlıksız",
  scenes: [
    {
      id: generateId(),
      text: "Dose control matters. Limit consumption to one ounce daily...",
      voice: "speech-01", // Minimax voice ID
      media: null, // { type: 'video', url: '...', thumbnail: '...', duration: 5 }
      duration: 5.0, // estimated duration in seconds
      autoSearched: false
    }
  ],
  activeSceneId: null,
  isPlaying: false,
  currentTime: 0,
  totalDuration: 5.0
};

const SUPABASE_URL = "https://bjcsbuvjumaigvsjphor.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ws-ubr-U3Uryo-oJxE0rvg_QTlz2Kqa";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  projectState.activeSceneId = projectState.scenes[0].id;
  
  initUI();
  bindEvents();
  renderScenes();
  renderTimeline();
  
  // Auto-search for the initial scene if it has text
  if (projectState.scenes[0].text && !projectState.scenes[0].media) {
    autoSearchMediaForScene(projectState.scenes[0]);
  }
});

// -- Utility Functions --
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// -- UI Initialization & Events --
function initUI() {
  document.getElementById('projectTitle').value = projectState.title;
}

function bindEvents() {
  // Tabs
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('is-active'));
      e.currentTarget.classList.add('is-active');
      
      const panel = e.currentTarget.getAttribute('data-panel');
      
      // Hide all panels
      document.getElementById('activePanelContent').style.display = 'none';
      document.getElementById('medyaPanelContent').style.display = 'none';
      
      if (panel === 'senaryo') {
        document.getElementById('activePanelContent').style.display = 'flex';
      } else if (panel === 'medya') {
        document.getElementById('medyaPanelContent').style.display = 'flex';
        // Trigger generic search if empty
        if (document.getElementById('mediaGrid').innerHTML.trim() === '') {
          searchAllMedia("nature", true);
        }
      } else {
        // Fallback for others
        document.getElementById('activePanelContent').style.display = 'flex';
        document.querySelector('#activePanelContent .panel-title').textContent = panel.charAt(0).toUpperCase() + panel.slice(1);
      }
    });
  });

  // Add Scene
  document.getElementById('addSceneBtn').addEventListener('click', () => {
    const newScene = {
      id: generateId(),
      text: "",
      voice: "speech-01",
      media: null,
      duration: 3.0,
      autoSearched: false
    };
    projectState.scenes.push(newScene);
    projectState.activeSceneId = newScene.id;
    updateTotalDuration();
    renderScenes();
    renderTimeline();
  });

  // Play/Pause
  document.getElementById('playBtn').addEventListener('click', togglePlay);

  // Manual Media Search
  const searchInput = document.getElementById('mediaSearchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchAllMedia(e.target.value, true);
      }
    });
  }
}

// -- Scene Management --
function renderScenes() {
  const container = document.getElementById('scenesList');
  container.innerHTML = '';

  projectState.scenes.forEach((scene, index) => {
    const isActive = scene.id === projectState.activeSceneId;
    
    const sceneEl = document.createElement('div');
    sceneEl.className = `scene-item ${isActive ? 'is-active' : ''}`;
    sceneEl.onclick = (e) => {
      // Prevent clicking textarea from instantly re-triggering if already active
      if (!isActive) {
        projectState.activeSceneId = scene.id;
        renderScenes(); // re-render to update active state
        updatePreview();
      }
    };

    let mediaThumbHtml = '';
    if (scene.media) {
       mediaThumbHtml = `<img src="${scene.media.thumbnail}" style="width: 40px; height: 24px; object-fit: cover; border-radius: 2px; margin-left: auto;" />`;
    }

    sceneEl.innerHTML = `
      <div class="scene-header">
        <div class="scene-title-group">
          <span>Bölüm ${index + 1}</span>
          <div class="scene-voice" onclick="openVoiceSelector('${scene.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            <span id="voice-label-${scene.id}">${scene.voice}</span>
          </div>
          <button class="btn-icon mini" onclick="generateTTS('${scene.id}')" title="Sesi Oluştur" style="width:24px;height:24px;padding:0;">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
        ${mediaThumbHtml}
      </div>
      <div class="scene-body">
        <textarea class="scene-textarea" placeholder="Bu bölüm için senaryonuzu yazın..." data-id="${scene.id}">${scene.text}</textarea>
        <audio id="audio-${scene.id}" style="display:none;"></audio>
      </div>
    `;

    container.appendChild(sceneEl);

    // Bind textarea
    const textarea = sceneEl.querySelector('.scene-textarea');
    textarea.addEventListener('input', handleTextChange);
  });

  updatePreview();
}

const handleTextChange = debounce((e) => {
  const sceneId = e.target.getAttribute('data-id');
  const scene = projectState.scenes.find(s => s.id === sceneId);
  if (scene) {
    const oldText = scene.text;
    scene.text = e.target.value;
    
    // Estimate duration based on word count (roughly 2.5 words per second)
    const wordCount = scene.text.trim().split(/\s+/).filter(w => w.length > 0).length;
    scene.duration = Math.max(3.0, wordCount / 2.5); // Minimum 3 seconds
    
    updateTotalDuration();
    renderTimeline();
    
    // Auto-search logic: if text changed significantly and no media or not auto-searched yet
    if (scene.text.length > 10 && (!scene.media || !scene.autoSearched)) {
      autoSearchMediaForScene(scene);
    }
  }
}, 1000); // 1 second debounce

// -- Voice & TTS Management --
const MINIMAX_VOICES = [
  { id: "speech-01", label: "Speech 01 (Female)", gender: "Female" },
  { id: "speech-02", label: "Speech 02 (Male)", gender: "Male" },
  { id: "speech-03", label: "Speech 03 (Female)", gender: "Female" },
  { id: "speech-04", label: "Speech 04 (Male)", gender: "Male" }
];

function openVoiceSelector(sceneId) {
  const scene = projectState.scenes.find(s => s.id === sceneId);
  const voice = prompt("Bir ses ID'si girin (örn: speech-01, speech-02, speech-03, speech-04):\nMevcut ses: " + scene.voice, scene.voice);
  
  if (voice && voice.trim() !== "") {
    scene.voice = voice.trim();
    document.getElementById(`voice-label-${scene.id}`).textContent = scene.voice;
  }
}

async function generateTTS(sceneId) {
  const scene = projectState.scenes.find(s => s.id === sceneId);
  if (!scene || !scene.text.trim()) {
    alert("Önce bu bölüm için bir metin yazmalısınız.");
    return;
  }
  
  const btn = document.querySelector(`.scene-item [onclick="generateTTS('${sceneId}')"]`);
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
  
  try {
    if (!supabaseClient) throw new Error("Supabase is not initialized.");
    
    const { data, error } = await supabaseClient.functions.invoke('minimax-tts', {
      body: { text: scene.text, voice_id: scene.voice }
    });
    
    if (error) throw error;
    if (data.error) throw new Error(data.error);
    
    if (data.data && data.data.audio) {
      // Audio comes back as hex or base64 based on API. Usually base64 or hex.
      // MiniMax T2A V2 returns hex string in `data.audio`
      const hexString = data.data.audio;
      
      // Convert Hex to Base64
      let raw = '';
      for (let i = 0; i < hexString.length; i += 2) {
        raw += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
      }
      const b64 = btoa(raw);
      const audioUrl = "data:audio/mp3;base64," + b64;
      
      const audioEl = document.getElementById(`audio-${scene.id}`);
      audioEl.src = audioUrl;
      
      // Load and update duration
      audioEl.onloadedmetadata = () => {
        scene.duration = Math.max(3.0, audioEl.duration);
        updateTotalDuration();
        renderTimeline();
      };
      
      // Auto-play the generated sound
      audioEl.play();
    }
  } catch (err) {
    console.error("TTS Error:", err);
    alert("Ses oluşturulamadı: " + err.message);
  } finally {
    btn.innerHTML = originalHtml;
  }
}

// -- API Search & Auto-Assign --
async function autoSearchMediaForScene(scene) {
  const words = scene.text.replace(/[^\w\s\ğ\ü\ş\ı\ö\ç\Ğ\Ü\Ş\İ\Ö\Ç]/gi, '').split(/\s+/);
  const meaningfulWords = words.filter(w => w.length > 4);
  
  let query = meaningfulWords.slice(0, 2).join(" ");
  if (!query) query = words.slice(0, 2).join(" ");
  if (!query) query = "nature"; // fallback

  console.log(`Auto-searching Pexels & Pixabay for scene ${scene.id} with query: "${query}"`);
  
  try {
    const results = await fetchAllMedia(query, 3);
    
    if (results && results.length > 0) {
      // Pick the first result from our combined pool
      scene.media = results[0];
      scene.autoSearched = true;
      console.log("Auto-assigned media:", scene.media);
      
      renderScenes(); // Refresh thumbnail in sidebar
      renderTimeline(); // Refresh timeline visuals
      updatePreview(); // Show in player if active
    }
  } catch (err) {
    console.error("Auto-search error:", err);
  }
}

async function searchAllMedia(query, showInPanel = false) {
  try {
    const combinedResults = await fetchAllMedia(query, 10);
    
    if (showInPanel) {
      const grid = document.getElementById('mediaGrid');
      grid.innerHTML = '';
      
      combinedResults.forEach(media => {
        const el = document.createElement('div');
        el.className = 'media-item';
        el.innerHTML = `
          <img src="${media.thumbnail}" alt="Stock Video">
          <div class="media-item-duration">${media.duration}s <span style="font-size:8px; opacity:0.8;">(${media.source})</span></div>
        `;
        el.onclick = () => {
          // Assign to active scene
          const activeScene = projectState.scenes.find(s => s.id === projectState.activeSceneId);
          if (activeScene) {
            activeScene.media = media;
            activeScene.autoSearched = true;
            renderScenes();
            renderTimeline();
            updatePreview();
          }
        };
        grid.appendChild(el);
      });
    }
    return combinedResults;
  } catch (e) {
    console.error("Combined Search Error:", e);
  }
}

async function fetchAllMedia(query, limitPerSource = 5) {
  let results = [];
  
  // 1. Fetch Pexels
  const pexelsPromise = fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${limitPerSource}&orientation=landscape`, {
    headers: { 'Authorization': PEXELS_API_KEY }
  })
  .then(res => res.json())
  .then(data => {
    if (data.videos) {
      return data.videos.map(v => {
        const hdFile = v.video_files.find(f => f.quality === 'hd') || v.video_files[0];
        return {
          type: 'video',
          url: hdFile.link,
          thumbnail: v.image,
          duration: v.duration,
          source: 'Pexels'
        };
      });
    }
    return [];
  })
  .catch(err => {
    console.error("Pexels error:", err);
    return [];
  });

  // 2. Fetch Pixabay
  const pixabayPromise = fetch(`https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=${limitPerSource}&video_type=film`)
  .then(res => res.json())
  .then(data => {
    if (data.hits) {
      return data.hits.map(v => {
        // Pixabay videos have multiple sizes, tiny, small, medium, large
        const vidUrl = v.videos.medium ? v.videos.medium.url : v.videos.tiny.url;
        // Use a snapshot as thumbnail if available, or fetch from picture_id
        const thumb = `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg`;
        return {
          type: 'video',
          url: vidUrl,
          thumbnail: thumb,
          duration: v.duration,
          source: 'Pixabay'
        };
      });
    }
    return [];
  })
  .catch(err => {
    console.error("Pixabay error:", err);
    return [];
  });

  // Wait for both
  const [pexelsResults, pixabayResults] = await Promise.all([pexelsPromise, pixabayPromise]);
  
  // Interleave the results so we get a mix of both platforms
  const maxLength = Math.max(pexelsResults.length, pixabayResults.length);
  for (let i = 0; i < maxLength; i++) {
    if (pixabayResults[i]) results.push(pixabayResults[i]);
    if (pexelsResults[i]) results.push(pexelsResults[i]);
  }
  
  return results;
}

// -- Preview Player --
function updatePreview() {
  const activeScene = projectState.scenes.find(s => s.id === projectState.activeSceneId);
  if (!activeScene) return;

  const player = document.getElementById('mainVideoPlayer');
  const placeholder = document.getElementById('previewPlaceholder');
  const subtitle = document.getElementById('previewSubtitle');
  const badge = document.getElementById('currentSceneBadge');

  badge.textContent = `Bölüm ${projectState.scenes.findIndex(s => s.id === activeScene.id) + 1}`;

  if (activeScene.media) {
    player.style.display = 'block';
    placeholder.style.display = 'none';
    if (player.src !== activeScene.media.url) {
      player.src = activeScene.media.url;
    }
  } else {
    player.style.display = 'none';
    placeholder.style.display = 'flex';
    player.src = '';
  }

  if (activeScene.text) {
    subtitle.innerHTML = `<div class="subtitle-text">${activeScene.text}</div>`;
  } else {
    subtitle.innerHTML = '';
  }
}

// -- Timeline & Playback --
function updateTotalDuration() {
  projectState.totalDuration = projectState.scenes.reduce((acc, scene) => acc + scene.duration, 0);
  document.getElementById('timeDisplay').textContent = `0:00 / ${formatTime(projectState.totalDuration)}`;
}

function renderTimeline() {
  const videoTrack = document.getElementById('videoTrack');
  const audioTrack = document.getElementById('audioTrack');
  videoTrack.innerHTML = '';
  audioTrack.innerHTML = '';
  
  const pixelsPerSecond = 30; // 30px per second for timeline scale
  
  let currentOffset = 0;
  
  projectState.scenes.forEach((scene, index) => {
    const width = scene.duration * pixelsPerSecond;
    
    // Video Clip
    const vClip = document.createElement('div');
    vClip.className = `timeline-clip clip-video ${!scene.media ? 'empty' : ''}`;
    vClip.style.left = `${currentOffset}px`;
    vClip.style.width = `${width}px`;
    if (scene.media) {
      vClip.style.backgroundImage = `url(${scene.media.thumbnail})`;
    }
    vClip.innerHTML = `<span class="clip-label">Bölüm ${index + 1}</span>`;
    
    vClip.onclick = () => {
      projectState.activeSceneId = scene.id;
      renderScenes();
    };
    
    videoTrack.appendChild(vClip);
    
    // Audio Clip (Voiceover placeholder)
    if (scene.text.trim().length > 0) {
      const aClip = document.createElement('div');
      aClip.className = 'timeline-clip clip-audio';
      aClip.style.left = `${currentOffset}px`;
      aClip.style.width = `${width}px`;
      audioTrack.appendChild(aClip);
    }
    
    currentOffset += width;
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

let playbackInterval;
function togglePlay() {
  projectState.isPlaying = !projectState.isPlaying;
  const playIcon = document.querySelector('.icon-play');
  const pauseIcon = document.querySelector('.icon-pause');
  const player = document.getElementById('mainVideoPlayer');
  const currentSceneAudio = document.getElementById(`audio-${projectState.activeSceneId}`);

  if (projectState.isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    
    if (player && player.src) player.play();
    if (currentSceneAudio && currentSceneAudio.src) {
        // Calculate where the audio should be based on scene offset
        let offset = 0;
        for (let s of projectState.scenes) {
            if (s.id === projectState.activeSceneId) break;
            offset += s.duration;
        }
        const audioCurrentTime = projectState.currentTime - offset;
        if (audioCurrentTime >= 0 && audioCurrentTime < currentSceneAudio.duration) {
            currentSceneAudio.currentTime = audioCurrentTime;
            currentSceneAudio.play();
        }
    }
    
    playbackInterval = setInterval(() => {
      projectState.currentTime += 0.1;
      if (projectState.currentTime >= projectState.totalDuration) {
        projectState.currentTime = 0;
        togglePlay(); // Pause at end
      }
      updatePlayhead();
    }, 100);
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    
    if (player && player.src) player.pause();
    if (currentSceneAudio && currentSceneAudio.src) currentSceneAudio.pause();
    
    clearInterval(playbackInterval);
  }
}

function updatePlayhead() {
  const pixelsPerSecond = 30;
  const playhead = document.getElementById('playhead');
  playhead.style.left = `${20 + (projectState.currentTime * pixelsPerSecond)}px`;
  
  document.getElementById('timeDisplay').textContent = `${formatTime(projectState.currentTime)} / ${formatTime(projectState.totalDuration)}`;
  
  // Update active scene based on time
  let timeAccumulator = 0;
  for (let scene of projectState.scenes) {
    timeAccumulator += scene.duration;
      if (projectState.currentTime <= timeAccumulator) {
      if (projectState.activeSceneId !== scene.id) {
        // Pause previous scene's audio
        const oldSceneAudio = document.getElementById(`audio-${projectState.activeSceneId}`);
        if (oldSceneAudio && oldSceneAudio.src) oldSceneAudio.pause();
        
        projectState.activeSceneId = scene.id;
        renderScenes(); // updates UI and preview
        
        // Ensure video and new audio is playing if active
        if (projectState.isPlaying) {
          const player = document.getElementById('mainVideoPlayer');
          if (player.src) player.play();
          
          const newSceneAudio = document.getElementById(`audio-${scene.id}`);
          if (newSceneAudio && newSceneAudio.src) {
             newSceneAudio.currentTime = 0; // restart audio for new scene
             newSceneAudio.play();
          }
        }
      }
      break;
    }
  }
}
