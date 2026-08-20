import { memo, useEffect, useRef, useState } from "react";
import type { Vector3 } from "#/interfaces/sensor";

const GAUGE_COLORS = ["#3b82f6", "#ef4444", "#22c55e"]; // neon blue, neon red, neon green
const GAUGE_MIN = -20;
const GAUGE_MAX = 20;
const GAUGE_START_ANGLE = Math.PI * 0.75; // 135°, sweeping clockwise
const GAUGE_SWEEP = Math.PI * 1.5; // 270° total sweep
const GAUGE_MAJOR_TICKS = [-20, -10, 0, 10, 20];
const GAUGE_MINOR_TICKS = [-15, -5, 5, 15];
// Zones are symmetric around 0, keyed by |value| threshold
const GAUGE_ZONES: { limit: number; color: string }[] = [
	{ limit: 6, color: "#22c55e" },
	{ limit: 14, color: "#eab308" },
	{ limit: GAUGE_MAX, color: "#ef4444" },
];

function valueToAngle(value: number) {
	const clamped = Math.min(Math.max(value, GAUGE_MIN), GAUGE_MAX);
	const ratio = (clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
	return GAUGE_START_ANGLE + ratio * GAUGE_SWEEP;
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
	const [size, setSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const observer = new ResizeObserver((entries) => {
			if (!entries || entries.length === 0) return;
			const { width, height } = entries[0].contentRect;
			setSize({ width, height });
		});

		observer.observe(el);
		return () => observer.disconnect();
	}, [ref]);

	return size;
}

const AccelerometerGauge = memo(function AccelerometerGauge({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color: string;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const { width, height } = useContainerSize(containerRef);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || width <= 0 || height <= 0) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, width, height);

		const cx = width / 2;
		const cy = height * 0.6;
		const radius = Math.min(width, height * 1.25) / 2 - 20;

		// Bezel: subtle radial gradient behind the arc for a physical-instrument feel
		const bezel = ctx.createRadialGradient(
			cx,
			cy,
			radius * 0.2,
			cx,
			cy,
			radius + 14,
		);
		bezel.addColorStop(0, "rgba(255, 255, 255, 0.04)");
		bezel.addColorStop(1, "rgba(0, 0, 0, 0)");
		ctx.fillStyle = bezel;
		ctx.beginPath();
		ctx.arc(cx, cy, radius + 14, 0, 2 * Math.PI);
		ctx.fill();

		// Background track
		ctx.lineWidth = 10;
		ctx.lineCap = "butt";
		ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
		ctx.beginPath();
		ctx.arc(cx, cy, radius, GAUGE_START_ANGLE, GAUGE_START_ANGLE + GAUGE_SWEEP);
		ctx.stroke();

		// Magnitude zones (green/yellow/red), symmetric around 0
		let prevLimit = 0;
		for (const zone of GAUGE_ZONES) {
			ctx.strokeStyle = zone.color;
			ctx.globalAlpha = 0.55;
			ctx.beginPath();
			ctx.arc(
				cx,
				cy,
				radius,
				valueToAngle(prevLimit),
				valueToAngle(zone.limit),
			);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(
				cx,
				cy,
				radius,
				valueToAngle(-zone.limit),
				valueToAngle(-prevLimit),
			);
			ctx.stroke();
			prevLimit = zone.limit;
		}
		ctx.globalAlpha = 1;

		// Ticks
		ctx.font = "8px monospace";
		ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		for (const tick of GAUGE_MINOR_TICKS) {
			const angle = valueToAngle(tick);
			const x1 = cx + (radius + 6) * Math.cos(angle);
			const y1 = cy + (radius + 6) * Math.sin(angle);
			const x2 = cx + (radius + 10) * Math.cos(angle);
			const y2 = cy + (radius + 10) * Math.sin(angle);
			ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
		}
		for (const tick of GAUGE_MAJOR_TICKS) {
			const angle = valueToAngle(tick);
			const x1 = cx + (radius + 6) * Math.cos(angle);
			const y1 = cy + (radius + 6) * Math.sin(angle);
			const x2 = cx + (radius + 12) * Math.cos(angle);
			const y2 = cy + (radius + 12) * Math.sin(angle);
			ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();

			const lx = cx + (radius + 21) * Math.cos(angle);
			const ly = cy + (radius + 21) * Math.sin(angle);
			ctx.fillText(String(tick), lx, ly);
		}

		const valueAngle = valueToAngle(value);
		const needleLength = radius - 6;

		// Counterweight tail, opposite the needle tip
		ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
		ctx.lineWidth = 3;
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx - 10 * Math.cos(valueAngle), cy - 10 * Math.sin(valueAngle));
		ctx.stroke();

		// Needle
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(
			cx + needleLength * Math.cos(valueAngle),
			cy + needleLength * Math.sin(valueAngle),
		);
		ctx.stroke();

		// Pin with soft glow
		ctx.save();
		ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
		ctx.shadowBlur = 6;
		ctx.fillStyle = "#ffffff";
		ctx.beginPath();
		ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
		ctx.fill();
		ctx.restore();

		ctx.fillStyle = color;
		ctx.font = "bold 15px monospace";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(value.toFixed(2), cx, cy - radius * 0.35);

		ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
		ctx.font = "9px monospace";
		ctx.fillText("m/s²", cx, cy - radius * 0.35 + 14);
	}, [value, width, height, color]);

	return (
		<div
			ref={containerRef}
			className="flex-1 min-w-0 flex flex-col items-center"
		>
			<div className="w-full h-32 relative">
				<canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
			</div>
			<span className="text-xs font-mono font-semibold mt-1" style={{ color }}>
				{label}
			</span>
		</div>
	);
});

type Props = {
	accel: Vector3;
};

export const AccelerometerGauges = memo(function AccelerometerGauges({
	accel,
}: Props) {
	return (
		<div className="h-72 w-full flex flex-col bg-slate-900/40 rounded-xl p-4 border border-white/5 shadow-inner">
			<h2 className="text-sm font-semibold tracking-wide text-slate-300 mb-3">
				Aceleração (m/s²)
			</h2>
			<div className="flex-1 flex items-center gap-2">
				<AccelerometerGauge label="X" value={accel.x} color={GAUGE_COLORS[0]} />
				<AccelerometerGauge label="Y" value={accel.y} color={GAUGE_COLORS[1]} />
				<AccelerometerGauge label="Z" value={accel.z} color={GAUGE_COLORS[2]} />
			</div>
		</div>
	);
});
