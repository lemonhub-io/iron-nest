/* Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later */

const CACHE = "iron-nest-shell-v1";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/iron-nest.svg",
  "/assets/cat.webp",
  "/assets/map.webp",
  "/assets/paper.webp",
  "/assets/recon.webp",
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE);
  const response = await fetch("/", { cache: "reload" });
  const html = await response.clone().text();
  await cache.put("/", response);

  const bundleAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/assets/"));
  await Promise.all(
    [...STATIC_ASSETS, ...bundleAssets].map((url) => cache.add(url).catch(() => undefined)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(CACHE);
          await cache.put("/", response.clone());
          return response;
        })
        .catch(async () => (await caches.match("/")) ?? Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then(async (response) => {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
          return response;
        }),
    ),
  );
});
