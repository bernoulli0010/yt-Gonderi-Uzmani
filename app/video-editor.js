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
  // -- Header Buttons --
  document.getElementById('newVideoBtn').addEventListener('click', () => {
    if (confirm("Mevcut projeyi silip yeni bir video başlatmak istiyor musunuz?")) {
      projectState.title = "Başlıksız Proje";
      document.getElementById('projectTitle').value = projectState.title;
      projectState.scenes = [{
        id: generateId(), text: "", voice: "speech-01", media: null, duration: 5.0, autoSearched: false
      }];
      projectState.activeSceneId = projectState.scenes[0].id;
      projectState.currentTime = 0;
      updateTotalDuration();
      renderScenes();
      renderTimeline();
    }
  });

  document.getElementById('exportVideoBtn').addEventListener('click', () => {
    // Show Export Modal
    const modalHtml = `
      <div id="exportModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;">
        <div style="background:var(--bg); padding:24px; border-radius:var(--radius); width:400px; box-shadow:var(--shadow-md);">
          <h3 style="margin-bottom:16px;">Video Oluştur</h3>
          <div style="margin-bottom:16px;">
            <label style="display:block; margin-bottom:8px; font-weight:600; font-size:14px;">Çözünürlük</label>
            <select id="exportResolution" style="width:100%; padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border); background:var(--bg); color:var(--text);">
              <option value="1280x720">720p (Hızlı)</option>
              <option value="1920x1080" selected>1080p (Önerilen)</option>
              <option value="3840x2160">4K (En Yüksek Kalite)</option>
            </select>
          </div>
          <div id="exportProgress" style="display:none; margin-bottom:16px;">
             <p style="font-size:13px; font-weight:600; color:var(--text);">İşleniyor: <span id="exportStatusText">Başlıyor...</span></p>
             <div style="width:100%; height:6px; background:var(--border); border-radius:3px; margin-top:6px; overflow:hidden;">
                <div id="exportProgressBar" style="width:0%; height:100%; background:var(--brand); transition:width 0.3s ease;"></div>
             </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
            <button onclick="document.getElementById('exportModal').remove()" class="btn-secondary" id="cancelExportBtn">İptal</button>
            <button id="startExportBtn" class="btn-primary">Oluştur ve İndir</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('startExportBtn').addEventListener('click', async () => {
      const res = document.getElementById('exportResolution').value;
      
      // Prevent multiple clicks
      document.getElementById('startExportBtn').disabled = true;
      document.getElementById('cancelExportBtn').disabled = true;
      document.getElementById('exportProgress').style.display = 'block';
      
      await performVideoExport(res);
    });
  });

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

  // Timeline Buttons
  document.querySelectorAll('.timeline-tools .btn-text').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = e.currentTarget.textContent.trim();
      if (action === "Ekle") {
        document.getElementById('addSceneBtn').click();
      } else if (action === "Sil") {
        if (projectState.scenes.length > 1) {
          projectState.scenes = projectState.scenes.filter(s => s.id !== projectState.activeSceneId);
          projectState.activeSceneId = projectState.scenes[0].id;
          updateTotalDuration();
          renderScenes();
          renderTimeline();
        } else {
          alert("En az bir bölüm olmak zorunda.");
        }
      } else if (action === "Böl") {
        alert("Böl (Split) özelliği için zaman çizelgesi üzerinde bir noktaya tıklamalısınız. (Yakında)");
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

  // Trigger properties panel on load
  if (projectState.scenes.length > 0) renderPropertiesPanel();

  // Manual Media Search
  const searchInput = document.getElementById('mediaSearchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchAllMedia(e.target.value, true);
      }
    });
  }

  // Zoom Slider
  const zoomSlider = document.querySelector('.zoom-slider');
  if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
      document.querySelector('.control-text').textContent = e.target.value + '%';
    });
  }

  // Change Aspect Ratio
  const aspectBtn = document.getElementById('changeAspectBtn');
  if (aspectBtn) {
    let aspects = ['16/9', '9/16', '1/1'];
    let currentAspect = 0;
    aspectBtn.addEventListener('click', () => {
      currentAspect = (currentAspect + 1) % aspects.length;
      document.getElementById('videoPreviewPlayer').style.aspectRatio = aspects[currentAspect];
      aspectBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect></svg> ${aspects[currentAspect]}`;
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
      renderPropertiesPanel();
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:4px;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
        </div>
        ${mediaThumbHtml}
      </div>
      <div class="scene-body">
        <textarea class="scene-textarea" placeholder="Bu bölüm için senaryonuzu yazın..." data-id="${scene.id}">${scene.text}</textarea>
        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
           <button class="btn-secondary mini" onclick="generateTTS('${scene.id}')" title="Sesi Oluştur" style="font-size: 11px; padding: 4px 8px; border-radius: 4px;">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
             Seslendir
           </button>
        </div>
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
  { id: "male-qn-qingse", label: "Qingse (Male)", gender: "Male" },
  { id: "female-shaonv", label: "Shaonv (Female)", gender: "Female" },
  { id: "speech-01", label: "Speech-01", gender: "Unknown" },
  { id: "speech-02", label: "Speech-02", gender: "Unknown" }
];

function openVoiceSelector(sceneId) {
  // Check if voice selector modal exists, if not create it
  let modal = document.getElementById('voiceSelectorModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'voiceSelectorModal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';
    
    let optionsHtml = '';
    MINIMAX_VOICES.forEach(voice => {
      optionsHtml += `
        <div class="voice-option" onclick="selectVoice('${voice.id}')" style="padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; color: var(--text);">${voice.label}</span>
          <span style="font-size: 11px; padding: 2px 6px; background: var(--bg-page); border-radius: 4px; color: var(--text-muted);">${voice.gender}</span>
        </div>
      `;
    });

    modal.innerHTML = `
      <div style="background: var(--bg); width: 400px; border-radius: var(--radius); box-shadow: var(--shadow-md); overflow: hidden;">
        <div style="padding: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 16px;">Ses Seçimi</h3>
          <button onclick="document.getElementById('voiceSelectorModal').style.display='none'" class="btn-icon mini"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <div style="max-height: 300px; overflow-y: auto;">
          ${optionsHtml}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  // Store the target scene ID globally so we know which one to update
  window.currentVoiceSceneId = sceneId;
  modal.style.display = 'flex';
}

window.selectVoice = function(voiceId) {
  const scene = projectState.scenes.find(s => s.id === window.currentVoiceSceneId);
  if (scene) {
    scene.voice = voiceId;
    // Update the label in the UI
    const label = document.getElementById(`voice-label-${scene.id}`);
    if (label) label.textContent = voiceId;
    
    // Update right panel if it's open
    renderPropertiesPanel();
  }
  document.getElementById('voiceSelectorModal').style.display = 'none';
};

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

// -- Right Panel (Properties) --
function renderPropertiesPanel() {
  const panel = document.getElementById('propertiesPanel');
  const activeScene = projectState.scenes.find(s => s.id === projectState.activeSceneId);

  if (!activeScene) {
    panel.innerHTML = `<div class="properties-empty"><p>Buradan bir varlık veya bölümü seçerek özelliklerini düzenleyin.</p></div>`;
    return;
  }

  const idx = projectState.scenes.indexOf(activeScene) + 1;
  const wordCount = activeScene.text.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  panel.innerHTML = `
    <div style="padding: 16px 20px; border-bottom: 1px solid var(--border);">
      <h3 style="font-size:15px; margin:0; font-weight:700;">Bölüm ${idx} Özellikleri</h3>
    </div>
    <div style="padding: 20px; display:flex; flex-direction:column; gap:20px; font-size:13px;">
      <div>
        <label style="color:var(--text-muted); font-weight:600; display:block; margin-bottom:8px;">Süre (Saniye)</label>
        <input type="number" value="${activeScene.duration.toFixed(1).replace('.', ',')}" step="0.5" min="1" onchange="updateSceneDuration(this.value.replace(',', '.'), '${activeScene.id}')" style="width:100%; padding:10px 12px; border-radius:6px; border:1px solid var(--border); background:var(--bg-page); color:var(--text); font-weight:500;">
      </div>
      <div>
        <label style="color:var(--text-muted); font-weight:600; display:block; margin-bottom:8px;">Kelime Sayısı</label>
        <div style="color:var(--text); font-weight:500;">${wordCount} kelime</div>
      </div>
      <div>
        <label style="color:var(--text-muted); font-weight:600; display:block; margin-bottom:8px;">Arka Plan Medya</label>
        <div style="display:flex; align-items:center; gap:8px;">
           ${activeScene.media ? `<img src="${activeScene.media.thumbnail}" style="width:60px; height:34px; object-fit:cover; border-radius:4px;"> <span style="font-size:11px; color:var(--text-muted);">${activeScene.media.source}</span>` : `<span style="color:#ef5350; font-weight:500;">Yok</span>`}
        </div>
        ${activeScene.media ? `<button class="btn-secondary mini" style="margin-top:8px; width:100%;" onclick="clearSceneMedia('${activeScene.id}')">Kaldır</button>` : ''}
      </div>
      <div>
        <label style="color:var(--text-muted); font-weight:600; display:block; margin-bottom:8px;">Seçili Ses</label>
        <div style="padding:10px 12px; border:1px solid var(--border); border-radius:6px; background:var(--bg-page); color:var(--text); font-weight:500; cursor:pointer;" onclick="openVoiceSelector('${activeScene.id}')">
          ${activeScene.voice}
        </div>
      </div>
    </div>
  `;
}

window.updateSceneDuration = (val, id) => {
  const scene = projectState.scenes.find(s => s.id === id);
  if (scene) {
    scene.duration = parseFloat(val);
    updateTotalDuration();
    renderTimeline();
  }
};

window.clearSceneMedia = (id) => {
  const scene = projectState.scenes.find(s => s.id === id);
  if (scene) {
    scene.media = null;
    scene.autoSearched = false;
    renderScenes();
    renderTimeline();
    updatePreview();
    renderPropertiesPanel();
  }
};

// -- FFmpeg.wasm Export System --
async function performVideoExport(resolution) {
  const { FFmpeg } = window.FFmpeg;
  const { fetchFile } = window.FFmpegUtil;
  const ffmpeg = new FFmpeg();

  const statusEl = document.getElementById('exportStatusText');
  const progressEl = document.getElementById('exportProgressBar');

  // Check if we have media to export
  const scenesWithMedia = projectState.scenes.filter(s => s.media);
  if (scenesWithMedia.length === 0) {
    alert("Dışa aktarılacak hiçbir medya (video) bulunamadı. Lütfen önce videoya sahne ekleyin.");
    document.getElementById('exportModal').remove();
    return;
  }

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });
  
  ffmpeg.on('progress', ({ progress }) => {
    // progress goes from 0 to 1
    const p = Math.round(progress * 100);
    progressEl.style.width = `${p}%`;
    statusEl.textContent = `%${p} tamamlandı...`;
  });

  try {
    statusEl.textContent = "FFmpeg Çekirdeği Yükleniyor...";
    await ffmpeg.load({
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
      wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm"
    });

    // 1. Download and Write Files to FFmpeg FS
    let concatFilter = '';
    let inputs = [];
    
    for (let i = 0; i < scenesWithMedia.length; i++) {
      const scene = scenesWithMedia[i];
      statusEl.textContent = `Medya indiriliyor (${i + 1}/${scenesWithMedia.length})...`;
      
      // Fetch the video file (CORS can be tricky but Pexels/Pixabay direct URLs usually allow it)
      const vidData = await fetchFile(scene.media.url);
      const inputName = `input_${i}.mp4`;
      await ffmpeg.writeFile(inputName, vidData);
      
      inputs.push(`-i`);
      inputs.push(inputName);
      
      // Resize to selected resolution (1080p etc.), set DAR to 16:9, trim to scene.duration, and re-encode audio
      // Format: [0:v]scale=1920:1080,setdar=16/9,trim=duration=5[v0];
      concatFilter += `[${i}:v]scale=${resolution}:force_original_aspect_ratio=decrease,pad=${resolution}:(ow-iw)/2:(oh-ih)/2,setdar=16/9,trim=duration=${scene.duration}[v${i}];`;
    }

    // 2. Concat the streams
    statusEl.textContent = "Sahneler Birleştiriliyor (Render ediliyor)... Bu biraz zaman alabilir.";
    
    let concatStreamInputs = '';
    for (let i = 0; i < scenesWithMedia.length; i++) {
      concatStreamInputs += `[v${i}]`;
    }
    concatFilter += `${concatStreamInputs}concat=n=${scenesWithMedia.length}:v=1:a=0[outv]`;

    const args = [
      ...inputs,
      '-filter_complex', concatFilter,
      '-map', '[outv]',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-t', projectState.totalDuration.toString(),
      'output.mp4'
    ];

    console.log("Running FFmpeg with args:", args);
    await ffmpeg.exec(args);

    statusEl.textContent = "Video indiriliyor...";
    
    // 3. Read Output and Download
    const data = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectState.title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    document.getElementById('exportModal').remove();
    alert("Video başarıyla oluşturuldu ve bilgisayarınıza indirildi!");

  } catch (err) {
    console.error("FFmpeg Export Error:", err);
    alert("Video oluşturulurken bir hata oluştu: " + err.message + "\n(Tarayıcı CORS politikaları nedeniyle medya indirilememiş olabilir.)");
    document.getElementById('exportModal').remove();
  }
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
      // Ensure the video plays immediately if we just assigned it
      player.play().catch(e => console.log("Auto-play prevented by browser policy", e));
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
