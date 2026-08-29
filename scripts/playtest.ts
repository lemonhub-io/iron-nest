/* Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later */

import { createEngine } from "../src/game/engine";
import { parseGrid } from "../src/game/geo";

declare const process: { exit(code: number): never };

let t = 0;
(globalThis as unknown as { performance: { now: () => number } }).performance = {
  now: () => t,
};
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
  t += 4000;
  return setTimeout(() => cb(t), 0) as unknown as number;
};

function wait() {
  return new Promise((r) => setTimeout(r, 20));
}

async function main() {
  const g = createEngine();
  g.startDuty();
  let s = g.getState();
  if (s.screen !== "duty") throw new Error("boot");
  const tgt = s.missions[0].markers.find((m) => m.id === "t1")!;
  g.useChip({ kind: "coord", id: "t1", grid: "N8 2:2" });
  g.mapClick(s.markers.find((m) => m.kind === "nest")!.pos);
  g.mapClick(tgt.pos);
  g.setCalcCharges(4);
  g.copyRange();
  g.calculate();
  g.selectShell("HE");
  g.setLoadCharges(4);
  g.ram();
  g.layFromCard();
  g.arm();
  g.fire();
  await wait();
  s = g.getState();
  if (s.screen !== "paper") throw new Error("m1 not paper: " + s.screen + " " + JSON.stringify(s.lastResult));
  g.dismissPaper();
  s = g.getState();
  if (s.missions[s.missionIndex].id !== "light") throw new Error("not m2");
  const alfa = s.markers.find((m) => m.id === "alfa")!;
  const bravo = s.markers.find((m) => m.id === "bravo")!;
  const battery = s.missions[1].markers.find((m) => m.id === "battery")!;
  const m2 = s.missions[1];
  const chips = m2.dispatches.flatMap((d) => d.chips).filter((c) => c.kind === "bearing");
  for (const c of chips) g.useChip(c);
  s = g.getState();
  const fix = s.markers.find((m) => m.id === "fix");
  if (!fix) throw new Error("no fix");
  g.setTool("red");
  g.mapClick(s.markers.find((m) => m.kind === "nest")!.pos);
  g.mapClick(fix.pos);
  g.copyRange();
  g.setCalcCharges(4);
  g.calculate();
  g.selectShell("AP");
  g.setLoadCharges(4);
  g.ram();
  g.layFromCard();
  g.arm();
  g.setGunBearing(g.getState().gunBearing + 25);
  g.fire();
  // Moving the turret while the shell is airborne must not abort the flight.
  g.layFromCard();
  await wait();
  s = g.getState();
  if (s.screen !== "duty") throw new Error("m2 miss did not return to duty: " + s.screen);
  if (s.rammed || s.armed) throw new Error("m2 miss did not unload the gun");
  if (!s.correction || s.correction.applied) throw new Error("m2 miss did not produce a fresh correction");

  // A correction updates the firing card, then still requires calculation,
  // loading, laying, and arming before a corrected second shot.
  g.applyCorrection();
  s = g.getState();
  if (!s.correction?.applied || s.clipboard.elevation != null) {
    throw new Error("m2 correction did not clear the old firing solution");
  }
  g.calculate();
  g.ram();
  g.layFromCard();
  g.arm();
  g.fire();
  await wait();
  s = g.getState();
  if (s.screen !== "paper") throw new Error("m2 retry not paper: " + s.screen + " " + JSON.stringify(s.lastResult));
  g.dismissPaper();
  s = g.getState();
  if (s.missions[s.missionIndex].id !== "white") throw new Error("not m3");
  const city = parseGrid("N", 8, 5, 5);
  g.setTool("red");
  g.mapClick(s.markers.find((m) => m.kind === "nest")!.pos);
  g.mapClick(city);
  g.copyRange();
  g.setCalcCharges(5);
  g.calculate();
  g.selectShell("PRPG");
  g.setLoadCharges(5);
  g.ram();
  g.layFromCard();
  g.arm();
  g.fire();
  await wait();
  s = g.getState();
  if (s.endingId !== "celebration") {
    throw new Error("ending " + s.endingId + " " + JSON.stringify(s.lastResult) + " " + s.screen);
  }
  console.log("closed loop ok:", alfa.id, bravo.id, battery.id, s.endingId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
