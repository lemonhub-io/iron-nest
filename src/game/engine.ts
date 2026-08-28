import {
  SHELLS,
  elevationFor,
  maxRange,
  solveShot,
  flightSeconds,
  type ShellId,
} from "./ballistics";
import {
  bearingDeg,
  dist,
  formatGrid,
  intersectSeg,
  project,
  rangeKm,
  type Km,
} from "./geo";
import {
  buildMissions,
  type Chip,
  type EndingId,
  type MarkerKind,
  type Mission,
} from "./missions";

export type Tool = "red" | "yellow" | "white" | "erase";
export type Screen = "boot" | "duty" | "flight" | "paper" | "ending";
export type Wire = "command" | "front";

export interface Marker {
  id: string;
  kind: MarkerKind;
  pos: Km;
  hidden: boolean;
  hard: boolean;
  dead: boolean;
}

export type CalcError =
  | { kind: "needRange" }
  | { kind: "needPowder"; charges: number; max: string }
  | { kind: "uglyAngle" };

export type FallNote =
  | { kind: "empty" }
  | { kind: "notArmed" }
  | { kind: "hit"; shell: ShellId; markerId: string; grid: string }
  | {
      kind: "missNear";
      grid: string;
      range: "long" | "short" | "good";
      side: "left" | "right" | "line";
      markerId: string;
    }
  | { kind: "missOpen"; grid: string; missionId: string };

export type PaperState =
  | { kind: "hit" }
  | { kind: "miss" }
  | { kind: "ending"; id: EndingId };

export interface Stroke {
  id: string;
  tool: "red" | "yellow" | "white";
  from: Km;
  to: Km;
}

export interface Impact {
  pos: Km;
  shell: ShellId;
  note: FallNote;
}

export interface Clipboard {
  bearing: number | null;
  range: number | null;
  charges: number | null;
  elevation: number | null;
  shell: ShellId | null;
}

export interface GameState {
  screen: Screen;
  missionIndex: number;
  missions: Mission[];
  wire: Wire;
  markers: Marker[];
  strokes: Stroke[];
  tool: Tool;
  pending: Km | null;
  clipboard: Clipboard;
  calcRange: number;
  calcCharges: number;
  calcElev: number | null;
  calcError: CalcError | null;
  selectedShell: ShellId;
  loadCharges: number;
  rammed: boolean;
  gunBearing: number;
  gunElev: number;
  armed: boolean;
  impacts: Impact[];
  tracer: { from: Km; to: Km; t: number } | null;
  missCount: number;
  coachIndex: number;
  lastResult: FallNote | null;
  paper: PaperState | null;
  endingId: EndingId | null;
  shake: number;
  revealed: boolean;
}

let seq = 1;
const nid = () => `n${seq++}`;

function cloneMissionMarkers(m: Mission): Marker[] {
  return m.markers.map((s) => ({
    id: s.id,
    kind: s.kind,
    pos: { ...s.pos },
    hidden: Boolean(s.hidden),
    hard: Boolean(s.hard),
    dead: false,
  }));
}

function emptyClip(): Clipboard {
  return { bearing: null, range: null, charges: null, elevation: null, shell: null };
}

export function createEngine() {
  const missions = buildMissions();
  const listeners = new Set<() => void>();

  const state: GameState = {
    screen: "boot",
    missionIndex: 0,
    missions,
    wire: "command",
    markers: cloneMissionMarkers(missions[0]),
    strokes: [],
    tool: "red",
    pending: null,
    clipboard: emptyClip(),
    calcRange: 0,
    calcCharges: 4,
    calcElev: null,
    calcError: null,
    selectedShell: "HE",
    loadCharges: 4,
    rammed: false,
    gunBearing: 0,
    gunElev: 20,
    armed: false,
    impacts: [],
    tracer: null,
    missCount: 0,
    coachIndex: 0,
    lastResult: null,
    paper: null,
    endingId: null,
    shake: 0,
    revealed: false,
  };

  const notify = () => listeners.forEach((fn) => fn());

  const mission = () => state.missions[state.missionIndex];

  const nest = (): Marker => state.markers.find((m) => m.kind === "nest")!;

  function loadMission(i: number) {
    state.missionIndex = i;
    state.markers = cloneMissionMarkers(state.missions[i]);
    state.strokes = [];
    state.pending = null;
    state.clipboard = emptyClip();
    state.calcRange = 0;
    state.calcCharges = 4;
    state.calcElev = null;
    state.calcError = null;
    state.selectedShell = "HE";
    state.loadCharges = 4;
    state.rammed = false;
    state.gunBearing = 0;
    state.gunElev = 20;
    state.armed = false;
    state.impacts = [];
    state.tracer = null;
    state.missCount = 0;
    state.coachIndex = 0;
    state.lastResult = null;
    state.paper = null;
    state.wire = "command";
    state.revealed = false;
    state.tool = "red";
  }

  function pushStroke(tool: Stroke["tool"], from: Km, to: Km) {
    state.strokes.push({ id: nid(), tool, from: { ...from }, to: { ...to } });
    if (tool === "red") {
      state.clipboard.bearing = round1(bearingDeg(from, to));
      state.clipboard.range = round2(rangeKm(from, to));
      state.calcRange = state.clipboard.range;
      bumpCoach(1);
    }
    maybeFix();
  }

  function maybeFix() {
    const yellow = state.strokes.filter((s) => s.tool === "yellow");
    if (yellow.length < 2) return;
    const a = yellow[yellow.length - 2];
    const b = yellow[yellow.length - 1];
    const hit = intersectSeg(a.from, a.to, b.from, b.to);
    if (!hit) return;
    const existing = state.markers.find((m) => m.id === "fix");
    if (existing) {
      existing.pos = hit;
      existing.hidden = false;
    } else {
      state.markers.push({
        id: "fix",
        kind: "pin",
        pos: hit,
        hidden: false,
        hard: false,
        dead: false,
      });
    }
    bumpCoach(1);
  }

  function bumpCoach(to: number) {
    if (state.coachIndex < to) state.coachIndex = to;
  }

  function revealNear(pos: Km, radius: number) {
    for (const m of state.markers) {
      if (m.hidden && dist(m.pos, pos) <= radius) {
        m.hidden = false;
        state.revealed = true;
      }
    }
  }

  function startDuty() {
    loadMission(0);
    state.screen = "duty";
    notify();
  }

  function setWire(w: Wire) {
    state.wire = w;
    notify();
  }

  function setTool(t: Tool) {
    state.tool = t;
    state.pending = null;
    notify();
  }

  function useChip(chip: Chip) {
    if (chip.kind === "coord") {
      const mk = state.markers.find((m) => m.id === chip.id);
      if (mk) {
        mk.hidden = false;
        bumpCoach(1);
      }
    } else {
      const origin = state.markers.find((m) => m.id === chip.originId);
      if (origin) {
        origin.hidden = false;
        const to = project(origin.pos, chip.deg, 28);
        pushStroke("yellow", origin.pos, to);
        bumpCoach(1);
      }
    }
    notify();
  }

  function snap(km: Km): Km {
    let best: Km = km;
    let bestD = 0.35;
    for (const mk of state.markers) {
      if (mk.hidden) continue;
      const d = dist(km, mk.pos);
      if (d < bestD) {
        bestD = d;
        best = mk.pos;
      }
    }
    return { ...best };
  }

  function mapClick(raw: Km) {
    if (state.screen !== "duty") return;
    const km = snap(raw);
    if (state.tool === "erase") {
      state.strokes = state.strokes.filter(
        (s) => dist(s.from, km) > 0.45 && dist(s.to, km) > 0.45,
      );
      const fix = state.markers.find((m) => m.id === "fix");
      if (fix && dist(fix.pos, km) < 0.45) {
        state.markers = state.markers.filter((m) => m.id !== "fix");
      }
      notify();
      return;
    }
    if (!state.pending) {
      state.pending = { ...km };
      notify();
      return;
    }
    const tool = state.tool;
    if (tool === "red" || tool === "yellow" || tool === "white") {
      pushStroke(tool, state.pending, km);
    }
    state.pending = null;
    notify();
  }

  function clearPlot() {
    state.strokes = [];
    state.pending = null;
    state.markers = state.markers.filter((m) => m.id !== "fix");
    notify();
  }

  function setCalcRange(n: number) {
    state.calcRange = Math.max(0, Math.min(32, n));
    state.calcElev = null;
    notify();
  }

  function setCalcCharges(n: number) {
    state.calcCharges = Math.max(1, Math.min(6, n));
    state.calcElev = null;
    notify();
  }

  function calculate() {
    const r = state.calcRange;
    const c = state.calcCharges;
    if (r <= 0.05) {
      state.calcError = { kind: "needRange" };
      state.calcElev = null;
      notify();
      return;
    }
    if (r > maxRange(c) + 0.01) {
      state.calcError = { kind: "needPowder", charges: c, max: maxRange(c).toFixed(1) };
      state.calcElev = null;
      notify();
      return;
    }
    const el = elevationFor(r, c);
    if (el < 8 || el > 72) {
      state.calcError = { kind: "uglyAngle" };
      state.calcElev = null;
      notify();
      return;
    }
    state.calcError = null;
    state.calcElev = round1(el);
    state.clipboard.range = round2(r);
    state.clipboard.charges = c;
    state.clipboard.elevation = state.calcElev;
    bumpCoach(2);
    notify();
  }

  function copyRange() {
    if (state.clipboard.range != null) {
      state.calcRange = state.clipboard.range;
      notify();
    }
  }

  function selectShell(id: ShellId) {
    if (state.rammed) return;
    state.selectedShell = id;
    state.clipboard.shell = id;
    notify();
  }

  function setLoadCharges(n: number) {
    if (state.rammed) return;
    state.loadCharges = Math.max(1, Math.min(6, n));
    notify();
  }

  function ram() {
    state.rammed = true;
    state.armed = false;
    state.clipboard.shell = state.selectedShell;
    if (state.clipboard.charges == null) state.clipboard.charges = state.loadCharges;
    bumpCoach(3);
    notify();
  }

  function setGunBearing(n: number) {
    let v = n % 360;
    if (v < 0) v += 360;
    state.gunBearing = v;
    notify();
  }

  function setGunElev(n: number) {
    state.gunElev = Math.max(5, Math.min(75, n));
    notify();
  }

  function layFromCard() {
    if (state.clipboard.bearing != null) state.gunBearing = state.clipboard.bearing;
    if (state.clipboard.elevation != null) state.gunElev = state.clipboard.elevation;
    bumpCoach(4);
    notify();
  }

  function arm() {
    if (!state.rammed) return;
    state.armed = !state.armed;
    notify();
  }

  function fire() {
    if (state.screen !== "duty") return;
    if (!state.rammed) {
      state.lastResult = { kind: "empty" };
      notify();
      return;
    }
    if (!state.armed) {
      state.lastResult = { kind: "notArmed" };
      notify();
      return;
    }
    const m = mission();
    const n = nest();
    const shot = solveShot({
      nest: n.pos,
      bearing: state.gunBearing,
      elevation: state.gunElev,
      charges: state.loadCharges,
    });
    const shell = state.selectedShell;
    const spec = SHELLS[shell];
    state.shake = 1;
    state.rammed = false;
    state.armed = false;
    bumpCoach(5);

    const impact = shot.impact;
    const flight = flightSeconds(shot.range, state.loadCharges);

    state.screen = "flight";
    state.tracer = { from: n.pos, to: impact, t: 0 };
    notify();

    const start = performance.now();
    const dur = Math.min(2800, 700 + flight * 380);

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      if (state.tracer) state.tracer.t = t;
      notify();
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      finishShot(m, impact, shell, spec.blast, spec.reveal, spec.lethal);
    };
    requestAnimationFrame(step);
  }

  function finishShot(
    m: Mission,
    impact: Km,
    shell: ShellId,
    blast: number,
    reveal: number,
    lethal: boolean,
  ) {
    revealNear(impact, Math.max(reveal, blast));
    const note = describeFall(impact, shell, blast, lethal);
    state.impacts.push({ pos: impact, shell, note });
    state.lastResult = note;
    state.tracer = null;
    state.shake = 0;

    if (m.win === "choice") {
      const city = state.markers.find((x) => x.id === "city");
      const hq = state.markers.find((x) => x.id === "hq");
      if (city && dist(impact, city.pos) <= 1.15) {
        if (shell === "PRPG" || shell === "STAR" || shell === "SMK") {
          closeWith("celebration");
          return;
        }
        if (lethal) {
          closeWith("silent");
          return;
        }
      }
      if (hq && dist(impact, hq.pos) <= 0.7 && lethal) {
        closeWith("road");
        return;
      }
      state.screen = "duty";
      state.paper = { kind: "miss" };
      state.missCount += 1;
      notify();
      return;
    }

    const targets = state.markers.filter((mk) => m.targetIds.includes(mk.id));
    let killed = false;
    for (const t of targets) {
      const need = t.hard ? (shell === "AP" ? 0.45 : 0.38) : 0.6;
      if (dist(impact, t.pos) <= Math.max(need, blast) && lethal) {
        t.dead = true;
        t.hidden = false;
        killed = true;
      }
    }

    if (killed && targets.every((t) => t.dead || !m.targetIds.includes(t.id))) {
      state.paper = { kind: "hit" };
      state.screen = "paper";
      notify();
      return;
    }

    state.missCount += 1;
    state.paper = null;
    state.screen = "duty";
    if (state.missCount >= 2) bumpCoach(1);
    notify();
  }

  function describeFall(
    impact: Km,
    shell: ShellId,
    blast: number,
    lethal: boolean,
  ): FallNote {
    const n = nest();
    const live = state.markers.filter(
      (mk) => !mk.hidden && mk.kind !== "nest" && mk.kind !== "pin",
    );
    let nearest: Marker | null = null;
    let nd = 99;
    for (const mk of live) {
      const d = dist(impact, mk.pos);
      if (d < nd) {
        nd = d;
        nearest = mk;
      }
    }
    const grid = formatGrid(impact);
    if (nearest && nd <= Math.max(blast, 0.25) && lethal) {
      return { kind: "hit", shell, markerId: nearest.id, grid };
    }
    if (nearest) {
      const brN = bearingDeg(n.pos, nearest.pos);
      const brI = bearingDeg(n.pos, impact);
      const dB = ((((brI - brN) % 360) + 540) % 360) - 180;
      const dR = rangeKm(n.pos, impact) - rangeKm(n.pos, nearest.pos);
      const side = dB > 1.2 ? "right" : dB < -1.2 ? "left" : "line";
      const range = dR > 0.25 ? "long" : dR < -0.25 ? "short" : "good";
      return { kind: "missNear", grid, range, side, markerId: nearest.id };
    }
    return { kind: "missOpen", grid, missionId: mission().id };
  }

  function closeWith(id: EndingId) {
    state.endingId = id;
    state.paper = { kind: "ending", id };
    state.screen = "paper";
    notify();
  }

  function dismissPaper() {
    if (state.endingId) {
      state.screen = "ending";
      notify();
      return;
    }
    const next = state.missionIndex + 1;
    if (next >= state.missions.length) {
      state.endingId = "celebration";
      state.screen = "ending";
      notify();
      return;
    }
    loadMission(next);
    state.screen = "duty";
    notify();
  }

  function hint() {
    state.coachIndex = Math.min(mission().coachCount - 1, state.coachIndex + 1);
    notify();
  }

  function restart() {
    loadMission(0);
    state.endingId = null;
    state.screen = "boot";
    notify();
  }

  return {
    getState: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    startDuty,
    setWire,
    setTool,
    useChip,
    mapClick,
    clearPlot,
    setCalcRange,
    setCalcCharges,
    calculate,
    copyRange,
    selectShell,
    setLoadCharges,
    ram,
    setGunBearing,
    setGunElev,
    layFromCard,
    arm,
    fire,
    dismissPaper,
    hint,
    restart,
    cancelPending() {
      state.pending = null;
      notify();
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
