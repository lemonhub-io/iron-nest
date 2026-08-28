import "@fontsource/archivo-black";
import "@fontsource/special-elite";
import "@fontsource/caveat";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "./style.css";
import { SHELLS, type ShellId } from "./game/ballistics";
import { sfx } from "./game/audio";
import { createEngine, type CalcError, type FallNote } from "./game/engine";
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

const map = mountMap($<HTMLCanvasElement>("map"), engine);
let lastChipSig = "";
let lastImpactAt = -1;
let lastWhir = 0;
let lastScratch = 0;

function show(el: HTMLElement) {
  for (const s of [boot, duty, paper, ending]) s.classList.toggle("hidden", s !== el);
}

function markerName(id: string) {
  return t(`marker.${id}`);
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

$<HTMLButtonElement>("lay").addEventListener("click", () => {
  sfx.clunk();
  engine.layFromCard();
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

fireBtn.addEventListener("click", () => {
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
  if (e.target instanceof HTMLInputElement && e.target.type === "number") return;
  const s = engine.getState();
  if (s.screen !== "duty") return;
  if (e.key === "Escape") {
    engine.cancelPending();
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
  if (e.key === "l" || e.key === "L") {
    sfx.clunk();
    engine.layFromCard();
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
  const s = engine.getState();
  if (s.screen === "boot") show(boot);
  else if (s.screen === "paper") show(paper);
  else if (s.screen === "ending") show(ending);
  else show(duty);

  const m = s.missions[s.missionIndex];
  missionMeta.textContent = `${t(`mission.${m.id}.date`)}  /  ${t(`mission.${m.id}.place`)}  /  ${t(`mission.${m.id}.title`)}`;

  const d = m.dispatches.find((x) => x.source === s.wire) ?? m.dispatches[0];
  const vars: Record<string, string> = {};
  for (const c of d.chips) {
    if (c.kind === "bearing") vars[c.originId] = c.deg.toFixed(1);
  }
  dispatch.textContent = t(d.bodyKey, vars);
  const chipSig = `${s.missionIndex}:${s.wire}:${getLocale()}`;
  if (chipSig !== lastChipSig) {
    lastChipSig = chipSig;
    chips.innerHTML = "";
    for (const c of d.chips) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = chipLabel(c);
      b.addEventListener("click", () => {
        sfx.stamp();
        engine.useChip(c);
      });
      chips.appendChild(b);
    }
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
  mapReadout.textContent = grid ? grid : s.pending ? t("map.second") : t("map.first");
  if (document.activeElement !== bearing) bearing.value = String(s.shownBearing);
  if (document.activeElement !== elev) elev.value = String(s.shownElev);
  bearingOut.textContent = `${s.shownBearing.toFixed(1)}°`;
  elevOut.textContent = `${s.shownElev.toFixed(1)}°`;
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
