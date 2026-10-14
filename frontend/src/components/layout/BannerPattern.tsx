import { useEffect, useRef } from 'react';

interface BannerPatternProps {
  className?: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const parseRgb = (value: string): Rgb | null => {
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
};

const readAccentShades = (): Rgb[] => {
  const styles = getComputedStyle(document.documentElement);
  return ['300', '400', '500', '600']
    .map((shade) => parseRgb(styles.getPropertyValue(`--accent-${shade}`)))
    .filter((color): color is Rgb => color !== null);
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
};

const FADE_DURATION = 550;

export const BannerPattern = ({ className }: BannerPatternProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const renderPattern = (target: HTMLCanvasElement, width: number, height: number, dpr: number) => {
      const ctx = target.getContext('2d');
      if (!ctx) return;

      const isDark = document.documentElement.classList.contains('dark');

      target.width = Math.max(1, Math.floor(width * dpr));
      target.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const accent = readAccentShades();

      const pickFill = (): string => {
        if (accent.length > 0 && Math.random() < 0.5) {
          const shade = accent[Math.floor(Math.random() * accent.length)];
          const alpha = isDark ? 0.25 + Math.random() * 0.38 : 0.1 + Math.random() * 0.18;
          return `rgba(${shade.r}, ${shade.g}, ${shade.b}, ${alpha.toFixed(3)})`;
        }

        let grayValue: number;
        let alpha: number;
        if (isDark) {
          grayValue = Math.floor(110 + Math.random() * 125);
          alpha = 0.18 + Math.random() * 0.34;
        } else {
          grayValue = Math.floor(15 + Math.random() * 95);
          alpha = 0.05 + Math.random() * 0.12;
        }
        return `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${alpha.toFixed(3)})`;
      };

      const gridSize = 35;
      const maxRectSize = 28;

      for (let x = -50; x < width + 50; x += gridSize) {
        const isOddCol = (x / gridSize) % 2 !== 0;
        const yOffset = isOddCol ? gridSize / 2 : 0;

        for (let y = -50 - yOffset; y < height + 50; y += gridSize) {
          const progress = Math.max(0, (width - x) / width);
          const probability = 1 - progress * 1.2;

          if (Math.random() < probability) {
            const sizeModifier = 1 - progress * 0.8;
            const actualSize = maxRectSize * Math.max(0.2, sizeModifier) * (0.6 + Math.random() * 0.4);

            const jitter = gridSize * 0.55;
            const px = x + (Math.random() - 0.5) * jitter;
            const py = y + (Math.random() - 0.5) * jitter;

            ctx.fillStyle = pickFill();

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate((45 * Math.PI) / 180);
            const radius = actualSize * 0.25;
            drawRoundedRect(ctx, -actualSize / 2, -actualSize / 2, actualSize, actualSize, radius);
            ctx.restore();
          }
        }
      }
    };

    const getDimensions = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      return { dpr, width, height };
    };

    const cancelAnimation = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const drawStatic = () => {
      cancelAnimation();
      const { dpr, width, height } = getDimensions();
      if (width === 0 || height === 0) return;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      renderPattern(canvas, width, height, dpr);
    };

    const drawWithFade = () => {
      const { dpr, width, height } = getDimensions();
      if (width === 0 || height === 0) return;

      cancelAnimation();
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const previous = document.createElement('canvas');
      previous.width = canvas.width;
      previous.height = canvas.height;
      const previousCtx = previous.getContext('2d');
      if (!previousCtx || previous.width === 0 || previous.height === 0) {
        drawStatic();
        return;
      }
      previousCtx.drawImage(canvas, 0, 0);

      const next = document.createElement('canvas');
      renderPattern(next, width, height, dpr);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let start: number | null = null;
      const step = (timestamp: number) => {
        if (start === null) start = timestamp;
        const progress = Math.min(1, (timestamp - start) / FADE_DURATION);
        const previousAlpha = Math.pow(1 - progress, 3);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.drawImage(next, 0, 0);
        ctx.globalAlpha = previousAlpha;
        ctx.drawImage(previous, 0, 0);
        ctx.globalAlpha = 1;

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(step);
    };

    drawStatic();

    const resizeObserver = new ResizeObserver(() => drawStatic());
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver(() => drawWithFade());
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-accent'],
    });

    return () => {
      cancelAnimation();
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
