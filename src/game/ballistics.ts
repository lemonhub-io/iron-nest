/* Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later */

import { angleDelta, project, type Km } from "./geo";

export type ShellId = "HE" | "AP" | "STAR" | "SMK" | "PRPG";

export interface ShellSpec {
  id: ShellId;
  name: string;
  job: string;
  blast: number;
  reveal: number;
  lethal: boolean;
  color: string;
  band: string;
}

export const SHELLS: Record<ShellId, ShellSpec> = {
  HE: {
    id: "HE",
    name: "High Explosive",
    job: "Soft targets, guns, infantry",
    blast: 0.55,
    reveal: 0.4,
    lethal: true,
    color: "#6b4a1e",
    band: "#d4b02a",
  },
  AP: {
    id: "AP",
    name: "Armor Piercing",
    job: "Bunkers, command, hardened",
    blast: 0.22,
    reveal: 0.2,
    lethal: true,
    color: "#2c2c2a",
    band: "#ece6db",
  },
  STAR: {
    id: "STAR",
    name: "Star shell",
    job: "Illuminate. No kill.",
    blast: 0,
    reveal: 1.6,
    lethal: false,
    color: "#d8c9a0",
    band: "#f4f0e4",
  },
  SMK: {
    id: "SMK",
    name: "Smoke",
    job: "Screen a sector. No kill.",
    blast: 0,
    reveal: 0.8,
    lethal: false,
    color: "#6d7268",
    band: "#cfc8b8",
  },
  PRPG: {
    id: "PRPG",
    name: "Propaganda",
    job: "Leaflets. Peaceful close.",
    blast: 0,
    reveal: 0.5,
    lethal: false,
    color: "#7a5a3a",
    band: "#e8d7b0",
  },
};

export function maxRange(charges: number): number {
  return charges * 5.2;
}

/** Arcade elevation matching the original's feel: deg ≈ range * 12 / charges. */
export function elevationFor(rangeKm: number, charges: number): number {
  if (charges < 1) return 90;
  return (rangeKm * 12) / charges;
}

export function rangeFromElevation(elevation: number, charges: number): number {
  if (charges < 1) return 0;
  return (elevation * charges) / 12;
}

export function flightSeconds(rangeKm: number, charges: number): number {
  // More charges produce a higher muzzle velocity. Keep this deliberately
  // slow so the tracer remains readable during the firing sequence.
  const velocity = 0.55 * Math.max(1, charges);
  return rangeKm / velocity;
}

export interface ShotInput {
  nest: Km;
  bearing: number;
  elevation: number;
  charges: number;
}

export interface ShotResult {
  impact: Km;
  range: number;
  valid: boolean;
  reason?: string;
}

export function solveShot(shot: ShotInput): ShotResult {
  if (shot.charges < 1 || shot.charges > 6) {
    return { impact: shot.nest, range: 0, valid: false, reason: "No powder." };
  }
  const range = rangeFromElevation(shot.elevation, shot.charges);
  const cap = maxRange(shot.charges);
  if (range <= 0.05) {
    return { impact: shot.nest, range, valid: false, reason: "Elevation too low." };
  }
  if (range > cap + 0.05) {
    return {
      impact: project(shot.nest, shot.bearing, cap),
      range: cap,
      valid: true,
      reason: "Short of the card. Not enough powder for that angle.",
    };
  }
  return { impact: project(shot.nest, shot.bearing, range), range, valid: true };
}

export function cardMatch(
  gunBearing: number,
  gunElev: number,
  cardBearing: number,
  cardElev: number,
): { bearingOk: boolean; elevOk: boolean } {
  return {
    bearingOk: Math.abs(angleDelta(gunBearing, cardBearing)) <= 2.4,
    elevOk: Math.abs(gunElev - cardElev) <= 1.6,
  };
}
