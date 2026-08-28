import { COLS, MAP_H, MAP_W, type Km } from "../game/geo";
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
      const a = toPx(st.from);
      const b = toPx(st.to);
      ctx.strokeStyle = st.tool === "red" ? RED : st.tool === "yellow" ? "#c4a035" : WHITE;
      ctx.lineWidth = st.tool === "white" ? 1 : 2;
      ctx.setLineDash(st.tool === "yellow" ? [7, 5] : []);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (st.tool === "red") {
        ctx.fillStyle = RED;
        ctx.font = "12px 'Caveat', cursive";
        ctx.textAlign = "left";
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = st.to.x - st.from.x;
        const dy = st.to.y - st.from.y;
        let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        const rng = Math.hypot(dx, dy);
        ctx.fillText(`${deg.toFixed(1)}°  ${rng.toFixed(2)} km`, mx + 6, my - 6);
      }
    }

    if (s.pending) {
      const q = toPx(s.pending);
      ctx.strokeStyle = RED;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (s.tracer) {
      const a = toPx(s.tracer.from);
      const b = toPx(s.tracer.to);
      const x = a.x + (b.x - a.x) * s.tracer.t;
      const y = a.y + (b.y - a.y) * s.tracer.t;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const im of s.impacts) {
      const q = toPx(im.pos);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(q.x - 6, q.y - 6);
      ctx.lineTo(q.x + 6, q.y + 6);
      ctx.moveTo(q.x + 6, q.y - 6);
      ctx.lineTo(q.x - 6, q.y + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(q.x, q.y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const mk of s.markers) {
      if (mk.hidden) continue;
      drawMarker(mk, toPx(mk.pos), s.gunBearing);
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

  function onClick(e: MouseEvent) {
    const rec = canvas.getBoundingClientRect();
    const km = toKm(e.clientX - rec.left, e.clientY - rec.top);
    const p = plot();
    const x = e.clientX - rec.left;
    const y = e.clientY - rec.top;
    if (engine.getState().screen !== "duty") return;
    if (x < p.x0 || y < p.y0 || x > p.x0 + p.w || y > p.y0 + p.h) return;
    km.x = Math.max(0, Math.min(MAP_W, km.x));
    km.y = Math.max(0, Math.min(MAP_H, km.y));
    engine.mapClick(km);
  }

  const ro = new ResizeObserver(() => {
    size();
    draw();
  });
  ro.observe(canvas);
  canvas.addEventListener("click", onClick);
  mapImg.onload = () => draw();
  size();
  draw();

  return {
    draw,
    destroy() {
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
    },
  };
}
