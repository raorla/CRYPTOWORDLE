/** Hand-rolled canvas confetti — no dependency, ~2.8s burst. */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
  shape: "rect" | "circle";
}

// Gold / green / ivory — the certificate palette.
const COLORS = ["#b8912f", "#8a6d1f", "#1e6b47", "#27754f", "#a5761d", "#f5f0de"];

let particles: Particle[] = [];
let raf: number | null = null;

export function launchConfetti(count = 160): void {
  const canvas = document.getElementById("confetti-canvas") as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const w = window.innerWidth;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: w / 2 + (Math.random() - 0.5) * w * 0.4,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 13 - 4,
      size: Math.random() * 7 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      shape: Math.random() > 0.5 ? "rect" : "circle",
    });
  }

  if (raf === null) tick(ctx, performance.now());
}

function tick(ctx: CanvasRenderingContext2D, last: number): void {
  raf = requestAnimationFrame((now) => {
    const dt = Math.min((now - last) / 16.7, 3);
    const h = window.innerHeight;
    ctx.clearRect(0, 0, window.innerWidth, h);

    particles = particles.filter((p) => p.y < h + 30);
    for (const p of particles) {
      p.vy += 0.42 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vr * dt;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (particles.length > 0) {
      tick(ctx, now);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, h);
      raf = null;
    }
  });
}
