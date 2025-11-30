(function(){
  const DATA_URL = 'MasterSongPages.json';
  const slugFromQuery = () => {
    const params = new URLSearchParams(location.search);
    return params.get('song') || params.get('slug') || params.get('s');
  };
  const getSlug = () => window.SONG_TEMPLATE_SLUG || slugFromQuery();

  function showError(message){
    const target = document.getElementById('errorMessage');
    if(target){
      target.innerHTML = `<p class="error">${message}</p>`;
    }
  }

  function buildCards(items, slug, caption, fallbackMessage){
    if(!Array.isArray(items) || !items.length){
      return `<p class="note">${fallbackMessage}</p>`;
    }
    const cards = items.map((item, index)=>{
      const playerId = `${slug}-${caption}-${index}`;
      let mediaMarkup = '';
      if(item.type === 'audio' || item.type === 'video'){
        const tag = item.type;
        const mime = item.mime || (tag === 'audio' ? 'audio/mpeg' : 'video/mp4');
        const extraStyle = tag === 'video'? 'style="height:auto;max-height:220px;object-fit:contain;background:#000"' : '';
        mediaMarkup = `
          <${tag} id="${playerId}" controls preload="metadata" ${extraStyle}>
            <source src="${item.src}" type="${mime}" />
            Votre navigateur ne supporte pas la balise ${tag}.
          </${tag}>
        `;
      } else if(item.type === 'link'){
        mediaMarkup = `
          <a class="extra-link" href="${item.href}" download target="_blank" rel="noreferrer">
            ${item.linkLabel || 'Télécharger'}
          </a>
        `;
      }
      const noteLine = item.note ? `<p class="note" style="margin:0;">${item.note}</p>` : '';
      const hasPlayer = item.type === 'audio' || item.type === 'video';
      const controls = hasPlayer ? `
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="extra-skip" data-target="${playerId}" data-offset="-10" aria-label="Reculer 10 secondes">-10s</button>
          <button class="extra-skip" data-target="${playerId}" data-offset="10" aria-label="Avancer 10 secondes">+10s</button>
        </div>
      ` : '';
      return `
        <article class="extra-card">
          <div class="title">${item.title}</div>
          <div>${mediaMarkup}</div>
          ${noteLine}
          ${controls}
        </article>
      `;
    }).join('');
    return `<div class="extra-grid">${cards}</div>`;
  }

  function renderLives(items, slug){
    const container = document.getElementById('livesContainer');
    if(!container){ return; }
    container.innerHTML = buildCards(items, slug || 'lives', 'lives', 'Aucun enregistrement live supplémentaire pour le moment.');
  }

  function renderInstruments(items, slug){
    const container = document.getElementById('instrumentsContainer');
    if(!container){ return; }
    container.innerHTML = buildCards(items, slug || 'instr', 'instruments', 'Pas encore de pistes individuelles disponibles pour ce morceau.');
  }

  function setupTabs(slug){
    const TAB_KEY = `batucada.tab.${slug || 'song'}`;
    const buttons = [...document.querySelectorAll('[data-tab-btn]')];
    const sections = [...document.querySelectorAll('[data-tabs]')];
    function activate(name){
      buttons.forEach(btn=>{
        const active = btn.dataset.tabBtn===name;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.setAttribute('tabindex', active ? '0' : '-1');
      });
      sections.forEach(section=>{
        const list = (section.dataset.tabs||'').split(/\s+/);
        section.hidden = !list.includes(name);
      });
      try{ localStorage.setItem(TAB_KEY, name); }catch{}
    }
    buttons.forEach(btn=>{
      btn.addEventListener('click', ()=> activate(btn.dataset.tabBtn));
      btn.addEventListener('keydown', e=>{
        if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
        e.preventDefault();
        const dir = e.key==='ArrowRight'?1:-1;
        const idx = buttons.indexOf(btn);
        const next = buttons[(idx+dir+buttons.length)%buttons.length];
        next.focus();
        activate(next.dataset.tabBtn);
      });
    });
    activate(localStorage.getItem(TAB_KEY) || 'principal');
  }

  function buildGallery(){
    const gallery = document.getElementById('imagesGallery');
    if(!gallery) return;
    const data = window.SONG_DATA_OVERRIDE && Array.isArray(window.SONG_DATA_OVERRIDE.parts) ? window.SONG_DATA_OVERRIDE.parts : [];
    const seen = new Set();
    const items = [];
    data.forEach(part=>{
      (part.images||[]).forEach(src=>{
        if(!src || seen.has(src)) return;
        seen.add(src);
        items.push({ src, label: part.label || 'Image' });
      });
    });
    if(!items.length){
      gallery.innerHTML = '<p class="note">Aucune image disponible.</p>';
      return;
    }
    gallery.innerHTML = items.map(item=>`
      <article class="imageCard">
        <img src="${item.src}" alt="${item.label}">
        <span>${item.label}</span>
      </article>
    `).join('');
  }

  function attachExtraSkipHandlers(){
    function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
    document.querySelectorAll('.extra-skip').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const targetId = btn.dataset.target;
        const offset = Number(btn.dataset.offset) || 0;
        const p = document.getElementById(targetId);
        if(!p) return;
        try{
          const cur = Number(p.currentTime) || 0;
          const dur = Number(p.duration) || Infinity;
          const next = clamp(cur + offset, 0, isFinite(dur) ? dur : cur + offset);
          p.currentTime = next;
        }catch(err){ }
      });
    });
  }

  function renderChangelog(entries){
    const list = document.getElementById('changelogList');
    if(!list) return;
    list.innerHTML = (entries || []).map(entry=>`
      <li><strong>${entry.version}</strong> - ${entry.text}</li>
    `).join('');
  }

  function loadSongScript(){
    const script = document.createElement('script');
    script.src = 'song.js';
    script.defer = true;
    document.body.appendChild(script);
  }

  async function init(){
    try{
      const response = await fetch(DATA_URL, { cache: 'no-cache' });
      if(!response.ok){ throw new Error('Impossible de charger les données des morceaux.'); }
      const payload = await response.json();
      const slug = getSlug();
      const song = (payload.songs || []).find(item=>item.slug === slug) || (payload.songs || [])[0];
      if(!song){ throw new Error('Chanson introuvable dans MasterSongPages.json.'); }
      const title = song.title || song.slug || 'Morceau';
      document.getElementById('songTitle').textContent = title;
      document.title = `Batucada • ${title}`;
      window.SONG_DATA_OVERRIDE = {
        slug: song.slug,
        title,
        audio: song.audio,
        parts: song.parts || []
      };
      renderLives(song.lives || [], song.slug);
      renderInstruments(song.instruments || [], song.slug);
      const notesField = document.getElementById('notesField');
      if(notesField){
        notesField.value = song.notes || '';
        if(song.notes){ notesField.setAttribute('placeholder', ''); }
      }
      renderChangelog(payload.changelog);
      setupTabs(song.slug);
      buildGallery();
      attachExtraSkipHandlers();
      loadSongScript();
    }catch(err){
      console.error('template load error', err);
      showError(err.message || 'Erreur inconnue.');
    }
  }

  init();
})();
