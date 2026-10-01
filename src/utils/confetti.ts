/**
 * High-performance lightweight Canvas Confetti Cannon
 */

interface Particle {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  vx: number;
  vy: number;
  tilt: number;
  tiltAngle: number;
  tiltAngleInc: number;
  opacity: number;
}

const COLORS = [
  "#f43f5e",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#3b82f6",
  "#eab308",
];

export function launchConfetti(durationMs = 4000) {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "99999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const onResize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", onResize);

  const particleCount = 180;
  const particles: Particle[] = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: width * 0.5 + (Math.random() - 0.5) * 200,
      y: height * 0.5 + (Math.random() - 0.5) * 50,
      w: Math.random() * 10 + 6,
      h: Math.random() * 8 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 28,
      vy: Math.random() * -18 - 8,
      tilt: Math.random() * 10 - 5,
      tiltAngle: Math.random() * Math.PI,
      tiltAngleInc: (Math.random() * 0.08 + 0.04) * (Math.random() < 0.5 ? 1 : -1),
      opacity: 1,
    });
  }

  const startTime = Date.now();
  let animationId = 0;

  function render() {
    const elapsed = Date.now() - startTime;
    if (elapsed > durationMs) {
      cleanup();
      return;
    }

    ctx!.clearRect(0, 0, width, height);

    const fadeOutStart = durationMs * 0.7;
    const globalAlpha = elapsed > fadeOutStart ? Math.max(0, 1 - (elapsed - fadeOutStart) / (durationMs - fadeOutStart)) : 1;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.5; // gravity
      p.vx *= 0.98; // air resistance
      p.tiltAngle += p.tiltAngleInc;
      p.tilt = Math.sin(p.tiltAngle) * 12;

      ctx!.save();
      ctx!.globalAlpha = p.opacity * globalAlpha;
      ctx!.fillStyle = p.color;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.tiltAngle);
      ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx!.restore();
    }

    animationId = requestAnimationFrame(render);
  }

  function cleanup() {
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", onResize);
    if (canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }

  animationId = requestAnimationFrame(render);
}
