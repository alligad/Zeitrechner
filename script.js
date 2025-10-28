const STORAGE_KEYS = {
  start: "zeitrechner:startTime",
  pause: "zeitrechner:breakDuration",
  target: "zeitrechner:targetDuration",
};

const form = document.getElementById("time-form");
const startInput = document.getElementById("start-time");
const breakSelect = document.getElementById("break-duration");
const targetSelect = document.getElementById("target-duration");
const workedOutput = document.getElementById("current-worked");
const targetOutput = document.getElementById("target-end");
const maxOutput = document.getElementById("max-end");

const TEN_HOURS_IN_MINUTES = 10 * 60;

let tickInterval;

function init() {
  loadStoredValues();
  form.addEventListener("input", handleInputs);
  handleInputs();
  startAutoTick();
}

function handleInputs() {
  storeValues();
  updateCalculations();
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
  if (minutes <= 0) return "0 h 00 m";
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours} h ${pad(mins)} m`;
}

function formatClockTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalizedMinutes =
    ((Math.floor(totalMinutes) % minutesInDay) + minutesInDay) % minutesInDay;
  const dayOffset = Math.floor(totalMinutes / minutesInDay);
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

function updateCalculations() {
  const start = parseTimeString(startInput.value);
  const breakDuration = parseTimeString(breakSelect.value);
  const targetDuration = parseTimeString(targetSelect.value);

  if (!start || !breakDuration || !targetDuration) {
    workedOutput.textContent = "–";
    targetOutput.textContent = "–";
    maxOutput.textContent = "–";
    return;
  }

  const startMinutes = toMinutes(start);
  const breakMinutes = toMinutes(breakDuration);
  const targetMinutes = toMinutes(targetDuration);

  const now = new Date();
  const currentMinutes =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  let workedMinutes = currentMinutes - startMinutes - breakMinutes;
  if (workedMinutes < 0) {
    workedMinutes = 0;
  }

  workedOutput.textContent = formatDuration(workedMinutes);

  const endAtTarget = startMinutes + breakMinutes + targetMinutes;
  targetOutput.textContent = formatClockTime(endAtTarget);

  const endAtMax = startMinutes + TEN_HOURS_IN_MINUTES;
  maxOutput.textContent = formatClockTime(endAtMax);
}

function startAutoTick() {
  clearInterval(tickInterval);
  tickInterval = setInterval(updateCalculations, 30_000);
}

document.addEventListener("DOMContentLoaded", init);
