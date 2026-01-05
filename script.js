const WEEKLY_LIMIT_MINUTES = 60;
const STORAGE_KEY = "gaming-time-tracker";

const elements = {
  timeRemaining: document.getElementById("time-remaining"),
  timeUsed: document.getElementById("time-used"),
  weekRange: document.getElementById("week-range"),
  progressBar: document.getElementById("progress-bar"),
  toggleSession: document.getElementById("toggle-session"),
  resetWeek: document.getElementById("reset-week"),
  sessionList: document.getElementById("session-list"),
  status: document.getElementById("status"),
};

let state = loadState();
let timerId = null;

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const now = new Date();
  const week = getWeekRange(now);

  if (!stored) {
    return { weekStart: week.start.toISOString(), sessions: [], activeSession: null };
  }

  const parsed = JSON.parse(stored);
  const storedWeekStart = new Date(parsed.weekStart);
  if (storedWeekStart.toDateString() !== week.start.toDateString()) {
    return { weekStart: week.start.toISOString(), sessions: [], activeSession: null };
  }

  return parsed;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getWeekRange(date) {
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatWeekRange() {
  const week = getWeekRange(new Date(state.weekStart));
  const options = { month: "short", day: "numeric" };
  return `${week.start.toLocaleDateString(undefined, options)} - ${week.end.toLocaleDateString(undefined, options)}`;
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function calculateUsedSeconds() {
  const sessionSeconds = state.sessions.reduce((total, session) => total + session.duration, 0);
  if (!state.activeSession) {
    return sessionSeconds;
  }
  const activeStart = new Date(state.activeSession.startedAt);
  const now = new Date();
  return sessionSeconds + Math.max(0, Math.floor((now - activeStart) / 1000));
}

function updateUI() {
  const usedSeconds = calculateUsedSeconds();
  const limitSeconds = WEEKLY_LIMIT_MINUTES * 60;
  const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);
  const progressPercent = Math.min(100, (usedSeconds / limitSeconds) * 100);

  elements.timeUsed.textContent = formatDuration(usedSeconds);
  elements.timeRemaining.textContent = formatDuration(remainingSeconds);
  elements.weekRange.textContent = formatWeekRange();
  elements.progressBar.style.width = `${progressPercent}%`;

  if (state.activeSession) {
    elements.toggleSession.textContent = "End session";
    elements.toggleSession.dataset.running = "true";
    elements.status.textContent = "Gaming time is running. Remember to pause for breaks.";
  } else {
    elements.toggleSession.textContent = "Start session";
    elements.toggleSession.dataset.running = "false";
    elements.status.textContent = "Not currently gaming.";
  }

  renderSessions();
}

function renderSessions() {
  elements.sessionList.innerHTML = "";
  if (state.sessions.length === 0 && !state.activeSession) {
    const empty = document.createElement("li");
    empty.className = "session-item";
    empty.textContent = "No sessions logged yet.";
    elements.sessionList.appendChild(empty);
    return;
  }

  const sessions = [...state.sessions];
  if (state.activeSession) {
    sessions.push({
      startedAt: state.activeSession.startedAt,
      duration: Math.max(0, Math.floor((new Date() - new Date(state.activeSession.startedAt)) / 1000)),
      active: true,
    });
  }

  sessions.reverse().forEach((session) => {
    const item = document.createElement("li");
    item.className = "session-item";
    const start = new Date(session.startedAt);
    const label = start.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    item.innerHTML = `
      <div>
        <div>${label}${session.active ? " • In progress" : ""}</div>
        <small>${start.toLocaleDateString()}</small>
      </div>
      <span>${formatDuration(session.duration)}</span>
    `;
    elements.sessionList.appendChild(item);
  });
}

function startSession() {
  const usedSeconds = calculateUsedSeconds();
  const limitSeconds = WEEKLY_LIMIT_MINUTES * 60;
  if (usedSeconds >= limitSeconds) {
    elements.status.textContent = "Weekly limit reached. Reset the week to start over.";
    return;
  }

  state.activeSession = { startedAt: new Date().toISOString() };
  saveState();
  startTimer();
  updateUI();
}

function endSession() {
  if (!state.activeSession) {
    return;
  }

  const now = new Date();
  const startedAt = new Date(state.activeSession.startedAt);
  const duration = Math.max(0, Math.floor((now - startedAt) / 1000));
  state.sessions.push({ startedAt: state.activeSession.startedAt, duration });
  state.activeSession = null;
  saveState();
  stopTimer();
  updateUI();
}

function resetWeek() {
  const confirmReset = window.confirm("Reset the week and clear all sessions?");
  if (!confirmReset) {
    return;
  }
  const week = getWeekRange(new Date());
  state = { weekStart: week.start.toISOString(), sessions: [], activeSession: null };
  saveState();
  stopTimer();
  updateUI();
}

function startTimer() {
  if (timerId) {
    return;
  }
  timerId = window.setInterval(() => {
    const usedSeconds = calculateUsedSeconds();
    if (usedSeconds >= WEEKLY_LIMIT_MINUTES * 60) {
      endSession();
      elements.status.textContent = "Weekly limit reached. Great job sticking to the plan!";
      return;
    }
    updateUI();
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function initialize() {
  const week = getWeekRange(new Date());
  const storedWeekStart = new Date(state.weekStart);
  if (storedWeekStart.toDateString() !== week.start.toDateString()) {
    state = { weekStart: week.start.toISOString(), sessions: [], activeSession: null };
    saveState();
  }

  if (state.activeSession) {
    startTimer();
  }

  elements.toggleSession.addEventListener("click", () => {
    if (state.activeSession) {
      endSession();
    } else {
      startSession();
    }
  });

  elements.resetWeek.addEventListener("click", resetWeek);
  updateUI();
}

initialize();
