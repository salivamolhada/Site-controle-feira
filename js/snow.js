/**
 * FeiraFinance — Gentle 3D-Depth Snowfall Background
 * Flocos de neve suaves em Canvas 2D respeitando prefers-reduced-motion
 */

export function initChristmasSnow() {
  const canvas = document.getElementById('christmas-snow-canvas');
  if (!canvas) return;

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    canvas.style.display = 'none';
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let flakes = [];
  let animationId = null;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const targetCount = Math.min(58, Math.max(24, Math.floor((width * height) / 28000)));
    if (flakes.length === 0) {
      flakes = Array.from({ length: targetCount }, () => createFlake(true));
    }
  };

  const createFlake = (randomY = false) => {
    const depth = Math.random(); // 0 = far, 1 = near (3D parallax depth)
    return {
      x: Math.random() * (width || window.innerWidth),
      y: randomY ? Math.random() * (height || window.innerHeight) : -12,
      r: 1.5 + depth * 3.4,
      speedY: 0.45 + depth * 1.1,
      drift: (Math.random() - 0.5) * 0.4,
      wobbleAmp: 0.25 + depth * 0.55,
      wobbleFreq: 0.012 + Math.random() * 0.015,
      phase: Math.random() * Math.PI * 2,
      opacity: 0.35 + depth * 0.45
    };
  };

  const draw = () => {
    ctx.clearRect(0, 0, width, height);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i];
      f.phase += f.wobbleFreq;
      f.y += f.speedY;
      f.x += f.drift + Math.sin(f.phase) * f.wobbleAmp;

      if (f.y > height + 10) {
        flakes[i] = createFlake(false);
        continue;
      }
      if (f.x > width + 10) f.x = -10;
      if (f.x < -10) f.x = width + 10;

      // Soft 3D spherical highlight on each snowflake
      const grad = ctx.createRadialGradient(
        f.x - f.r * 0.28,
        f.y - f.r * 0.28,
        0,
        f.x,
        f.y,
        f.r
      );

      if (isDark) {
        grad.addColorStop(0, `rgba(255, 250, 235, ${Math.min(0.95, f.opacity + 0.15)})`);
        grad.addColorStop(1, `rgba(215, 238, 228, ${f.opacity * 0.25})`);
      } else {
        grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.95, f.opacity + 0.2)})`);
        grad.addColorStop(1, `rgba(215, 232, 222, ${f.opacity * 0.2})`);
      }

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    animationId = window.requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize);
  animationId = window.requestAnimationFrame(draw);

  return () => {
    if (animationId) window.cancelAnimationFrame(animationId);
    window.removeEventListener('resize', resize);
  };
}
