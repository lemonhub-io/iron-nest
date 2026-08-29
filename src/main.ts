/* Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later */

import "@fontsource/archivo-black";
import "@fontsource/special-elite";
import "@fontsource/caveat";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "@fontsource/noto-sans-sc/chinese-simplified-700.css";
import "./style.css";
import { SHELLS, type ShellId } from "./game/ballistics";
import { sfx } from "./game/audio";
import { createEngine, type CalcError, type FallNote } from "./game/engine";
import { bearingDeg, rangeKm } from "./game/geo";
import { mountMap } from "./ui/map";
import { applyDom, getLocale, setLocale, subscribeLocale, t, tList, type Locale } from "./i18n";

const engine = createEngine();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const boot = $<HTMLElement>("boot");
const duty = $<HTMLElement>("duty");
const paper = $<HTMLElement>("paper");
const ending = $<HTMLElement>("ending");
const dispatch = $<HTMLPreElement>("dispatch");
const chips = $<HTMLDivElement>("chips");
const rack = $<HTMLDivElement>("rack");
const pucks = $<HTMLDivElement>("pucks");
const calcPucks = $<HTMLDivElement>("calc-pucks");
const card = $<HTMLDListElement>("card");
const shotRecord = $<HTMLParagraphElement>("shot-record");
const correctionOut = $<HTMLParagraphElement>("correction-out");
const applyCorrectionBtn = $<HTMLButtonElement>("apply-correction");
const solutionCheck = $<HTMLOutputElement>("check-solution");
const powderCheck = $<HTMLOutputElement>("check-powder");
const layCheck = $<HTMLOutputElement>("check-lay");
const calcRange = $<HTMLInputElement>("calc-range");
const calcOut = $<HTMLParagraphElement>("calc-out");
const loadState = $<HTMLParagraphElement>("load-state");
const bearing = $<HTMLInputElement>("bearing");
const elev = $<HTMLInputElement>("elev");
const bearingOut = $<HTMLOutputElement>("bearing-out");
const elevOut = $<HTMLOutputElement>("elev-out");
const coach = $<HTMLParagraphElement>("coach");
const result = $<HTMLParagraphElement>("result");
const missionMeta = $<HTMLDivElement>("mission-meta");
const mapReadout = $<HTMLSpanElement>("map-readout");
const fireBtn = $<HTMLButtonElement>("fire");
const ramBtn = $<HTMLButtonElement>("ram");
const armBtn = $<HTMLButtonElement>("arm");
const stickyNote = $<HTMLElement>("sticky-note");
const noteText = $<HTMLDivElement>("note-text");
const noteClose = $<HTMLButtonElement>("note-close");
const noteSelectionMenu = $<HTMLElement>("note-selection-menu");
const noteCopy = $<HTMLButtonElement>("note-copy");
const noteDelete = $<HTMLButtonElement>("note-delete");

const map = mountMap($<HTMLCanvasElement>("map"), engine);
let lastChipSig = "";
let lastImpactAt = -1;
let lastWhir = 0;
let lastScratch = 0;
let visibleScreen: HTMLElement | null = null;
let lastMissionIndex = -1;
let dispatchSource = "";
let dispatchTimer: number | null = null;
let dispatchToken = 0;
let noteOpen = false;
let noteContent = "";
let noteAnchor = 0;
let noteFocus = 0;
let noteDragging = false;
const NOTE_STORAGE = "iron-nest-field-note";

try {
  noteContent = localStorage.getItem(NOTE_STORAGE) ?? "";
} catch {
  /* local storage may be unavailable */
}

const STATIONS = ["tele", "map", "ammo", "calc", "gun"] as const;
type Station = (typeof STATIONS)[number];
let station: Station = "tele";

const PIPE_STATION: Record<"plot" | "calc" | "load" | "lay" | "arm" | "fire", Station> = {
  plot: "map",
  calc: "calc",
  load: "ammo",
  lay: "gun",
  arm: "gun",
  fire: "gun",
};

function setStation(next: Station, sound = true) {
  if (station === next) {
    if (next === "map") requestAnimationFrame(() => map.relayout());
    return;
  }
  station = next;
  duty.dataset.station = next;
  document.querySelectorAll<HTMLElement>(".station").forEach((el) => {
    el.classList.toggle("on", el.dataset.station === next);
  });
  document.querySelectorAll<HTMLButtonElement>(".stations [data-station]").forEach((b) => {
    b.classList.toggle("on", b.dataset.station === next);
  });
  if (sound) sfx.tick();
  if (next === "map") requestAnimationFrame(() => map.relayout());
}

function syncGunGauges(shownBearing: number, shownElev: number) {
  duty.style.setProperty("--bearing", String(shownBearing));
  duty.style.setProperty("--elev", String(shownElev));
}

function show(el: HTMLElement) {
  for (const s of [boot, duty, paper, ending]) s.classList.toggle("hidden", s !== el);
  if (visibleScreen === el) return;
  visibleScreen = el;
  el.classList.remove("entering");
  void el.offsetWidth;
  el.classList.add("entering");
  if (el === duty) requestAnimationFrame(() => {
    if (station === "map") map.relayout();
  });
}

function markerName(id: string) {
  return t(`marker.${id}`);
}

function typeDispatch(text: string) {
  if (text === dispatchSource) return;
  dispatchSource = text;
  dispatchToken += 1;
  const token = dispatchToken;
  if (dispatchTimer != null) window.clearTimeout(dispatchTimer);
  dispatch.textContent = "";
  dispatch.classList.add("typing");

  let index = 0;
  const printNext = () => {
    if (token !== dispatchToken) return;
    index += 1;
    dispatch.textContent = text.slice(0, index);
    if (index >= text.length) {
      dispatch.classList.remove("typing");
      dispatchTimer = null;
      return;
    }
    const last = text[index - 1];
    const delay = last === "\n" ? 260 : last === " " ? 22 : 58;
    dispatchTimer = window.setTimeout(printNext, delay);
  };
  dispatchTimer = window.setTimeout(printNext, 220);
}

function noteSelection() {
  return {
    start: Math.min(noteAnchor, noteFocus),
    end: Math.max(noteAnchor, noteFocus),
  };
}

function persistNote() {
  try {
    localStorage.setItem(NOTE_STORAGE, noteContent);
  } catch {
    /* local storage may be unavailable */
  }
}

function renderNote() {
  const { start, end } = noteSelection();
  noteText.replaceChildren();
  if (!noteContent) {
    const placeholder = document.createElement("span");
    placeholder.className = "note-placeholder";
    placeholder.textContent = noteText.dataset.placeholder ?? "";
    noteText.appendChild(placeholder);
  }
  for (let index = 0; index <= noteContent.length; index += 1) {
    if (start === end && index === noteFocus) {
      const caret = document.createElement("i");
      caret.className = "note-caret";
      noteText.appendChild(caret);
    }
    if (index === noteContent.length) continue;
    const char = document.createElement("span");
    char.className = "note-char";
    char.dataset.noteIndex = String(index);
    if (index >= start && index < end) char.classList.add("selected");
    if (noteContent[index] === "\n") {
      char.classList.add("note-break");
      char.textContent = "\u00a0";
    } else {
      char.textContent = noteContent[index] === " " ? "\u00a0" : noteContent[index];
    }
    noteText.appendChild(char);
  }
  const endMarker = document.createElement("span");
  endMarker.className = "note-end";
  endMarker.dataset.noteIndex = String(noteContent.length);
  noteText.appendChild(endMarker);
  noteSelectionMenu.classList.toggle("hidden", start === end);
}

function focusNote() {
  noteText.focus();
  noteText.classList.add("focused");
}

function setNoteSelection(anchor: number, focus: number) {
  const last = noteContent.length;
  noteAnchor = Math.max(0, Math.min(last, anchor));
  noteFocus = Math.max(0, Math.min(last, focus));
  renderNote();
}

function replaceNoteSelection(text: string) {
  const { start, end } = noteSelection();
  noteContent = noteContent.slice(0, start) + text + noteContent.slice(end);
  const caret = start + text.length;
  noteAnchor = caret;
  noteFocus = caret;
  persistNote();
  renderNote();
}

function toggleNote(open = !noteOpen) {
  noteOpen = open;
  stickyNote.classList.toggle("hidden", !noteOpen);
  if (noteOpen) focusNote();
}

function chipLabel(chip: { kind: string; id?: string; grid?: string; originId?: string; deg?: number }) {
  if (chip.kind === "coord" && chip.grid && chip.id) {
    return t("chip.coord", { grid: chip.grid, name: markerName(chip.id) });
  }
  if (chip.kind === "bearing" && chip.originId != null && chip.deg != null) {
    return t("chip.bearing", {
      name: markerName(chip.originId),
      deg: chip.deg.toFixed(1),
    });
  }
  return "";
}

function calcText(err: CalcError | null, elev: number | null, charges: number) {
  if (err?.kind === "needRange") return t("calc.needRange");
  if (err?.kind === "needPowder") return t("calc.needPowder", { charges: err.charges, max: err.max });
  if (err?.kind === "uglyAngle") return t("calc.uglyAngle");
  if (elev != null) return t("calc.solution", { elev: elev.toFixed(1), charges });
  return t("calc.empty");
}

function fallText(note: FallNote | null) {
  if (!note) return "";
  if (note.kind === "empty") return t("fire.empty");
  if (note.kind === "notArmed") return t("fire.notArmed");
  if (note.kind === "hit") {
    return t("fire.hit", { shell: note.shell, name: markerName(note.markerId), grid: note.grid });
  }
  if (note.kind === "missNear") {
    const range =
      note.range === "long" ? t("fire.long") : note.range === "short" ? t("fire.short") : t("fire.rangeGood");
    const side =
      note.side === "left" ? t("fire.left") : note.side === "right" ? t("fire.right") : t("fire.line");
    return t("fire.missNear", { grid: note.grid, range, side, name: markerName(note.markerId) });
  }
  return t("fire.missOpen", {
    grid: note.grid,
    title: t(`mission.${note.missionId}.title`),
  });
}

function correctionText(
  correction: { rangeKm: number; deflectionDeg: number; targetId: string; applied: boolean } | null,
) {
  if (!correction) return t("spot.empty");
  if (correction.applied) return t("spot.applied");
  const rangeDir = correction.rangeKm >= 0 ? t("spot.add") : t("spot.drop");
  const deflectionDir = correction.deflectionDeg >= 0 ? t("spot.right") : t("spot.left");
  return t("spot.correction", {
    target: markerName(correction.targetId),
    range: Math.abs(correction.rangeKm).toFixed(1),
    rangeDir,
    deflection: Math.abs(correction.deflectionDeg).toFixed(1),
    deflectionDir,
  });
}

function rackHtml() {
  rack.innerHTML = "";
  (Object.keys(SHELLS) as ShellId[]).forEach((id) => {
    const spec = SHELLS[id];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "shell";
    b.dataset.shell = id;
    b.innerHTML = `<i class="glyph" style="--band:${spec.band};background:${spec.color}"></i><span><b>${id}</b><span class="job">${t(`shell.${id}.job`)}</span></span>`;
    b.addEventListener("click", () => {
      sfx.tick();
      engine.selectShell(id);
    });
    rack.appendChild(b);
  });
}

function puckRow(root: HTMLElement, attr: "load" | "calc") {
  root.innerHTML = "";
  for (let i = 1; i <= 6; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "puck";
    b.dataset.n = String(i);
    b.dataset.kind = attr;
    b.textContent = String(i);
    b.addEventListener("click", () => {
      sfx.tick();
      if (attr === "load") engine.setLoadCharges(i);
      else engine.setCalcCharges(i);
    });
    root.appendChild(b);
  }
}

rackHtml();
puckRow(pucks, "load");
puckRow(calcPucks, "calc");

$<HTMLButtonElement>("begin").addEventListener("click", () => {
  sfx.unlock();
  sfx.stamp();
  engine.startDuty();
});

document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) => {
  b.addEventListener("click", () => {
    sfx.tick();
    setLocale(b.dataset.lang as Locale);
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-wire]").forEach((b) => {
  b.addEventListener("click", () => {
    sfx.tick();
    engine.setWire(b.dataset.wire as "command" | "front");
  });
});

document.querySelectorAll<HTMLButtonElement>(".stations [data-station]").forEach((b) => {
  b.addEventListener("click", () => {
    setStation(b.dataset.station as Station);
  });
});

document.querySelectorAll<HTMLElement>("[data-pipe]").forEach((el) => {
  el.addEventListener("click", () => {
    const step = el.dataset.pipe as keyof typeof PIPE_STATION;
    if (step in PIPE_STATION) setStation(PIPE_STATION[step]);
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((b) => {
  b.addEventListener("click", () => {
    sfx.pencil();
    engine.setTool(b.dataset.tool as "red" | "yellow" | "white" | "erase");
  });
});

$<HTMLButtonElement>("clear-plot").addEventListener("click", () => {
  sfx.pencil();
  engine.clearPlot();
});

$<HTMLButtonElement>("copy-range").addEventListener("click", () => {
  sfx.tick();
  engine.copyRange();
});

$<HTMLButtonElement>("calculate").addEventListener("click", () => {
  sfx.clunk();
  engine.calculate();
});

ramBtn.addEventListener("click", () => {
  if (engine.getState().rammed) {
    sfx.deny();
    return;
  }
  sfx.ram();
  engine.ram();
});

armBtn.addEventListener("click", () => {
  const s = engine.getState();
  if (!s.rammed) {
    sfx.deny();
    return;
  }
  sfx.arm();
  engine.arm();
});

applyCorrectionBtn.addEventListener("click", () => {
  sfx.stamp();
  engine.applyCorrection();
});

function fireWeapon() {
  const s = engine.getState();
  if (!s.rammed || !s.armed || s.screen !== "duty") {
    sfx.deny();
    engine.fire();
    return;
  }
  sfx.fire();
  try {
    navigator.vibrate?.(40);
  } catch {
    /* ignore */
  }
  engine.fire();
}

fireBtn.addEventListener("click", () => {
  if (fireBtn.dataset.dragged === "true") {
    delete fireBtn.dataset.dragged;
    return;
  }
  fireWeapon();
});

let pullingFire = false;

fireBtn.addEventListener("pointerdown", (event) => {
  if (fireBtn.disabled) return;
  pullingFire = true;
  fireBtn.setPointerCapture(event.pointerId);
  fireBtn.classList.add("pulling");
  event.preventDefault();
});

fireBtn.addEventListener("pointermove", (event) => {
  if (!pullingFire) return;
  const rect = fireBtn.getBoundingClientRect();
  const travel = Math.max(1, rect.height - 48);
  const progress = Math.max(0, Math.min(1, (event.clientY - rect.top - 24) / travel));
  fireBtn.style.setProperty("--pull", String(progress));
  fireBtn.style.setProperty("--pull-offset", `${progress * travel}px`);
  fireBtn.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  event.preventDefault();
});

function releaseFireLever(event: PointerEvent) {
  if (!pullingFire) return;
  const progress = Number(fireBtn.style.getPropertyValue("--pull")) || 0;
  pullingFire = false;
  fireBtn.classList.remove("pulling");
  fireBtn.style.setProperty("--pull", "0");
  fireBtn.style.setProperty("--pull-offset", "0px");
  fireBtn.setAttribute("aria-valuenow", "0");
  if (progress >= 0.88) {
    fireBtn.dataset.dragged = "true";
    fireWeapon();
  }
  try {
    fireBtn.releasePointerCapture(event.pointerId);
  } catch {
    /* pointer capture may already be released */
  }
}

fireBtn.addEventListener("pointerup", releaseFireLever);
fireBtn.addEventListener("pointercancel", releaseFireLever);

noteClose.addEventListener("click", () => toggleNote(false));

function noteIndexAt(x: number, y: number) {
  const target = document.elementFromPoint(x, y);
  const indexed = target?.closest<HTMLElement>("[data-note-index]");
  return indexed?.dataset.noteIndex == null ? noteContent.length : Number(indexed.dataset.noteIndex);
}

noteText.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const index = noteIndexAt(event.clientX, event.clientY);
  noteDragging = true;
  noteText.setPointerCapture(event.pointerId);
  setNoteSelection(event.shiftKey ? noteAnchor : index, index);
  focusNote();
});

noteText.addEventListener("pointermove", (event) => {
  if (!noteDragging) return;
  setNoteSelection(noteAnchor, noteIndexAt(event.clientX, event.clientY));
});

noteText.addEventListener("pointerup", (event) => {
  noteDragging = false;
  try {
    noteText.releasePointerCapture(event.pointerId);
  } catch {
    /* pointer capture may already be released */
  }
});

noteText.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});
noteText.addEventListener("dragstart", (event) => event.preventDefault());

noteText.addEventListener("paste", (event) => {
  event.preventDefault();
  replaceNoteSelection(event.clipboardData?.getData("text/plain") ?? "");
});

noteText.addEventListener("keydown", (event) => {
  event.stopPropagation();
  const { start, end } = noteSelection();
  const extend = event.shiftKey;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    setNoteSelection(0, noteContent.length);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    event.preventDefault();
    void navigator.clipboard.writeText(noteContent.slice(start, end));
    return;
  }
  if (event.key === "Backspace") {
    event.preventDefault();
    if (start !== end) replaceNoteSelection("");
    else if (start > 0) {
      noteAnchor = start - 1;
      noteFocus = start;
      replaceNoteSelection("");
    }
    return;
  }
  if (event.key === "Delete") {
    event.preventDefault();
    if (start !== end) replaceNoteSelection("");
    else if (end < noteContent.length) {
      noteAnchor = end;
      noteFocus = end + 1;
      replaceNoteSelection("");
    }
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    replaceNoteSelection("\n");
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    const next = Math.max(0, Math.min(noteContent.length, noteFocus + (event.key === "ArrowLeft" ? -1 : 1)));
    setNoteSelection(extend ? noteAnchor : next, next);
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    const next = event.key === "Home" ? 0 : noteContent.length;
    setNoteSelection(extend ? noteAnchor : next, next);
    return;
  }
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    replaceNoteSelection(event.key);
  }
});

noteCopy.addEventListener("click", async () => {
  const { start, end } = noteSelection();
  const selected = noteContent.slice(start, end);
  if (!selected) return;
  try {
    await navigator.clipboard.writeText(selected);
  } catch { /* clipboard permission was not granted */ }
});

noteDelete.addEventListener("click", () => {
  const { start, end } = noteSelection();
  if (start === end) return;
  replaceNoteSelection("");
  focusNote();
});

$<HTMLButtonElement>("hint").addEventListener("click", () => engine.hint());

$<HTMLButtonElement>("cat").addEventListener("click", () => sfx.meow());

$<HTMLButtonElement>("paper-next").addEventListener("click", () => {
  sfx.stamp();
  engine.dismissPaper();
});

$<HTMLButtonElement>("again").addEventListener("click", () => {
  engine.restart();
});

calcRange.addEventListener("change", () => {
  engine.setCalcRange(Number(calcRange.value) || 0);
});

bearing.addEventListener("input", () => engine.setGunBearing(Number(bearing.value)));
elev.addEventListener("input", () => engine.setGunElev(Number(elev.value)));

window.addEventListener("keydown", (e) => {
  if (e.key === "e" || e.key === "E") {
    if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      toggleNote();
    }
    return;
  }
  if (e.target instanceof HTMLInputElement && e.target.type === "number") return;
  const s = engine.getState();
  if (s.screen !== "duty") return;
  if (e.key === "Escape") {
    engine.cancelPending();
    return;
  }
  if (e.key === "[" || e.key === "]") {
    e.preventDefault();
    const i = STATIONS.indexOf(station);
    const next = e.key === "]" ? (i + 1) % STATIONS.length : (i + STATIONS.length - 1) % STATIONS.length;
    setStation(STATIONS[next]);
    return;
  }
  if (e.key === "1") engine.selectShell("HE");
  if (e.key === "2") engine.selectShell("AP");
  if (e.key === "3") engine.selectShell("STAR");
  if (e.key === "4") engine.selectShell("SMK");
  if (e.key === "5") engine.selectShell("PRPG");
  if (e.key === "r" || e.key === "R") {
    if (!s.rammed) {
      sfx.ram();
      engine.ram();
    }
  }
  if (e.key === "a" || e.key === "A") {
    if (s.rammed) {
      sfx.arm();
      engine.arm();
    } else sfx.deny();
  }
  if (e.key === "c" || e.key === "C") {
    sfx.clunk();
    engine.calculate();
  }
  if (e.key === "f" || e.key === "F" || e.key === " ") {
    e.preventDefault();
    fireBtn.click();
  }
});

function fmt(n: number | null, u: string) {
  return n == null ? "-" : `${n.toFixed(n % 1 === 0 ? 0 : 1)}${u}`;
}

function render() {
  applyDom();
  renderNote();
  const s = engine.getState();
  if (s.screen === "boot") show(boot);
  else if (s.screen === "paper") show(paper);
  else if (s.screen === "ending") show(ending);
  else show(duty);

  const m = s.missions[s.missionIndex];
  if (s.screen === "duty" && s.missionIndex !== lastMissionIndex) {
    lastMissionIndex = s.missionIndex;
    setStation("tele", false);
  }
  missionMeta.textContent = `${t(`mission.${m.id}.date`)}  /  ${t(`mission.${m.id}.place`)}  /  ${t(`mission.${m.id}.title`)}`;

  const d = m.dispatches.find((x) => x.source === s.wire) ?? m.dispatches[0];
  const vars: Record<string, string> = {};
  for (const c of d.chips) {
    if (c.kind === "bearing") vars[c.originId] = c.deg.toFixed(1);
  }
  typeDispatch(t(d.bodyKey, vars));
  const chipSig = `${s.missionIndex}:${s.wire}:${getLocale()}`;
  if (chipSig !== lastChipSig) {
    lastChipSig = chipSig;
    chips.innerHTML = "";
    d.chips.forEach((c, index) => {
      // Coordinate slips are information only. The player must plot their
      // contents on the map instead of revealing the marker by clicking it.
      const el = document.createElement("span");
      el.className = "chip";
      el.style.animationDelay = `${index * 45}ms`;
      el.textContent = chipLabel(c);
      chips.appendChild(el);
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-wire]").forEach((b) => {
    b.classList.toggle("on", b.dataset.wire === s.wire);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((b) => {
    b.classList.toggle("on", b.dataset.tool === s.tool);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-shell]").forEach((b) => {
    b.classList.toggle("on", b.dataset.shell === s.selectedShell);
    const job = b.querySelector(".job");
    if (job && b.dataset.shell) job.textContent = t(`shell.${b.dataset.shell}.job`);
  });
  pucks.querySelectorAll<HTMLButtonElement>(".puck").forEach((b) => {
    b.classList.toggle("on", Number(b.dataset.n) === s.loadCharges);
  });
  calcPucks.querySelectorAll<HTMLButtonElement>(".puck").forEach((b) => {
    b.classList.toggle("on", Number(b.dataset.n) === s.calcCharges);
  });

  if (document.activeElement !== calcRange) {
    calcRange.value = s.calcRange ? String(s.calcRange) : "";
  }

  const cl = s.clipboard;
  card.innerHTML = `
    <dt>${t("duty.cardBearing")}</dt><dd>${fmt(cl.bearing, "°")}</dd>
    <dt>${t("duty.cardRange")}</dt><dd>${fmt(cl.range, " km")}</dd>
    <dt>${t("duty.cardPowder")}</dt><dd>${cl.charges ?? "-"}</dd>
    <dt>${t("duty.cardElev")}</dt><dd>${fmt(cl.elevation, "°")}</dd>
    <dt>${t("duty.cardShell")}</dt><dd>${cl.shell ?? s.selectedShell}</dd>
  `;

  shotRecord.textContent = s.lastShot
    ? t("spot.round", {
        round: s.lastShot.round,
        shell: s.lastShot.shell,
        charges: s.lastShot.charges,
        grid: s.lastShot.grid,
      })
    : t("spot.noRound");
  correctionOut.textContent = correctionText(s.correction);
  applyCorrectionBtn.disabled = !s.correction || s.correction.applied || s.rammed;

  const control = engine.fireControl();
  solutionCheck.textContent = control.solution ? t("control.set") : t("control.check");
  powderCheck.textContent = control.powder ? t("control.ready") : t("control.check");
  layCheck.textContent = control.lay ? t("control.ready") : t("control.check");
  solutionCheck.classList.toggle("ok", control.solution);
  powderCheck.classList.toggle("ok", control.powder);
  layCheck.classList.toggle("ok", control.lay);

  calcOut.textContent = calcText(s.calcError, s.calcElev, s.calcCharges);

  loadState.textContent = s.rammed
    ? t("load.rammed", { shell: s.selectedShell, charges: s.loadCharges })
    : t("load.open", { shell: s.selectedShell, charges: s.loadCharges });

  ramBtn.disabled = s.rammed;
  ramBtn.classList.toggle("on", s.rammed);
  armBtn.classList.toggle("on", s.armed);
  armBtn.textContent = s.armed ? t("duty.armed") : t("duty.arm");
  const pipe = engine.pipe();
  fireBtn.disabled = s.screen === "flight";
  fireBtn.classList.toggle("hot", pipe.fire && s.screen === "duty");

  const match = engine.cardMatched();
  if (document.activeElement !== bearing) bearing.value = String(s.shownBearing);
  if (document.activeElement !== elev) elev.value = String(s.shownElev);
  bearingOut.textContent = `${s.shownBearing.toFixed(1)}°`;
  elevOut.textContent = `${s.shownElev.toFixed(1)}°`;
  bearingOut.classList.toggle("ok", match.bearing);
  elevOut.classList.toggle("ok", match.elev);
  syncGunGauges(s.shownBearing, s.shownElev);

  const steps: Array<"plot" | "calc" | "load" | "lay" | "arm" | "fire"> = [
    "plot",
    "calc",
    "load",
    "lay",
    "arm",
    "fire",
  ];
  const next = steps.find((k) => !pipe[k]);
  document.querySelectorAll<HTMLElement>("[data-pipe]").forEach((el) => {
    const k = el.dataset.pipe as (typeof steps)[number];
    el.classList.toggle("on", pipe[k]);
    el.classList.toggle("next", k === next);
  });
  const due = next ? PIPE_STATION[next] : null;
  document.querySelectorAll<HTMLButtonElement>(".stations [data-station]").forEach((b) => {
    b.classList.toggle("due", b.dataset.station === due && b.dataset.station !== station);
  });

  const latest = s.impacts[s.impacts.length - 1];
  if (latest && latest.at !== lastImpactAt) {
    lastImpactAt = latest.at;
    sfx.impact();
  }

  const hints = tList(`mission.${m.id}.coach`);
  coach.textContent = hints[Math.min(s.coachIndex, Math.max(0, hints.length - 1))] ?? "";
  result.textContent = fallText(s.lastResult);
  const grid = map.hoverGrid();
  mapReadout.textContent = grid ? grid : s.pending ? t("map.second") : t("map.first");

  if (s.shake > 0) {
    duty.classList.remove("shake");
    void duty.offsetWidth;
    duty.classList.add("shake");
  } else {
    duty.classList.remove("shake");
  }

  if (s.paper) {
    $("paper-mast").textContent = t("paper.masthead");
    if (s.paper.kind === "ending") {
      $("paper-head").textContent = t(`ending.${s.paper.id}.title`);
      $("paper-lede").textContent = t(`ending.${s.paper.id}.kicker`);
    } else {
      const which = s.paper.kind === "hit" ? "paperHit" : "paperMiss";
      $("paper-head").textContent = t(`mission.${m.id}.${which}Headline`);
      $("paper-lede").textContent = t(`mission.${m.id}.${which}Lede`);
    }
  }
  if (s.endingId) {
    $("end-title").textContent = t(`ending.${s.endingId}.title`);
    $("end-kicker").textContent = t(`ending.${s.endingId}.kicker`);
    $("end-body").textContent = t(`ending.${s.endingId}.body`);
  }

  map.draw();
}

function tickUi() {
  map.draw();
  const s = engine.getState();
  const grid = map.hoverGrid();
  if (s.tool === "yellow" && s.pending && s.hover) {
    mapReadout.textContent = t("map.yellowReference", {
      bearing: bearingDeg(s.pending, s.hover).toFixed(1),
      range: rangeKm(s.pending, s.hover).toFixed(2),
    });
  } else {
    mapReadout.textContent = grid ? grid : s.pending ? t("map.second") : t("map.first");
  }
  if (document.activeElement !== bearing) bearing.value = String(s.shownBearing);
  if (document.activeElement !== elev) elev.value = String(s.shownElev);
  bearingOut.textContent = `${s.shownBearing.toFixed(1)}°`;
  elevOut.textContent = `${s.shownElev.toFixed(1)}°`;
  syncGunGauges(s.shownBearing, s.shownElev);
  const now = performance.now();
  if (s.slewing && now - lastWhir > 70) {
    lastWhir = now;
    sfx.whir();
  }
  if (s.dragging && now - lastScratch > 55) {
    lastScratch = now;
    sfx.scratch();
  }
}

engine.subscribe(render);
engine.subscribeTick(tickUi);
subscribeLocale(render);
applyDom();
render();

if (!import.meta.env.DEV && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* The game remains playable online if registration is unavailable. */
    });
  });
}
