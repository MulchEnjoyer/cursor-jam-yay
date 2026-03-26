"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Spark = {
  id: number;
  dx: number;
  dy: number;
  sizePx: number;
  delayMs: number;
};

type CSSVars = CSSProperties & { [key: `--${string}`]: string };

export default function ClickSpark(props: {
  children: ReactNode;
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  className?: string;
  block?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLSpanElement>) => void;
}) {
  const {
    children,
    sparkColor = "#fff",
    sparkSize = 10,
    sparkRadius = 15,
    sparkCount = 8,
    duration = 400,
    className,
    block = false,
    onClick,
  } = props;

  const nextIdRef = useRef(1);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const lastPointerDownTsRef = useRef<number>(0);

  const clearSoon = useCallback(() => {
    if (clearTimerRef.current != null) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setSparks([]);
      setAnchor(null);
    }, duration + 80);
  }, [duration]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current != null) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const spawnSparks = useCallback(
    (rect: DOMRect, clientX: number, clientY: number) => {
      // If the event came from keyboard activation, React often reports 0/0.
      const safeClientX = Number.isFinite(clientX) && clientX !== 0 ? clientX : rect.left + rect.width / 2;
      const safeClientY = Number.isFinite(clientY) && clientY !== 0 ? clientY : rect.top + rect.height / 2;

      const x = safeClientX - rect.left;
      const y = safeClientY - rect.top;

      setAnchor({ x, y });

      const count = Math.max(1, Math.floor(sparkCount));
      const radius = Math.max(1, sparkRadius);
      const baseSize = Math.max(1, sparkSize);

      const created: Spark[] = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = radius * (0.45 + Math.random() * 0.65);
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const sizePx = baseSize * (0.55 + Math.random() * 0.7);
        const delayMs = Math.random() * 40;
        created.push({ id: nextIdRef.current++, dx, dy, sizePx, delayMs });
      }

      setSparks(created);
      clearSoon();
    },
    [clearSoon, sparkCount, sparkRadius, sparkSize],
  );

  const trigger = useCallback(
    (e: ReactMouseEvent<HTMLSpanElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      spawnSparks(rect, e.clientX, e.clientY);
      onClick?.(e);
    },
    [onClick, spawnSparks],
  );

  const triggerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLSpanElement>) => {
      lastPointerDownTsRef.current = Date.now();
      const rect = e.currentTarget.getBoundingClientRect();
      spawnSparks(rect, e.clientX, e.clientY);
    },
    [spawnSparks],
  );

  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: block ? "block" : "inline-flex",
        width: block ? "100%" : undefined,
      }}
      // Capture-phase handlers make it resilient if the child stops propagation.
      onPointerDownCapture={triggerPointerDown}
      onClickCapture={(e) => {
        // Avoid double-spawning when pointerdown already fired.
        if (Date.now() - lastPointerDownTsRef.current < 200) return;
        trigger(e);
      }}
    >
      {children}

      {anchor
        ? sparks.map((s) => (
            <span
              // Using inline styles so the component stays standalone.
              key={s.id}
              className="clickspark-spark"
              style={
                ({
                  left: anchor.x,
                  top: anchor.y,
                  width: s.sizePx,
                  height: s.sizePx,
                  backgroundColor: sparkColor,
                  animationDuration: `${duration}ms`,
                  animationDelay: `${s.delayMs}ms`,
                  ["--dx"]: `${s.dx}px`,
                  ["--dy"]: `${s.dy}px`,
                } as CSSVars)
              }
            />
          ))
        : null}

      <style jsx>{`
        .clickspark-spark {
          position: absolute;
          z-index: 10;
          pointer-events: none;
          border-radius: 9999px;
          opacity: 1;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 ${Math.max(2, sparkSize / 2)}px rgba(255, 255, 255, 0.35);
          animation-name: clickspark-fly;
          animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          animation-fill-mode: forwards;
        }

        @keyframes clickspark-fly {
          from {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          to {
            transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.2);
            opacity: 0;
          }
        }
      `}</style>
    </span>
  );
}

