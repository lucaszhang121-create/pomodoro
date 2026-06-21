//Window manager
const windows = {
    pomodoro: { elem: document.getElementById(`win-pomodoro`), title: `⏱ Pomodoro` },
    log: { elem: document.getElementById(`win-log`),      title: `🗒 Session Log` },
    help: {elem: document.getElementById(`win-help`), title: `? Help`},
    music: {elem: document.getElementById(`win-music`), title: `🎧 Music`},
    nova: {elem: document.getElementById(`win-nova`), title: `💬 Nova`},
    flashcards: {elem: document.getElementById(`win-flashcards`), title: `📇 Flashcards`}
};
let zCounter = 10;

function selectWindow(id){
    zCounter++;
    windows[id].elem.style.zIndex = zCounter;
}
function isOpen(id){ 
    return windows[id].elem.style.display != "none"; 
}
function openWindow(id){
    windows[id].elem.style.display = "flex";
    selectWindow(id);
    updateTaskbar();
}
function closeWindow(id){
    windows[id].elem.style.display = "none";
    updateTaskbar();
}
//currently identical to closeWindow
function minimizeWindow(id){
    windows[id].elem.style.display = "none";
    updateTaskbar();
}
function updateTaskbar(){
    const taskbar = document.getElementById(`taskbar-items`);
    taskbar.innerHTML = "";
    const windowIds = Object.keys(windows);
    for (let i = 0; i < windowIds.length; i++){
        const id = windowIds[i];
        if (isOpen(id)){
            const pill = document.createElement(`button`);
            pill.className = "taskpill";
            pill.textContent = windows[id].title;
            pill.onclick = function(){ selectWindow(id); };
            taskbar.appendChild(pill);
        }
    }
}

function makeDraggable(id){
  const elem = windows[id].elem;
  const handle = elem.querySelector(`[data-handle]`);
  let dragging = false, offX = 0, offY = 0;
  handle.addEventListener(`mousedown`, function(e){
    dragging = true;
    selectWindow(id);
    offX = e.clientX - elem.offsetLeft;
    offY = e.clientY - elem.offsetTop;
    document.body.style.userSelect = `none`;
  });
  window.addEventListener(`mousemove`, function(e){
    if (!dragging) return;
    let x = e.clientX - offX;
    let y = e.clientY - offY;
    const maxX = window.innerWidth - elem.offsetWidth;
    const maxY = window.innerHeight - 44 - elem.offsetHeight;
    x = Math.max(0, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));
    elem.style.left = x + `px`;
    elem.style.top = y + `px`;
  });
  window.addEventListener(`mouseup`, function(){ dragging = false; document.body.style.userSelect = ``; });
  elem.addEventListener(`mousedown`, function(){ selectWindow(id); });
}
Object.keys(windows).forEach(makeDraggable);

//called by start button
function toggleStartMenu(){
  document.getElementById(`start-menu`).classList.toggle(`open`);
}
document.addEventListener(`click`, function(e){
  const menu = document.getElementById(`start-menu`);
  const btn = document.getElementById(`start-btn-main`);
  if (menu.classList.contains(`open`) && !menu.contains(e.target) && e.target != btn){
    menu.classList.remove(`open`);
  }
});

function updateClock(){
    let options = {
        hour:"2-digit", minute:"2-digit", second:"2-digit"
    };
    document.getElementById(`clock`).textContent = new Date().toLocaleTimeString(`en-us`, options);
}
updateClock();
setInterval(updateClock, 1000);

//Pomodoro logic
const TICK_COUNT = 48;
const durations = { focus: 25*60, short: 5*60, long: 15*60 };
let mode = `focus`;
let remaining = durations.focus;
let running = false;
let timerId = null;
let completedFocusSessions = 0;
let sessionLog = [];

function buildRing(){
    for (let i = 0; i < TICK_COUNT; i++){
        const t = document.createElement(`div`);
        t.className = "tick";
        t.style.transform = `rotate(${(360/TICK_COUNT)*i}deg)`;
        document.getElementById(`ring`).appendChild(t);
    }
}
buildRing();

function fmt(sec){
    const m = Math.floor(sec/60).toString().padStart(2, `0`);
    const s = (sec%60).toString().padStart(2, `0`);
    return m + `:` + s;
}

//called by tick, completePhase, switchMode, resetTimer, applySettings
function renderTimer(){
  document.getElementById(`timer-display`).textContent = fmt(remaining);
  if (mode == `focus`){
    document.getElementById(`mode-label`).textContent = `STUDY`;
    document.getElementById(`study`).style.display = "flex";
    document.getElementById(`short`).style.display = "none";
    document.getElementById(`long`).style.display = "none";
} else if (mode == `short`){
    document.getElementById(`mode-label`).textContent = `SHORT BREAK`;
    document.getElementById(`study`).style.display = "none";
    document.getElementById(`short`).style.display = "flex";
    document.getElementById(`long`).style.display = "none";
  } else {
    document.getElementById(`mode-label`).textContent = `LONG BREAK`;
    document.getElementById(`study`).style.display = "none";
    document.getElementById(`short`).style.display = "none";
    document.getElementById(`long`).style.display = "flex";
  }

  const ring = document.getElementById(`ring`);
  ring.className = `ring mode-` + mode;
  const total = durations[mode];
  const progress = 1 - (remaining / total);
  const lit = Math.floor(progress * TICK_COUNT);
  const ticks = document.querySelectorAll(`.tick`);
  for (let i = 0; i < ticks.length; i++){
    ticks[i].classList.toggle(`lit`, i < lit);
  }

  document.querySelectorAll(`.mode-tab`).forEach(function(tab){
    tab.classList.toggle(`active`, tab.dataset.mode == mode);
  });

  const pips = document.getElementById(`pips`);
  pips.innerHTML = ``;
  for (let i = 0; i < 4; i++){
    const pip = document.createElement(`span`);
    pip.className = `pip` + (i < (completedFocusSessions % 4) ? ` filled` : ``);
    pips.appendChild(pip);
  }
  document.getElementById(`start-btn`).textContent = running ? `PAUSE` : `START`;
}

//called every second while the timer is running
function tick(){
  if (remaining > 0){
    remaining--;
    renderTimer();
  } else {
    completePhase();
  }
}

//plays a short tone when a phase finishes
function beep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = mode == `focus` ? 660 : 440;
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }catch(e){}
}

function completePhase(){
  pauseTimer();
  beep();
  if (mode == "focus"){
    completedFocusSessions++;
    sessionLog.unshift({ type: `Focus`, time: new Date() });
    mode = (completedFocusSessions % 4 == 0) ? "long" : "short";
  } else {
    sessionLog.unshift({ type: mode == "long" ? "Long Break" : "Short Break", time: new Date() });
    mode = "focus";
  }
  remaining = durations[mode];
  renderTimer();
  renderLog();
}

//called by toggleTimer
function startTimer(){
  running = true;
  timerId = setInterval(tick, 1000);
  renderTimer();
}
//called by toggleTimer, completePhase, resetTimer, switchMode
function pauseTimer(){
  running = false;
  clearInterval(timerId);
  renderTimer();
}
//called by start/pause button
function toggleTimer(){ running ? pauseTimer() : startTimer(); }
//called by reset button
function resetTimer(){
  pauseTimer();
  remaining = durations[mode];
  renderTimer();
}
//called by mode tab buttons
function switchMode(newMode){
    if (newMode == "focus"){
        document.getElementById(`study`).style.display = "flex";
        document.getElementById(`short`).style.display = "none";
        document.getElementById(`long`).style.display = "none";
    } else if (newMode == "short"){
        document.getElementById(`study`).style.display = "none";
        document.getElementById(`short`).style.display = "flex";
        document.getElementById(`long`).style.display = "none";
    } else {
        document.getElementById(`study`).style.display = "none";
        document.getElementById(`short`).style.display = "none";
        document.getElementById(`long`).style.display = "flex";
    }
    mode = newMode;
  pauseTimer();
  remaining = durations[mode];
  renderTimer();
}

let lastDetails = "";
//called by settings save button
function applySettings(){
  durations.focus = Math.max(1, parseInt(document.getElementById(`set-focus`).value || 25)) * 60;
  durations.short = Math.max(1, parseInt(document.getElementById(`set-short`).value || 5)) * 60;
  durations.long  = Math.max(1, parseInt(document.getElementById(`set-long`).value  || 15)) * 60;
  let lastDetails = document.getElementById(`session-details`);
  if (!running){ remaining = durations[mode]; renderTimer(); }
}

//called by completePhase
function renderLog(){
  const list = document.getElementById(`log-list`);
  list.innerHTML = ``;
  if (sessionLog.length < 1){
    list.innerHTML = `<div class="log-empty">No sessions completed yet. Hit start on the Pomodoro app.</div>`;
    return;
  }
  const visible = sessionLog.slice(0, 20);
  for (let i = 0; i < visible.length; i++){
    const entry = visible[i];
    const row = document.createElement(`div`);
    row.className = `log-row`;
    const time = entry.time.toLocaleTimeString([], {hour:`2-digit`, minute:`2-digit`});
    const cls = entry.type.includes(`Focus`) ? `lt-focus` : `lt-break`;
    row.innerHTML = `<span class="log-type ${cls}">${entry.type}</span><span class="log-time">${time}</span><div style="display: flex; flex-direction: row; gap: 0.5rem;"><button style="background-color: green; width: 1rem; height: 1rem;"></button><button style="background-color: red; width: 1rem; height: 1rem;"></button></div>`;
    list.appendChild(row);
  }
}

const songs = [ 
  {song: "Falling Behind", artist: "Luffy", elem: document.getElementById(`falling-behind`)},
  {song: "From the Start", artist: "Luffy", elem: document.getElementById(`from-the-start`)},
  {song: "Interstellar", artist: "Hans Zimmer", elem: document.getElementById(`interstellar`)},
]
let currentIndex = 0;
function playSong(id, toggle){
  document.getElementById(`song-name`).textContent = songs[id].song;
  document.getElementById(`artist-name`).textContent = songs[id].artist;
  if (toggle){
    if (songs[id].elem.paused){
      songs[id].elem.play();
      document.getElementById(`vinyl`).style.animationPlayState = "running";
    } else {
      songs[id].elem.pause();
      document.getElementById(`vinyl`).style.animationPlayState = "paused";
    }
  } else {
    songs[id].elem.play();
    document.getElementById(`vinyl`).style.animationPlayState = "running";
  }
}
function songFinished(){
  songs[currentIndex].elem.pause();
  document.getElementById(`vinyl`).style.animationPlayState = "paused";
  songs[currentIndex].elem.currentTime = 0;
  currentIndex++;
  if (currentIndex >= songs.length){
    currentIndex = 0;
  }
  playSong(currentIndex, null);
}
function lastSong(){
  songs[currentIndex].elem.pause();
  document.getElementById(`vinyl`).style.animationPlayState = "paused";
  songs[currentIndex].elem.currentTime = 0;
  if (currentIndex == 0){
    currentIndex = songs.length - 1;
  } else {
    currentIndex--;
  }
  playSong(currentIndex, null);
}
function nextSong(){
  songs[currentIndex].elem.pause();
  document.getElementById(`vinyl`).style.animationPlayState = "paused";
  songs[currentIndex].elem.currentTime = 0;
  currentIndex++;
  if (currentIndex >= songs.length){
    currentIndex = 0;
  }
  playSong(currentIndex, null);
}

//Init
renderTimer();
renderLog();
openWindow(`pomodoro`);