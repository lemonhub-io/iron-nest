/* Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later */

import { en } from "./en";
import { zh } from "./zh";

export type Locale = "en" | "zh";
export type Vars = Record<string, string | number>;

const catalogs = { en, zh } as const;
const STORAGE = "iron-nest-locale";

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    /* ignore */
  }
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  return "en";
}

let locale: Locale = detect();
const listeners = new Set<() => void>();

function lookup(tree: unknown, path: string): unknown {
  let cur: unknown = tree;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] == null ? `{${k}}` : String(vars[k]),
  );
}

export function getLocale(): Locale {
  return locale;
}

export function t(path: string, vars?: Vars): string {
  const hit = lookup(catalogs[locale], path);
  const fallback = lookup(catalogs.en, path);
  const raw = typeof hit === "string" ? hit : typeof fallback === "string" ? fallback : path;
  return interpolate(raw, vars);
}

export function tList(path: string): string[] {
  const hit = lookup(catalogs[locale], path);
  if (Array.isArray(hit) && hit.every((x) => typeof x === "string")) return hit as string[];
  const fallback = lookup(catalogs.en, path);
  if (Array.isArray(fallback) && fallback.every((x) => typeof x === "string")) {
    return fallback as string[];
  }
  return [];
}

export function setLocale(next: Locale) {
  if (next === locale) {
    applyDom();
    return;
  }
  locale = next;
  try {
    localStorage.setItem(STORAGE, next);
  } catch {
    /* ignore */
  }
  applyDom();
  listeners.forEach((fn) => fn());
}

export function subscribeLocale(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyDom(root: ParentNode | null = typeof document === "undefined" ? null : document) {
  if (typeof document === "undefined" || !root) return;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = t("app.title");
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (key) el.title = t(key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-alt]").forEach((el) => {
    const key = el.dataset.i18nAlt;
    if (key) el.setAttribute("alt", t(key));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) => {
    b.classList.toggle("on", b.dataset.lang === locale);
    b.setAttribute("aria-pressed", b.dataset.lang === locale ? "true" : "false");
  });
}
