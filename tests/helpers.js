// Shared test helpers.

const STORAGE_KEY = "uniScheduleIcs.v3";

function course(over){
  return Object.assign({
    id: "c" + Math.random().toString(36).slice(2, 8), day: "Monday", start: "08:00", end: "10:00",
    name: "Algebra", acronym: "ALG", type: "Course", professor: "Popescu", room: "C112",
    credits: 5, parity: "all", enrolled: true
  }, over);
}

function appState(over){
  const o = over || {};
  return {
    courses: o.courses || [],
    holidays: o.holidays || [],
    settings: Object.assign({
      calName: "Test", reminderMinutes: "15", creditsNeeded: "", semStart: "", semEnd: "",
      parityMode: "iso", timeZone: ""
    }, o.settings)
  };
}

// Seeds localStorage before the app script runs, once per test (not again on reload).
async function openWith(page, state){
  await page.addInitScript(([key, value])=>{
    if(!sessionStorage.getItem("__seeded")){
      localStorage.setItem(key, value);
      sessionStorage.setItem("__seeded", "1");
    }
  }, [STORAGE_KEY, JSON.stringify(state)]);
  await page.goto("./");
}

// --- Minimal .ics expander for the subset the app writes ---
function parseDay(s){ return Date.UTC(+s.slice(0,4), +s.slice(4,6) - 1, +s.slice(6,8)); }
function fmtDay(ms){ return new Date(ms).toISOString().slice(0,10); }

// Returns { [uid]: ["YYYY-MM-DD", ...] } with the actual occurrence dates.
function expandIcs(ics){
  const text = ics.replace(/\r\n /g, "");
  const out = {};
  for(const block of text.split("BEGIN:VEVENT").slice(1)){
    const ev = block.split("END:VEVENT")[0];
    const uid = ev.match(/^UID:(.*)$/m)[1].trim();
    const start = parseDay(ev.match(/^DTSTART[^:]*:(\d{8})/m)[1]);
    const rrule = ev.match(/^RRULE:(.*)$/m)[1];
    const interval = Number((rrule.match(/INTERVAL=(\d+)/) || [0, 1])[1]);
    const until = parseDay(rrule.match(/UNTIL=(\d{8})/)[1]);
    const exLine = ev.match(/^EXDATE[^:]*:(.*)$/m);
    const ex = new Set(exLine ? exLine[1].trim().split(",").map(v => fmtDay(parseDay(v))) : []);
    const dates = [];
    for(let d = start; d <= until; d += interval * 7 * 86400000){
      if(!ex.has(fmtDay(d))) dates.push(fmtDay(d));
    }
    out[uid.split("@")[0]] = dates;
  }
  return out;
}

// Independent ISO-8601 week number (not the app's implementation).
function isoWeek(ymd){
  const d = new Date(ymd + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function mondays(from, to){
  const out = [];
  for(let d = Date.parse(from + "T00:00:00Z"); d <= Date.parse(to + "T00:00:00Z"); d += 7 * 86400000) out.push(fmtDay(d));
  return out;
}

module.exports = { STORAGE_KEY, course, appState, openWith, expandIcs, isoWeek, mondays };
