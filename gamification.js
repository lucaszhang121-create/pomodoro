// ===== FOCUSOS GAMIFICATION SYSTEM =====
// Shop, Achievements, Streaks, and Planet Progression

const PLAYER_KEY = `focusos_player`;
const DEFAULT_PLAYER = {
  points: 0,
  totalPointsEarned: 0,
  totalFocusSessions: 0,
  totalFocusMinutes: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastSessionDate: null,
  achievementsEarned: [],
  ownedItems: [],
  activePlanet: `mercury`,
  activeCosmetic: null,
  activeSound: null
};

function loadPlayer(){
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return Object.assign({}, DEFAULT_PLAYER, saved);
    }
  } catch(e){}
  return Object.assign({}, DEFAULT_PLAYER);
}

function savePlayer(player){
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

const ACHIEVEMENTS = [
  {id:`first_focus`,  name:`First Light`,      desc:`Complete your first focus session`,   field:`totalFocusSessions`, threshold:1,   points:10},
  {id:`focus_5`,      name:`Getting Warmer`,    desc:`Complete 5 focus sessions`,           field:`totalFocusSessions`, threshold:5,   points:25},
  {id:`focus_25`,     name:`Quarter Century`,   desc:`Complete 25 focus sessions`,          field:`totalFocusSessions`, threshold:25,  points:50},
  {id:`focus_50`,     name:`Half Way There`,    desc:`Complete 50 focus sessions`,          field:`totalFocusSessions`, threshold:50,  points:100},
  {id:`focus_100`,    name:`Centurion`,         desc:`Complete 100 focus sessions`,         field:`totalFocusSessions`, threshold:100, points:200},
  {id:`hour_1`,       name:`First Hour`,        desc:`Study for 1 hour total`,             field:`totalFocusMinutes`,  threshold:60,  points:30},
  {id:`hour_5`,       name:`Deep Diver`,        desc:`Study for 5 hours total`,            field:`totalFocusMinutes`,  threshold:300, points:75},
  {id:`hour_10`,      name:`Time Lord`,         desc:`Study for 10 hours total`,           field:`totalFocusMinutes`,  threshold:600, points:150},
  {id:`streak_3`,     name:`Hat Trick`,         desc:`Maintain a 3-day streak`,            field:`currentStreak`,      threshold:3,   points:40},
  {id:`streak_7`,     name:`Weekly Warrior`,    desc:`Maintain a 7-day streak`,            field:`currentStreak`,      threshold:7,   points:100},
  {id:`streak_14`,    name:`Fortnight Force`,   desc:`Maintain a 14-day streak`,           field:`currentStreak`,      threshold:14,  points:200},
  {id:`streak_30`,    name:`Monthly Master`,    desc:`Maintain a 30-day streak`,           field:`currentStreak`,      threshold:30,  points:500},
];

const SHOP_ITEMS = [
  {id:`venus_theme`,   name:`Venus Atmosphere`, desc:`Amber haze nebula backdrop`,     category:`planet`,   price:100,  themeColors:{c1:`#1a1508`,c2:`#0d0a04`,c3:`#050301`}},
  {id:`earth_theme`,   name:`Earth Rise`,       desc:`Blue marble orbital view`,       category:`planet`,   price:200,  themeColors:{c1:`#081a16`,c2:`#040d0a`,c3:`#010503`}},
  {id:`mars_theme`,    name:`Mars Dust`,        desc:`Red canyon landscape`,           category:`planet`,   price:350,  themeColors:{c1:`#1a0808`,c2:`#0d0404`,c3:`#050101`}},
  {id:`jupiter_theme`, name:`Jupiter Storm`,    desc:`Great Red Spot swirl`,           category:`planet`,   price:500,  themeColors:{c1:`#1a1208`,c2:`#0d0904`,c3:`#050401`}},
  {id:`saturn_theme`,  name:`Saturn Rings`,     desc:`Golden ring system`,             category:`planet`,   price:750,  themeColors:{c1:`#1a1a08`,c2:`#0d0d04`,c3:`#050501`}},
  {id:`neptune_theme`, name:`Neptune Deep`,     desc:`Deep blue ice giant`,            category:`planet`,   price:1000, themeColors:{c1:`#08081a`,c2:`#04040d`,c3:`#010105`}},
  {id:`neon_green`,    name:`Neon Matrix`,      desc:`Green neon timer glow`,          category:`cosmetic`, price:75,   color:`#39FF14`},
  {id:`cyber_pink`,    name:`Cyber Pink`,       desc:`Hot pink timer ring`,            category:`cosmetic`, price:75,   color:`#FF1493`},
  {id:`ice_blue`,      name:`Ice Blue`,         desc:`Frozen blue timer`,              category:`cosmetic`, price:75,   color:`#00CED1`},
  {id:`synth_beep`,    name:`Synth Wave`,       desc:`Retro synthesizer tones`,        category:`sound`,    price:50,   frequency:520},
  {id:`space_chime`,   name:`Space Chime`,      desc:`Ethereal space chime`,           category:`sound`,    price:50,   frequency:880},
];

const PLANET_STAGES = [
  {id:`mercury`,  name:`Mercury`,  threshold:0},
  {id:`venus`,    name:`Venus`,    threshold:100},
  {id:`earth`,    name:`Earth`,    threshold:300},
  {id:`mars`,     name:`Mars`,     threshold:600},
  {id:`jupiter`,  name:`Jupiter`,  threshold:1000},
  {id:`saturn`,   name:`Saturn`,   threshold:1500},
  {id:`neptune`,  name:`Neptune`,  threshold:2500},
  {id:`pluto`,    name:`Pluto`,    threshold:4000},
];

// ===== CORE LOGIC =====

function todayStr(){
  return new Date().toISOString().slice(0,10);
}

function updateStreak(player){
  const today = todayStr();
  if (player.lastSessionDate === today) return;
  if (player.lastSessionDate){
    const last = new Date(player.lastSessionDate);
    const now = new Date(today);
    const diff = Math.floor((now - last) / 86400000);
    if (diff === 1){
      player.currentStreak++;
    } else {
      player.currentStreak = 1;
    }
  } else {
    player.currentStreak = 1;
  }
  player.lastSessionDate = today;
  if (player.currentStreak > player.longestStreak){
    player.longestStreak = player.currentStreak;
  }
}

function checkAchievements(player){
  const newOnes = [];
  for (let i = 0; i < ACHIEVEMENTS.length; i++){
    const a = ACHIEVEMENTS[i];
    if (player.achievementsEarned.indexOf(a.id) === -1 && player[a.field] >= a.threshold){
      player.achievementsEarned.push(a.id);
      player.points += a.points;
      player.totalPointsEarned += a.points;
      newOnes.push(a);
    }
  }
  return newOnes;
}

function getUnlockedPlanets(player){
  const unlocked = [];
  for (let i = 0; i < PLANET_STAGES.length; i++){
    if (player.totalPointsEarned >= PLANET_STAGES[i].threshold) unlocked.push(PLANET_STAGES[i].id);
  }
  return unlocked;
}

function awardSession(sessionType, durationMinutes){
  const player = loadPlayer();
  if (sessionType === `focus`){
    player.totalFocusSessions++;
    player.totalFocusMinutes += durationMinutes;
    player.points += 10;
    player.totalPointsEarned += 10;
  }
  updateStreak(player);
  const newAchievements = checkAchievements(player);
  const unlockedBefore = getUnlockedPlanets(player).length;
  savePlayer(player);
  const unlockedAfter = getUnlockedPlanets(player);

  for (let i = 0; i < newAchievements.length; i++){
    showToast(`🏆 ${newAchievements[i].name} — +${newAchievements[i].points} pts`);
  }
  if (unlockedAfter.length > unlockedBefore){
    const newest = PLANET_STAGES[unlockedAfter.length - 1];
    showToast(`🪐 Planet unlocked: ${newest.name}!`);
  }
  if (sessionType === `focus`){
    showToast(`+10 pts`);
  }
  updatePlayerHUD();
  if (isOpen(`achievements`)) renderAchievements();
  if (isOpen(`shop`)) renderShop();
}

// ===== SHOP =====

function purchaseItem(itemId){
  const player = loadPlayer();
  const item = SHOP_ITEMS.find(function(i){ return i.id === itemId; });
  if (!item) return;
  if (player.ownedItems.indexOf(itemId) !== -1) return;
  if (player.points < item.price) {
    showToast(`Not enough points!`);
    return;
  }
  player.points -= item.price;
  player.ownedItems.push(itemId);
  if (item.category === `planet`) {
    player.activePlanet = itemId;
    window.activeTheme = itemId;
  } else if (item.category === `cosmetic`) {
    player.activeCosmetic = itemId;
    applyCosmetic(item.color);
  } else if (item.category === `sound`) {
    player.activeSound = itemId;
  }
  savePlayer(player);
  showToast(`Purchased: ${item.name}`);
  updatePlayerHUD();
  renderShop();
}

function equipItem(itemId){
  const player = loadPlayer();
  const item = SHOP_ITEMS.find(function(i){ return i.id === itemId; });
  if (!item || player.ownedItems.indexOf(itemId) === -1) return;
  if (item.category === `planet`){
    player.activePlanet = itemId;
    window.activeTheme = itemId;
  } else if (item.category === `cosmetic`){
    if (player.activeCosmetic === itemId){
      player.activeCosmetic = null;
      applyCosmetic(null);
    } else {
      player.activeCosmetic = itemId;
      applyCosmetic(item.color);
    }
  } else if (item.category === `sound`){
    if (player.activeSound === itemId){
      player.activeSound = null;
    } else {
      player.activeSound = itemId;
    }
  }
  savePlayer(player);
  renderShop();
}

function applyCosmetic(color){
  if (color){
    document.documentElement.style.setProperty(`--focus`, color);
  } else {
    document.documentElement.style.setProperty(`--focus`, `#FF9F1C`);
  }
}

function activatePlanetStage(planetId){
  const player = loadPlayer();
  const unlocked = getUnlockedPlanets(player);
  if (unlocked.indexOf(planetId) === -1) return;
  player.activePlanet = planetId;
  window.activeTheme = planetId;
  savePlayer(player);
  renderAchievements();
}

// ===== UI =====

function showToast(message){
  let container = document.getElementById(`toast-container`);
  if (!container){
    container = document.createElement(`div`);
    container.id = `toast-container`;
    container.className = `toast-container`;
    document.body.appendChild(container);
  }
  const toast = document.createElement(`div`);
  toast.className = `toast`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function(){ toast.remove(); }, 3000);
}

function updatePlayerHUD(){
  const player = loadPlayer();
  const pts = document.getElementById(`hud-points`);
  const str = document.getElementById(`hud-streak`);
  if (pts) pts.textContent = `★ ` + player.points;
  if (str) str.textContent = `🔥 ` + player.currentStreak;
}

let shopCategory = `planet`;

function renderShop(){
  const player = loadPlayer();
  const balanceEl = document.getElementById(`shop-balance`);
  if (balanceEl) balanceEl.textContent = `★ ` + player.points;

  document.querySelectorAll(`.shop-tab`).forEach(function(tab){
    tab.classList.toggle(`active`, tab.dataset.category === shopCategory);
  });

  const grid = document.getElementById(`shop-grid`);
  if (!grid) return;
  grid.innerHTML = ``;

  const filtered = SHOP_ITEMS.filter(function(item){ return item.category === shopCategory; });
  for (let i = 0; i < filtered.length; i++){
    const item = filtered[i];
    const owned = player.ownedItems.indexOf(item.id) !== -1;
    const isActive = (item.category === `planet` && player.activePlanet === item.id) ||
                     (item.category === `cosmetic` && player.activeCosmetic === item.id) ||
                     (item.category === `sound` && player.activeSound === item.id);

    const card = document.createElement(`div`);
    card.className = `shop-item` + (owned ? ` owned` : ``);

    let preview = ``;
    if (item.category === `planet` && item.themeColors){
      preview = `<div class="shop-preview" style="background:${item.themeColors.c1};"></div>`;
    } else if (item.category === `cosmetic` && item.color){
      preview = `<div class="shop-preview" style="background:${item.color};"></div>`;
    } else if (item.category === `sound`){
      preview = `<div class="shop-preview sound-preview">♪</div>`;
    }

    let btnHtml;
    if (!owned){
      btnHtml = `<button class="btn shop-buy" onclick="purchaseItem('${item.id}')">★ ${item.price}</button>`;
    } else if (isActive){
      btnHtml = `<button class="btn shop-equipped" onclick="equipItem('${item.id}')">ACTIVE</button>`;
    } else {
      btnHtml = `<button class="btn shop-equip" onclick="equipItem('${item.id}')">EQUIP</button>`;
    }

    card.innerHTML = `${preview}<div class="shop-item-info"><div class="shop-item-name">${item.name}</div><div class="shop-item-desc">${item.desc}</div></div>${btnHtml}`;
    grid.appendChild(card);
  }
}

function switchShopCategory(cat){
  shopCategory = cat;
  renderShop();
}

function renderAchievements(){
  const player = loadPlayer();

  const statSessions = document.getElementById(`ach-stat-sessions`);
  const statTime = document.getElementById(`ach-stat-time`);
  const statStreak = document.getElementById(`ach-stat-streak`);
  const statLongest = document.getElementById(`ach-stat-longest`);
  if (statSessions) statSessions.textContent = player.totalFocusSessions;
  if (statTime){
    const h = Math.floor(player.totalFocusMinutes / 60);
    const m = player.totalFocusMinutes % 60;
    statTime.textContent = h > 0 ? h + `h ` + m + `m` : m + `m`;
  }
  if (statStreak) statStreak.textContent = player.currentStreak + `d`;
  if (statLongest) statLongest.textContent = player.longestStreak + `d`;

  const progressBar = document.getElementById(`planet-progress`);
  if (progressBar){
    progressBar.innerHTML = ``;
    const unlocked = getUnlockedPlanets(player);
    for (let i = 0; i < PLANET_STAGES.length; i++){
      const p = PLANET_STAGES[i];
      const isUnlocked = unlocked.indexOf(p.id) !== -1;
      const isCurrent = player.activePlanet === p.id;
      const dot = document.createElement(`div`);
      dot.className = `ach-planet-dot` + (isUnlocked ? ` unlocked` : ``) + (isCurrent ? ` current` : ``);
      dot.title = p.name + ` (` + p.threshold + ` pts)`;
      dot.innerHTML = `<span class="planet-icon">${isUnlocked ? `●` : `○`}</span><span class="planet-label">${p.name}</span>`;
      if (isUnlocked) dot.onclick = (function(pid){ return function(){ activatePlanetStage(pid); }; })(p.id);
      progressBar.appendChild(dot);
      if (i < PLANET_STAGES.length - 1){
        const line = document.createElement(`div`);
        line.className = `ach-progress-line` + (unlocked.indexOf(PLANET_STAGES[i+1].id) !== -1 ? ` filled` : ``);
        progressBar.appendChild(line);
      }
    }
  }

  const achList = document.getElementById(`ach-list`);
  if (!achList) return;
  achList.innerHTML = ``;
  for (let i = 0; i < ACHIEVEMENTS.length; i++){
    const a = ACHIEVEMENTS[i];
    const earned = player.achievementsEarned.indexOf(a.id) !== -1;
    const progress = Math.min(player[a.field], a.threshold);
    const row = document.createElement(`div`);
    row.className = `ach-row` + (earned ? ` earned` : ` locked`);
    row.innerHTML = `<div class="ach-icon">${earned ? `🏆` : `🔒`}</div><div class="ach-info"><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div><div class="ach-bar-wrap"><div class="ach-bar-fill" style="width:${(progress/a.threshold)*100}%"></div></div></div><div class="ach-points">${earned ? `✓` : progress + `/` + a.threshold} · ${a.points} pts</div>`;
    achList.appendChild(row);
  }
}

// ===== INTEGRATION WITH SCRIPT2.JS =====
// Monkey-patch existing functions to add gamification hooks

// Register new windows with the window manager
windows.shop = {elem: document.getElementById(`win-shop`), title: `🛒 Shop`};
windows.achievements = {elem: document.getElementById(`win-achievements`), title: `🏆 Achievements`};
makeDraggable(`shop`);
makeDraggable(`achievements`);

// Wrap openWindow to render shop/achievements when opened
const _origOpenWindow = openWindow;
openWindow = function(id){
  _origOpenWindow(id);
  if (id === `shop`) renderShop();
  if (id === `achievements`) renderAchievements();
};

// Wrap completePhase to award points after focus sessions
const _origCompletePhase = completePhase;
completePhase = function(){
  const wasFocus = (mode === `focus`);
  _origCompletePhase();
  if (wasFocus) awardSession(`focus`, durations.focus / 60);
};

// Wrap beep to use custom sound frequencies
const _origBeep = beep;
beep = function(){
  const player = loadPlayer();
  if (player.activeSound){
    const soundItem = SHOP_ITEMS.find(function(s){ return s.id === player.activeSound; });
    if (soundItem){
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = soundItem.frequency;
        osc.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } catch(e){}
      return;
    }
  }
  _origBeep();
};

// ===== INIT =====

(function initGamification(){
  const player = loadPlayer();
  window.activeTheme = player.activePlanet || `mercury`;
  if (player.activeCosmetic){
    const cosmItem = SHOP_ITEMS.find(function(i){ return i.id === player.activeCosmetic; });
    if (cosmItem) applyCosmetic(cosmItem.color);
  }
  updatePlayerHUD();
})();
