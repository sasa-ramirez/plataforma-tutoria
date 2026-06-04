import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { StrokeData } from "@/services/board";

const W = 1200;
const H = 675;

export interface Segment {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  size: number;
  mode: "pen" | "erase";
}

export interface WhiteboardHandle {
  drawSegment: (s: Segment) => void;
  loadStrokes: (strokes: StrokeData[]) => void;
  clear: () => void;
}

interface Props {
  readOnly?: boolean;
  color: string;
  size: number;
  mode: "pen" | "erase";
  onSegment?: (s: Segment) => void;
  onStrokeDone?: (s: StrokeData) => void;
}

export const Whiteboard = forwardRef<WhiteboardHandle, Props>(function Whiteboard(
  { readOnly, color, size, mode, onSegment, onStrokeDone },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const stroke = useRef<StrokeData | null>(null);

  const ctx = () => canvasRef.current?.getContext("2d") ?? null;

  function paint(s: Segment) {
    const c = ctx();
    if (!c) return;
    c.save();
    c.globalCompositeOperation =
      s.mode === "erase" ? "destination-out" : "source-over";
    c.strokeStyle = s.color;
    c.lineWidth = s.size;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(s.from.x * W, s.from.y * H);
    c.lineTo(s.to.x * W, s.to.y * H);
    c.stroke();
    c.restore();
  }

  function paintStroke(d: StrokeData) {
    for (let i = 1; i < d.points.length; i++) {
      paint({
        from: d.points[i - 1],
        to: d.points[i],
        color: d.color,
        size: d.width,
        mode: d.mode,
      });
    }
  }

  useImperativeHandle(ref, () => ({
    drawSegment: (s) => paint(s),
    loadStrokes: (strokes) => {
      const c = ctx();
      if (c) c.clearRect(0, 0, W, H);
      strokes.forEach(paintStroke);
    },
    clear: () => {
      const c = ctx();
      if (c) c.clearRect(0, 0, W, H);
    },
  }));

  useEffect(() => {
    const c = ctx();
    if (c) c.clearRect(0, 0, W, H);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const down = (e: React.PointerEvent) => {
    if (readOnly) return;
    drawing.current = true;
    const p = pos(e);
    last.current = p;
    stroke.current = { points: [p], color, width: size, mode };
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (readOnly || !drawing.current || !last.current) return;
    const p = pos(e);
    const seg: Segment = { from: last.current, to: p, color, size, mode };
    paint(seg);
    onSegment?.(seg);
    stroke.current?.points.push(p);
    last.current = p;
  };

  const up = () => {
    if (readOnly || !drawing.current) return;
    drawing.current = false;
    if (stroke.current && stroke.current.points.length > 1) {
      onStrokeDone?.(stroke.current);
    }
    stroke.current = null;
    last.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
      className="aspect-video w-full touch-none rounded-2xl border bg-white"
      style={{ touchAction: "none", cursor: readOnly ? "default" : "crosshair" }}
    />
  );
});
