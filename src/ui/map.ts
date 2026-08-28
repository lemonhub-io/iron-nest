import { COLS, MAP_H, MAP_W, bearingDeg, formatGrid, rangeKm, type Km } from "../game/geo";
import type { Engine, Marker } from "../game/engine";
import { t } from "../i18n";

const INK = "#1c1612";
const RED = "#c43c2c";
const BLUE = "#3a5a7c";
const WHITE = "#f3ead4";

export function mountMap(canvas: HTMLCanvasElement, engine: Engine) {
  const raw = canvas.getContext("2d");
  if (!raw) throw new Error("canvas");
  const ctx: CanvasRenderingContext2D = raw;

  const mapImg = new Image();
  mapImg.src = "/assets/map.jpg";

  const pad = { l: 36, r: 18, t: 16, b: 28 };

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(r.width * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function plot() {
    const r = canvas.getBoundingClientRect();
    return {
      x0: pad.l,
      y0: pad.t,
      w: r.width - pad.l - pad.r,
      h: r.height - pad.t - pad.b,
    };
  }

  function toPx(km: Km) {
    const p = plot();
    return {
      x: p.x0 + (km.x / MAP_W) * p.w,
      y: p.y0 + ((MAP_H - km.y) / MAP_H) * p.h,
    };
  }

  function toKm(px: number, py: number): Km {
    const p = plot();
    return {
      x: ((px - p.x0) / p.w) * MAP_W,
      y: MAP_H - ((py - p.y0) / p.h) * MAP_H,
    };
  }

  function eventKm(e: PointerEvent): Km | null {
    const rec = canvas.getBoundingClientRect();
    const x = e.clientX - rec.left;
    const y = e.clientY - rec.top;
    const p = plot();
    if (x < p.x0 || y < p.y0 || x > p.x0 + p.w || y > p.y0 + p.h) return null;
    return {
      x: Math.max(0, Math.min(MAP_W, toKm(x, y).x)),
      y: Math.max(0, Math.min(MAP_H, toKm(x, y).y)),
    };
  }

  function drawLine(from: Km, to: Km, color: string, width: number, dash: number[]) {
    const a = toPx(from);
    const b = toPx(to);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function draw() {
    const s = engine.getState();
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);

    ctx.fillStyle = "#e4d8bc";
    ctx.fillRect(0, 0, r.width, r.height);
    const p = plot();
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x0, p.y0, p.w, p.h);
    ctx.clip();
    if (mapImg.complete && mapImg.naturalWidth) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(mapImg, p.x0, p.y0, p.w, p.h);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(232,223,200,0.28)";
    ctx.fillRect(p.x0, p.y0, p.w, p.h);

    ctx.strokeStyle = "rgba(28,22,18,0.18)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= MAP_W; c++) {
      const x = p.x0 + (c / MAP_W) * p.w;
      ctx.beginPath();
      ctx.moveTo(x, p.y0);
      ctx.lineTo(x, p.y0 + p.h);
      ctx.stroke();
    }
    for (let row = 0; row <= MAP_H; row++) {
      const y = p.y0 + (row / MAP_H) * p.h;
      ctx.beginPath();
      ctx.moveTo(p.x0, y);
      ctx.lineTo(p.x0 + p.w, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = INK;
    ctx.font = "11px 'Special Elite', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let c = 0; c < MAP_W; c++) {
      const x = p.x0 + ((c + 0.5) / MAP_W) * p.w;
      ctx.fillText(COLS[c], x, p.y0 + p.h + 6);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let row = 1; row <= MAP_H; row++) {
      const y = p.y0 + ((MAP_H - (row - 0.5)) / MAP_H) * p.h;
      ctx.fillText(String(row), p.x0 - 8, y);
    }

    for (const st of s.strokes) {
      const color = st.tool === "red" ? RED : st.tool === "yellow" ? "#c4a035" : WHITE;
      const dash = st.tool === "yellow" ? [7, 5] : [];
      drawLine(st.from, st.to, color, st.tool === "white" ? 1.2 : 2.2, dash);
      if (st.tool === "red") {
        const a = toPx(st.from);
        const b = toPx(st.to);
        ctx.fillStyle = RED;
        ctx.font = "13px 'Caveat', cursive";
        ctx.textAlign = "left";
        ctx.fillText(
          `${bearingDeg(st.from, st.to).toFixed(1)}°  ${rangeKm(st.from, st.to).toFixed(2)} km`,
          (a.x + b.x) / 2 + 6,
          (a.y + b.y) / 2 - 6,
        );
      }
    }

    const previewFrom =
      s.tool === "red" ? s.markers.find((m) => m.kind === "nest")?.pos : s.pending;
    if (previewFrom && s.preview && rangeKm(previewFrom, s.preview) > 0.05) {
      const color = s.tool === "red" ? "rgba(196,60,44,0.55)" : s.tool === "white" ? "rgba(243,234,212,0.7)" : "rgba(196,160,53,0.7)";
      drawLine(previewFrom, s.preview, color, 1.6, [4, 4]);
      if (s.tool === "red") {
        const q = toPx(s.preview);
        ctx.fillStyle = RED;
        ctx.font = "12px 'Caveat', cursive";
        ctx.textAlign = "left";
        ctx.fillText(
          `${bearingDeg(previewFrom, s.preview).toFixed(1)}°  ${rangeKm(previewFrom, s.preview).toFixed(2)} km`,
          q.x + 8,
          q.y - 8,
        );
      }
    }

    if (s.pending) {
      const q = toPx(s.pending);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (s.hover) {
      const q = toPx(s.hover);
      ctx.strokeStyle = "rgba(28,22,18,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (s.tracer) {
      const a = toPx(s.tracer.from);
      const b = toPx(s.tracer.to);
      const x = a.x + (b.x - a.x) * s.tracer.t;
      const y = a.y + (b.y - a.y) * s.tracer.t;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const now = performance.now();
    for (const im of s.impacts) {
      const q = toPx(im.pos);
      const age = Math.min(1, (now - im.at) / 700);
      ctx.strokeStyle = `rgba(28,22,18,${1 - age * 0.55})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(q.x - 6, q.y - 6);
      ctx.lineTo(q.x + 6, q.y + 6);
      ctx.moveTo(q.x + 6, q.y - 6);
      ctx.lineTo(q.x - 6, q.y + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(q.x, q.y, 8 + age * 16, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const mk of s.markers) {
      if (mk.hidden) continue;
      drawMarker(mk, toPx(mk.pos), s.shownBearing);
    }
  }

  function drawMarker(mk: Marker, q: { x: number; y: number }, gunBearing: number) {
    ctx.save();
    ctx.translate(q.x, q.y);
    if (mk.kind === "nest") {
      const ang = (gunBearing * Math.PI) / 180;
      ctx.rotate(ang);
      ctx.fillStyle = "#5c6b4a";
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.rect(-11, -8, 22, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-6, -24, 4, 16);
      ctx.fillRect(2, -24, 4, 16);
      ctx.strokeRect(-6, -24, 4, 16);
      ctx.strokeRect(2, -24, 4, 16);
      for (const [x, y] of [
        [-11, -8],
        [11, -8],
        [-11, 12],
        [11, 12],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (mk.kind === "spotter") {
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, 7);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
    } else if (mk.kind === "enemy") {
      ctx.fillStyle = mk.dead ? "#5a5850" : RED;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
    } else if (mk.kind === "city") {
      ctx.strokeStyle = INK;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.beginPath();
      ctx.moveTo(-9, -9);
      ctx.lineTo(9, 9);
      ctx.moveTo(9, -9);
      ctx.lineTo(-9, 9);
      ctx.stroke();
    } else if (mk.kind === "hq") {
      star(0, 0, 5, 10, 5);
      ctx.fillStyle = RED;
      ctx.fill();
    } else {
      ctx.fillStyle = "#c4a035";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.font = "13px 'Caveat', cursive";
    ctx.textAlign = "left";
    const name = t(`marker.${mk.id}`);
    ctx.fillText(mk.dead ? t("marker.dead", { name }) : name, q.x + 12, q.y - 8);
  }

  function star(x: number, y: number, r: number, R: number, n: number) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rad = (i * Math.PI) / n - Math.PI / 2;
      const rr = i % 2 === 0 ? R : r;
      const px = x + Math.cos(rad) * rr;
      const py = y + Math.sin(rad) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function toolCursor() {
    const ttool = engine.getState().tool;
    canvas.style.cursor = ttool === "erase" ? "cell" : ttool === "red" ? "crosshair" : "pointer";
  }

  function onDown(e: PointerEvent) {
    const km = eventKm(e);
    if (!km) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    engine.mapDown(km);
    toolCursor();
  }

  function onMove(e: PointerEvent) {
    const km = eventKm(e);
    engine.mapHover(km);
    toolCursor();
  }

  function onUp(e: PointerEvent) {
    const km = eventKm(e);
    if (km) engine.mapUp(km);
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onLeave() {
    engine.mapHover(null);
  }

  const ro = new ResizeObserver(() => {
    size();
    draw();
  });
  ro.observe(canvas);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  mapImg.onload = () => draw();
  size();
  draw();
  toolCursor();

  return {
    draw,
    hoverGrid() {
      const h = engine.getState().hover;
      return h ? formatGrid(h) : "";
    },
    destroy() {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    },
  };
}
