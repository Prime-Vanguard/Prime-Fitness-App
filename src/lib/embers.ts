/**
 * Gold sparks rising from a point. One shared canvas, created on demand and removed
 * when the last spark fades, so nothing runs while idle. Callers check the setting.
 */
let canvas: HTMLCanvasElement | null = null;
let sparks: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];

export function embers(x: number, y: number, count = 28) {
  if (typeof document === "undefined") return;
  for (let i = 0; i < count; i++)
    sparks.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: -1.5 - Math.random() * 3.5,
      life: 1,
      size: 1 + Math.random() * 2.5,
    });
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "ember-canvas";
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return stop();
  ctx.scale(ratio, ratio);
  const frame = () => {
    if (!canvas) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const s of sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.06; // gravity
      s.life -= 0.016;
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.life > 0.5 ? "#ffe08a" : "#d4af37";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    sparks = sparks.filter((s) => s.life > 0);
    if (sparks.length) requestAnimationFrame(frame);
    else stop();
  };
  requestAnimationFrame(frame);
}

function stop() {
  canvas?.remove();
  canvas = null;
  sparks = [];
}

/** Sparks from the centre of an element. */
export function embersFrom(element: Element | null, count?: number) {
  const box = element?.getBoundingClientRect();
  if (box) embers(box.left + box.width / 2, box.top + box.height / 2, count);
}
