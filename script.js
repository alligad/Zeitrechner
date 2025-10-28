const STORAGE_KEYS = {
  start: "zeitrechner:startTime",
  pause: "zeitrechner:breakDuration",
  target: "zeitrechner:targetDuration",
  weekly: "zeitrechner:weeklyEntries",
};

const WARNING_THRESHOLD_MINUTES = 30;
const TEN_HOURS_IN_MINUTES = 10 * 60;
const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DEFAULT_NOTES = {
  current: "Bisherige Arbeitszeit (abzueglich Pause)",
  target: "Gehe zu dieser Uhrzeit, um deine Sollzeit zu erfuellen",
  max: "Absolute Grenze einschliesslich Pause",
};
const BUTTON_LABELS = {
  save: "Heute speichern",
  clear: "Woche zuruecksetzen",
};

const form = document.getElementById("time-form");
const startInput = document.getElementById("start-time");
const breakSelect = document.getElementById("break-duration");
const targetSelect = document.getElementById("target-duration");
const workedOutput = document.getElementById("current-worked");
const targetOutput = document.getElementById("target-end");
const maxOutput = document.getElementById("max-end");
const currentNote = document.getElementById("current-note");
const targetNote = document.getElementById("target-note");
const maxNote = document.getElementById("max-note");
const resultMaxCard = document.getElementById("result-max");

const startNowButton = document.getElementById("start-now");
const saveSessionButton = document.getElementById("save-session");
const clearWeekButton = document.getElementById("clear-week");
const weeklyTotal = document.getElementById("weekly-total");
const weeklyList = document.getElementById("weekly-list");
const weeklyEmpty = document.getElementById("weekly-empty");

const timelineFill = document.getElementById("timeline-fill");
const timelineStartMarker = document.getElementById("timeline-start");
const timelineNowMarker = document.getElementById("timeline-now");
const timelineTargetMarker = document.getElementById("timeline-target");
const timelineMaxMarker = document.getElementById("timeline-max");
const timelineStartTime = document.getElementById("timeline-start-time");
const timelineNowTime = document.getElementById("timeline-now-time");
const timelineTargetTime = document.getElementById("timeline-target-time");
const timelineMaxTime = document.getElementById("timeline-max-time");

const state = {
  valid: false,
  startMinutes: null,
  breakMinutes: null,
  targetMinutes: null,
  currentMinutes: null,
  workedMinutes: 0,
  endAtTarget: null,
  endAtMax: null,
};

let tickInterval;

document.addEventListener("DOMContentLoaded", init);

function init() {
  loadStoredValues();
  attachEventListeners();
  handleInputs();
  startAutoTick();
}

function attachEventListeners() {
  form.addEventListener("input", handleInputs);
  startNowButton?.addEventListener("click", setStartToNow);
  saveSessionButton?.addEventListener("click", saveTodaySession);
  clearWeekButton?.addEventListener("click", clearCurrentWeek);
  window.addEventListener("storage", handleStorageSync);
}

function handleInputs() {
  storeValues();
  updateCalculations();
}

function setStartToNow() {
  const now = new Date();
  startInput.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  handleInputs();
}

function loadStoredValues() {
  const storedStart = localStorage.getItem(STORAGE_KEYS.start);
  const storedPause = localStorage.getItem(STORAGE_KEYS.pause);
  const storedTarget = localStorage.getItem(STORAGE_KEYS.target);

  if (storedStart) startInput.value = storedStart;
  if (storedPause) breakSelect.value = storedPause;
  if (storedTarget) targetSelect.value = storedTarget;
}

function storeValues() {
  if (startInput.value) {
    localStorage.setItem(STORAGE_KEYS.start, startInput.value);
  }

  localStorage.setItem(STORAGE_KEYS.pause, breakSelect.value);
  localStorage.setItem(STORAGE_KEYS.target, targetSelect.value);
}

function updateCalculations() {
  const start = parseTimeString(startInput.value);
  const breakDuration = parseTimeString(breakSelect.value);
  const targetDuration = parseTimeString(targetSelect.value);

  if (!start || !breakDuration || !targetDuration) {
    resetOutputs();
    renderWeek();
    return;
  }

  const startMinutes = toMinutes(start);
  const breakMinutes = toMinutes(breakDuration);
  const targetMinutes = toMinutes(targetDuration);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const workedMinutes = Math.max(0, currentMinutes - startMinutes - breakMinutes);

  state.valid = true;
  state.startMinutes = startMinutes;
  state.breakMinutes = breakMinutes;
  state.targetMinutes = targetMinutes;
  state.currentMinutes = currentMinutes;
  state.workedMinutes = workedMinutes;
  state.endAtTarget = startMinutes + breakMinutes + targetMinutes;
  state.endAtMax = startMinutes + TEN_HOURS_IN_MINUTES;

  workedOutput.textContent = formatDuration(workedMinutes);
  targetOutput.textContent = formatClockTime(state.endAtTarget);
  maxOutput.textContent = formatClockTime(state.endAtMax);

  currentNote.textContent = DEFAULT_NOTES.current;
  targetNote.textContent = DEFAULT_NOTES.target;

  updateWarnings();
  updateTimeline();
  renderWeek();
}

function resetOutputs() {
  state.valid = false;
  state.startMinutes = null;
  state.currentMinutes = null;
  state.endAtTarget = null;
  state.endAtMax = null;
  state.workedMinutes = 0;

  workedOutput.textContent = "-";
  targetOutput.textContent = "-";
  maxOutput.textContent = "-";

  currentNote.textContent = DEFAULT_NOTES.current;
  targetNote.textContent = DEFAULT_NOTES.target;
  maxNote.textContent = DEFAULT_NOTES.max;
  resultMaxCard.classList.remove("result--warning", "result--danger");

  resetTimeline();
}

function updateWarnings() {
  resultMaxCard.classList.remove("result--warning", "result--danger");

  const limitDiff = Math.round(state.endAtMax - state.currentMinutes);
  if (limitDiff <= 0) {
    resultMaxCard.classList.add("result--danger");
    maxNote.textContent = "Achtung: 10-Stunden-Grenze erreicht. Jetzt beenden!";
    return;
  }

  if (limitDiff <= WARNING_THRESHOLD_MINUTES) {
    resultMaxCard.classList.add("result--warning");
    maxNote.textContent = `Nur noch ${formatDuration(limitDiff)} bis zur 10-Stunden-Grenze.`;
  } else {
    maxNote.textContent = DEFAULT_NOTES.max;
  }
}

function updateTimeline() {
  if (!state.valid) {
    resetTimeline();
    return;
  }

  timelineStartTime.textContent = formatClockTime(state.startMinutes);
  timelineNowTime.textContent = formatClockTime(state.currentMinutes);
  timelineTargetTime.textContent = formatClockTime(state.endAtTarget);
  timelineMaxTime.textContent = formatClockTime(state.endAtMax);

  const span = state.endAtMax - state.startMinutes;
  if (span <= 0) {
    resetTimeline();
    return;
  }

  const nowProgress = clamp(((state.currentMinutes - state.startMinutes) / span) * 100, 0, 120);
  const targetProgress = clamp(((state.endAtTarget - state.startMinutes) / span) * 100, 0, 120);

  timelineFill.style.width = `${clamp(nowProgress, 0, 100)}%`;
  setMarkerPosition(timelineStartMarker, 0);
  setMarkerPosition(timelineNowMarker, nowProgress);
  setMarkerPosition(timelineTargetMarker, targetProgress);
  setMarkerPosition(timelineMaxMarker, 100);
}

function resetTimeline() {
  timelineFill.style.width = "0%";
  timelineStartTime.textContent = "--:--";
  timelineNowTime.textContent = "--:--";
  timelineTargetTime.textContent = "--:--";
  timelineMaxTime.textContent = "--:--";
  setMarkerPosition(timelineStartMarker, 0);
  setMarkerPosition(timelineNowMarker, 0);
  setMarkerPosition(timelineTargetMarker, 0);
  setMarkerPosition(timelineMaxMarker, 100);
}

function setMarkerPosition(element, percentage) {
  if (!element) return;
  element.style.left = `${clamp(percentage, 0, 100)}%`;
}

function saveTodaySession() {
  if (!state.valid || !saveSessionButton) return;
  const minutes = Math.max(0, Math.round(state.workedMinutes));
  if (minutes === 0) return;

  const entries = loadWeeklyEntries();
  const todayKey = toIsoDate(new Date());
  entries[todayKey] = minutes;
  storeWeeklyEntries(entries);
  renderWeek(entries);
  flashButtonLabel(saveSessionButton, "Gespeichert!");
}

function clearCurrentWeek() {
  if (!clearWeekButton) return;

  const entries = loadWeeklyEntries();
  const weekDates = getWeekDates(getWeekStart(new Date())).map((date) => toIsoDate(date));

  let changed = false;
  weekDates.forEach((dayKey) => {
    if (entries[dayKey]) {
      delete entries[dayKey];
      changed = true;
    }
  });

  if (changed) {
    storeWeeklyEntries(entries);
  }

  renderWeek(entries);
  flashButtonLabel(clearWeekButton, "Zurueckgesetzt!");
}

function handleStorageSync(event) {
  if (event.key === STORAGE_KEYS.weekly) {
    renderWeek();
  }
}

function flashButtonLabel(button, temporaryLabel) {
  const key = button.id === "save-session" ? "save" : "clear";
  const original =
    button.dataset.originalLabel ??
    BUTTON_LABELS[key] ??
    button.textContent;
  button.dataset.originalLabel = original;
  button.textContent = temporaryLabel;
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1400);
}

function renderWeek(entries = loadWeeklyEntries()) {
  if (!weeklyList || !weeklyTotal || !weeklyEmpty) return;

  const weekStart = getWeekStart(new Date());
  const weekDates = getWeekDates(weekStart);
  const todayKey = toIsoDate(new Date());
  const liveMinutes = state.valid ? Math.max(0, Math.round(state.workedMinutes)) : 0;

  weeklyList.innerHTML = "";

  const items = weekDates
    .map((date, index) => {
      const key = toIsoDate(date);
      const savedMinutes = entries[key] ?? 0;
      const isToday = key === todayKey;
      const showLive = isToday && liveMinutes > 0;
      return {
        label: DAY_LABELS[index],
        savedMinutes,
        key,
        isToday,
        showLive,
      };
    })
    .filter((item) => item.savedMinutes > 0 || item.showLive);

  const totalMinutes = weekDates.reduce((acc, date) => {
    const key = toIsoDate(date);
    return acc + (entries[key] ?? 0);
  }, 0);

  weeklyTotal.textContent = formatDuration(totalMinutes);
  weeklyEmpty.hidden = items.length > 0;

  if (items.length === 0) {
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "week__item";

    const day = document.createElement("span");
    day.className = "week__item-day";
    day.textContent = item.label;

    const content = document.createElement("div");
    content.className = "week__item-content";

    const stored = document.createElement("span");
    stored.className = "week__item-time";
    stored.textContent = item.savedMinutes > 0 ? formatDuration(item.savedMinutes) : "-";
    content.appendChild(stored);

    if (item.showLive) {
      const live = document.createElement("span");
      live.className = "week__item-meta";
      if (item.savedMinutes > 0) {
        const diff = Math.max(0, liveMinutes - item.savedMinutes);
        live.textContent = diff > 0
          ? `Live: ${formatDuration(liveMinutes)} (+${formatDuration(diff)})`
          : `Live: ${formatDuration(liveMinutes)}`;
      } else {
        live.textContent = `Live: ${formatDuration(liveMinutes)}`;
      }
      content.appendChild(live);
    }

    li.append(day, content);
    weeklyList.appendChild(li);
  });
}

function startAutoTick() {
  clearInterval(tickInterval);
  tickInterval = setInterval(updateCalculations, 30_000);
}

function parseTimeString(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
}

function toMinutes({ hours, minutes }) {
  return hours * 60 + minutes;
}

function formatDuration(minutes) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours} h ${pad(mins)} m`;
}

function formatClockTime(totalMinutes) {
  if (totalMinutes === null || Number.isNaN(totalMinutes)) return "--:--";
  const rounded = Math.round(totalMinutes);
  const minutesInDay = 24 * 60;
  const normalizedMinutes = ((rounded % minutesInDay) + minutesInDay) % minutesInDay;
  const dayOffset = Math.floor(rounded / minutesInDay);
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  const base = `${pad(hours)}:${pad(mins)} Uhr`;
  if (dayOffset <= 0) return base;
  const suffix = dayOffset === 1 ? " (+1 Tag)" : ` (+${dayOffset} Tage)`;
  return base + suffix;
}

function pad(value) {
  return value.toString().padStart(2, "0");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function getWeekStart(date) {
  const start = new Date(date);
  const day = start.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diff);
  return start;
}

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
}

function loadWeeklyEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.weekly);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function storeWeeklyEntries(entries) {
  localStorage.setItem(STORAGE_KEYS.weekly, JSON.stringify(entries));
}
