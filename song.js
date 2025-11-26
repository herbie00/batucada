
  const app=document.getElementById('app');
  const themeBtn=document.getElementById('themeBtn');
  const logBtn=document.getElementById('changelogBtn');
  const logPanel=document.getElementById('changelog');
  const headerEl=document.getElementById('hdr');

  function setTheme(m){
    app.setAttribute('data-theme', m);
    try{localStorage.setItem('bat_theme', m);}catch{}
  }
  setTheme(localStorage.getItem('bat_theme')||"");
  themeBtn.onclick=()=>{
    const cur=app.getAttribute('data-theme')||"";
    setTheme(cur==="dark"?"light":cur==="light"?"":"dark");
  };
  logBtn.onclick=()=>{
    logPanel.classList.toggle('open');
    logPanel.scrollIntoView({behavior:'smooth',block:'nearest'});
  };
  function syncHeaderH(){
    document.documentElement.style.setProperty('--header-h', headerEl.offsetHeight + 'px');
  }
  window.addEventListener('resize', syncHeaderH, {passive:true});
  syncHeaderH();

  const el=(s,r=document)=>r.querySelector(s);
  const q=new URLSearchParams(location.search);
  const songDataOverride = (window.SONG_DATA_OVERRIDE || null);
  const baseSlug = songDataOverride?.slug || (q.get('id') || "").trim() || (songDataOverride?.title || "").trim();
  const VERSION = 'v0.5';

  function buildFileNameCandidates(raw){
    const seen = new Set();
    const trimmed = (raw || '').trim();
    if(!trimmed) return [];
    const withoutExt = trimmed.replace(/\.json$/i,'').trim();
    const add = (val)=>{
      const ready = (val || '').trim();
      if(ready) seen.add(ready);
    };

    const normalized = withoutExt.replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
    add(withoutExt);
    add(normalized);
    add(normalized.toLowerCase());
    add(normalized.toUpperCase());
    if(normalized){
      const words = normalized.split(' ').map(word=>{
        if(!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      });
      add(words.join(' '));
      add(normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase());
    }

    return Array.from(seen);
  }
  const sectionsWrap = el('#sections');
  const player = el('#player');
  const audioSrc = el('#audioSrc');
  const audioDebug = el('#audioDebug');
  const songTitle = el('#songTitle');

  let loopRAF=null;
  function clearLoop(){ if(loopRAF) cancelAnimationFrame(loopRAF); loopRAF=null; player.loop=false; }

  function playSegment(start,end){
    clearLoop();
    let s = start !== undefined && start !== "" ? Number(start) : 0;
    let e = end   !== undefined && end   !== "" ? Number(end)   : NaN;
    if(!Number.isFinite(s)) s = 0;

    if(player.readyState === 0){ player.load(); }

    player.pause();
    player.currentTime = Math.max(0,s);

    const p = player.play();
    if(p && p.catch){ p.catch(()=>{}); }

    if(Number.isFinite(e)){
      const startPos = player.currentTime;
      const endPos = Math.max(startPos + 0.25, e);
      const tick=()=>{ if(player.currentTime>=endPos) player.currentTime=startPos; loopRAF=requestAnimationFrame(tick); };
      loopRAF=requestAnimationFrame(tick);
    }
  }

  player.addEventListener('seeking', clearLoop);
  player.addEventListener('ended', clearLoop);

  player.addEventListener('loadedmetadata', ()=>{
    audioDebug.innerHTML = `Audio chargé ✔ (durée&nbsp;: ${player.duration.toFixed(1)} s)`;
  });

  player.addEventListener('error', ()=>{
    const src = audioSrc.src || '(aucun)';
    audioDebug.innerHTML = `<span class="error">Erreur de chargement audio :</span> <code>${src}</code><br>
      Vérifie que le fichier existe bien à cette adresse (casse exacte, dossier, etc.).`;
  });

  function formatTime(sec){
    if(!Number.isFinite(sec)) return "—";
    return sec.toFixed(1).replace('.', ',');
  }

  async function loadSongData(){
    if(songDataOverride){
      return songDataOverride;
    }
    if(!baseSlug){
      sectionsWrap.innerHTML='<p class="error">ParamA"tre manquant : <code>?id=slug</code></p>';
      return null;
    }
    const names = buildFileNameCandidates(baseSlug);

    const tried=[];
    for(const name of names){
      const clean=name.trim(); if(!clean) continue;
      const withExt = /\.json$/i.test(clean) ? clean : `${clean}.json`;
      const encoded = withExt.split('/').map(encodeURIComponent).join('/');
      const url=`songs/${encoded}`;
      tried.push(url);
      try{
        const res=await fetch(url,{cache:'no-cache'});
        if(res.ok){ return await res.json(); }
      }catch(e){}
    }
    const last=tried[tried.length-1] || `songs/${baseSlug}.json`;
    sectionsWrap.innerHTML = `<p class="error">Erreur de chargement de <code>${last}</code>. VAcrifie le nom exact du fichier JSON.</p>`;
    return null;
  }
  const fsOverlay = el('#fsOverlay');
  const fsImage   = el('#fsImage');
  const fsImageWrap = el('#fsImageWrap');
  const fsLabel   = el('#fsLabel');
  const fsTime    = el('#fsTime');
  const fsPrev    = el('#fsPrev');
  const fsNext    = el('#fsNext');
  const fsPlay    = el('#fsPlay');
  const fsClose   = el('#fsClose');
  const fsZoom    = el('#fsZoom');

  let parts = [];
  let fsItems = [];
  let fsIndex = 0;
  let fsZoomed = false;

  function buildFsItems(){
    fsItems = [];
    parts.forEach((p,sectionIndex)=>{
      const imgs = Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []);
      const allowed = ['png','jpg','jpeg','gif','webp','svg'];
      imgs.forEach((src,imageIndex)=>{
        if(!src || typeof src !== 'string') return;
        // strip query/fragment
        const cleaned = src.split(/[?#]/)[0];
        const ext = (cleaned.split('.').pop() || '').toLowerCase();
        // only add common image types to the fullscreen viewer
        if(allowed.includes(ext)){
          fsItems.push({sectionIndex,imageIndex,src});
        }
      });
    });
  }

  function openFullscreenFor(sectionIndex,imageIndex){
    if(!fsItems.length) return;
    const idx = fsItems.findIndex(it => it.sectionIndex===sectionIndex && it.imageIndex===imageIndex);
    if(idx === -1) return;
    fsIndex = idx;
    fsZoomed = false;
    fsImage.classList.remove('zoomed');
    updateZoomButton();
    updateFsView();
    document.body.classList.add('fs-open');
    fsOverlay.classList.add('open');
    fsOverlay.setAttribute('aria-hidden','false');
  }

  function closeFullscreen(){
    fsOverlay.classList.remove('open');
    fsOverlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('fs-open');
  }

  function updateZoomButton(){
    fsZoom.textContent = fsZoomed ? "🔎 Réduire" : "🔍 Zoom";
  }

  function updateFsView(){
    if(!fsItems.length) return;
    const item = fsItems[fsIndex];
    const part = parts[item.sectionIndex];
    if(!part) return;

    fsImage.src = item.src;
    fsImage.alt = part.label || "Partition";

    const totalImgs = Array.isArray(part.images) ? part.images.length : (part.images ? 1 : 0);
    let label = part.label || `Section ${item.sectionIndex+1}`;
    if(totalImgs>1){
      label += ` (${item.imageIndex+1}/${totalImgs})`;
    }
    fsLabel.textContent = label;
    fsTime.textContent = `Repère : ${formatTime(part.start)} s → ${formatTime(part.end)} s`;

    const prevSectionIndex = item.sectionIndex>0 ? item.sectionIndex-1 : null;
    const nextSectionIndex = item.sectionIndex < parts.length-1 ? item.sectionIndex+1 : null;

    if(prevSectionIndex===null){
      fsPrev.textContent = '';
      fsPrev.classList.add('disabled');
    }else{
      const pPrev = parts[prevSectionIndex];
      fsPrev.textContent = `← ${pPrev.label || 'Section'} • ${formatTime(pPrev.start)}–${formatTime(pPrev.end)} s`;
      fsPrev.classList.remove('disabled');
    }

    if(nextSectionIndex===null){
      fsNext.textContent = '';
      fsNext.classList.add('disabled');
    }else{
      const pNext = parts[nextSectionIndex];
      fsNext.textContent = `${pNext.label || 'Section'} • ${formatTime(pNext.start)}–${formatTime(pNext.end)} s →`;
      fsNext.classList.remove('disabled');
    }

    if(fsZoomed){
      fsImageWrap.scrollLeft = 0;
      fsImageWrap.scrollTop = 0;
    }
  }

  function showFsIndex(newIndex){
    if(!fsItems.length) return;
    if(newIndex<0 || newIndex>=fsItems.length) return;
    fsIndex = newIndex;
    updateFsView();
  }

  fsClose.addEventListener('click', closeFullscreen);
  fsOverlay.addEventListener('click', (e)=>{
    if(e.target === fsOverlay){ closeFullscreen(); }
  });
  document.addEventListener('keydown', (e)=>{
    if(!fsOverlay.classList.contains('open')) return;
    if(e.key === 'Escape'){ closeFullscreen(); }
    if(e.key === 'ArrowLeft' && !fsZoomed){ showFsIndex(fsIndex-1); }
    if(e.key === 'ArrowRight' && !fsZoomed){ showFsIndex(fsIndex+1); }
  });

  fsPrev.addEventListener('click', ()=>{
    const currentSection = fsItems[fsIndex]?.sectionIndex;
    if(currentSection == null || currentSection<=0) return;
    const targetSection = currentSection-1;
    const idx = fsItems.findIndex(it=>it.sectionIndex===targetSection);
    if(idx>=0) showFsIndex(idx);
  });
  fsNext.addEventListener('click', ()=>{
    const currentSection = fsItems[fsIndex]?.sectionIndex;
    if(currentSection == null || currentSection>=parts.length-1) return;
    const targetSection = currentSection+1;
    const idx = fsItems.findIndex(it=>it.sectionIndex===targetSection);
    if(idx>=0) showFsIndex(idx);
  });
  fsPlay.addEventListener('click', ()=>{
    const item = fsItems[fsIndex];
    if(!item) return;
    const part = parts[item.sectionIndex];
    if(!part) return;
    playSegment(part.start, part.end);
  });
  fsZoom.addEventListener('click', ()=>{
    fsZoomed = !fsZoomed;
    fsImage.classList.toggle('zoomed', fsZoomed);
    updateZoomButton();
    if(fsZoomed){
      fsImageWrap.scrollLeft = 0;
      fsImageWrap.scrollTop = 0;
    }
  });

  let touchStartX=null, touchStartY=null;
  fsOverlay.addEventListener('touchstart', (e)=>{
    if(fsZoomed){ touchStartX=null; touchStartY=null; return; }
    if(e.touches.length!==1) return;
    const t=e.touches[0];
    touchStartX=t.clientX;
    touchStartY=t.clientY;
  }, {passive:true});
  fsOverlay.addEventListener('touchend', (e)=>{
    if(fsZoomed) return;
    if(touchStartX===null) return;
    const t=e.changedTouches[0];
    const dx=t.clientX-touchStartX;
    const dy=t.clientY-touchStartY;
    const absX=Math.abs(dx), absY=Math.abs(dy);
    touchStartX=touchStartY=null;
    if(absX<40 || absX<absY) return;
    if(dx<0){ showFsIndex(fsIndex+1); }
    else{ showFsIndex(fsIndex-1); }
  }, {passive:true});

  async function init(){
    const data = await loadSongData();
    if(!data) return;

    songTitle.textContent = data.title || baseSlug;
    document.title = `Batucada - ${songTitle.textContent}`;
    parts = data.parts || [];

    if(data.audio){
      audioSrc.src = data.audio;
      player.load();
      const href = new URL(data.audio, window.location.href).toString();
      audioDebug.innerHTML = `Chemin audio : <code>${data.audio}</code> — <a href="${href}" target="_blank" rel="noopener">Tester le fichier audio</a>`;
    }else{
      audioDebug.innerHTML = `<span class="error">Aucun chemin audio défini dans le JSON.</span>`;
    }

    sectionsWrap.innerHTML='';
    parts.forEach((p, idx)=>{
      const art=document.createElement('article');
      art.className='part';
      art.setAttribute('tabindex','0');
      if(p.start !== undefined) art.dataset.start = p.start;
      if(p.end   !== undefined) art.dataset.end   = p.end;

      const label = p.label || `Partie ${idx+1}`;
      const startTxt = Number.isFinite(p.start) ? Number(p.start).toFixed(1) : '—';
      const endTxt   = Number.isFinite(p.end)   ? ` • fin : ${Number(p.end).toFixed(1)} s` : '';

      const imgs = Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []);
      const firstImg = imgs.length ? imgs[0] : null;

      art.innerHTML = `
        <div class="partHead">
          <button class="playbtn" type="button">▶</button>
          <h3>${label}</h3>
        </div>
        ${firstImg ? `
          <figure class="sheet hasimg" aria-label="${label}">
            <img src="${firstImg}" alt="${label}" loading="lazy" decoding="async">
          </figure>
        ` : `
          <figure class="sheet noimg" aria-label="${label}">
            <span class="label">${label}</span>
          </figure>
        `}
        <div class="meta"><span class="dot"></span> Repère : ${startTxt} s${endTxt}</div>
      `;

      const doPlay = ()=> playSegment(p.start, p.end);
      art.querySelector('.playbtn').addEventListener('click', doPlay);
      art.querySelector('h3').addEventListener('click', doPlay);

      const fig = art.querySelector('figure.sheet.hasimg');
      if(fig){
        fig.dataset.secIndex = idx;
        fig.dataset.imgIndex = 0;
        fig.addEventListener('click', (e)=>{
          e.stopPropagation();
          const sec = parseInt(fig.dataset.secIndex,10) || 0;
          const imgIndex = parseInt(fig.dataset.imgIndex,10) || 0;
          openFullscreenFor(sec,imgIndex);
        });
      }

      sectionsWrap.appendChild(art);
    });

    buildFsItems();

    sectionsWrap.addEventListener('click', (e)=>{
      let t=e.target;
      while(t && t!==sectionsWrap){
        if(t.classList && t.classList.contains('part')){
          const ds=t.dataset;
          playSegment(ds.start, ds.end);
          return;
        }
        t=t.parentElement;
      }
    });

    sectionsWrap.addEventListener('keydown', (e)=>{
      if(e.key!=='Enter' && e.key!==' ') return;
      let t=e.target;
      while(t && t!==sectionsWrap){
        if(t.classList && t.classList.contains('part')){
          e.preventDefault();
          const ds=t.dataset;
          playSegment(ds.start, ds.end);
          return;
        }
        t=t.parentElement;
      }
    });
  }

  init();







