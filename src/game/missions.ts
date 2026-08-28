import { bearingDeg, parseGrid, type Km } from "./geo";
import type { ShellId } from "./ballistics";

export type MarkerKind = "nest" | "spotter" | "enemy" | "city" | "hq" | "pin" | "friend";
export type EndingId = "celebration" | "silent" | "road";
export type MissionId = "calibration" | "light" | "white";

export interface MarkerSeed {
  id: string;
  kind: MarkerKind;
  pos: Km;
  hidden?: boolean;
  hard?: boolean;
}

export type Chip =
  | { kind: "coord"; id: string; grid: string }
  | { kind: "bearing"; id: string; originId: string; deg: number };

export interface Dispatch {
  source: "command" | "front";
  bodyKey: string;
  chips: Chip[];
}

export interface Mission {
  id: MissionId;
  index: number;
  nest: Km;
  markers: MarkerSeed[];
  dispatches: Dispatch[];
  requiredShell?: ShellId;
  win: "hit-target" | "choice";
  targetIds: string[];
  coachCount: number;
}

export function buildMissions(): Mission[] {
  const m1Nest = parseGrid("C", 3, 5, 5);
  const m1Tgt = parseGrid("N", 8, 2, 2);

  const m2Nest = parseGrid("D", 2, 5, 5);
  const m2Tgt = parseGrid("K", 7, 5, 5);
  const alfa = parseGrid("B", 9, 0, 0);
  const bravo = parseGrid("R", 4, 0, 0);
  const bAlfa = bearingDeg(alfa, m2Tgt);
  const bBravo = bearingDeg(bravo, m2Tgt);

  const m3Nest = parseGrid("B", 2, 0, 0);
  const city = parseGrid("N", 8, 5, 5);
  const hq = parseGrid("C", 5, 2, 2);

  return [
    {
      id: "calibration",
      index: 0,
      nest: m1Nest,
      markers: [
        { id: "nest", kind: "nest", pos: m1Nest },
        { id: "t1", kind: "enemy", pos: m1Tgt, hidden: true },
      ],
      dispatches: [
        {
          source: "command",
          bodyKey: "mission.calibration.command",
          chips: [
            { kind: "coord", id: "nest", grid: "C3 5:5" },
            { kind: "coord", id: "t1", grid: "N8 2:2" },
          ],
        },
        {
          source: "front",
          bodyKey: "mission.calibration.front",
          chips: [],
        },
      ],
      requiredShell: "HE",
      win: "hit-target",
      targetIds: ["t1"],
      coachCount: 4,
    },
    {
      id: "light",
      index: 1,
      nest: m2Nest,
      markers: [
        { id: "nest", kind: "nest", pos: m2Nest },
        { id: "alfa", kind: "spotter", pos: alfa },
        { id: "bravo", kind: "spotter", pos: bravo },
        { id: "battery", kind: "enemy", pos: m2Tgt, hidden: true, hard: true },
      ],
      dispatches: [
        {
          source: "command",
          bodyKey: "mission.light.command",
          chips: [
            { kind: "coord", id: "nest", grid: "D2 5:5" },
            { kind: "coord", id: "alfa", grid: "B9 0:0" },
            { kind: "coord", id: "bravo", grid: "R4 0:0" },
          ],
        },
        {
          source: "front",
          bodyKey: "mission.light.front",
          chips: [
            { kind: "bearing", id: "ray-alfa", originId: "alfa", deg: bAlfa },
            { kind: "bearing", id: "ray-bravo", originId: "bravo", deg: bBravo },
          ],
        },
      ],
      win: "hit-target",
      targetIds: ["battery"],
      coachCount: 4,
    },
    {
      id: "white",
      index: 2,
      nest: m3Nest,
      markers: [
        { id: "nest", kind: "nest", pos: m3Nest },
        { id: "city", kind: "city", pos: city },
        { id: "hq", kind: "hq", pos: hq },
      ],
      dispatches: [
        {
          source: "command",
          bodyKey: "mission.white.command",
          chips: [
            { kind: "coord", id: "nest", grid: "B2 0:0" },
            { kind: "coord", id: "city", grid: "N8 5:5" },
          ],
        },
        {
          source: "front",
          bodyKey: "mission.white.front",
          chips: [{ kind: "coord", id: "hq", grid: "C5 2:2" }],
        },
      ],
      win: "choice",
      targetIds: ["city", "hq"],
      coachCount: 4,
    },
  ];
}
