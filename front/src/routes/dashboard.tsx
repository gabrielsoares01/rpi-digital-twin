import { createFileRoute } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
	useLatestTelemetry,
	useSensorHistory,
	useSensorStatus,
} from "#/hooks/useSensorSocket";
import type {
	Orientation,
	SensorReading,
	SensorSocketStatus,
	Vector3,
} from "#/interfaces/sensor";
import { getSensorSocket } from "#/services/websocket";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

const STATUS_LABEL: Record<SensorSocketStatus, string> = {
	connecting: "Conectando...",
	open: "Conectado",
	closed: "Desconectado",
	error: "Erro de conexão",
};

const CHART_COLORS = ["#3b82f6", "#ef4444", "#22c55e"]; // neon blue, neon red, neon green

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

function Dashboard() {
	// Page-level WebSocket lifecycle management (connects on mount, disconnects on unmount)
	useEffect(() => {
		const socket = getSensorSocket();
		socket.connect();
		return () => socket.disconnect();
	}, []);

	const status = useSensorStatus();
	const latest = useLatestTelemetry();
	const history = useSensorHistory();

	return (
		<div className="p-8 space-y-6 min-h-screen bg-slate-950 text-slate-100">
			<div className="flex items-center justify-between">
				<h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
					Dashboard Telemetria
				</h1>
				<StatusBadge status={status} />
			</div>

			{!latest ? (
				<p className="text-lg text-slate-500 font-medium">
					Aguardando leituras dos sensores...
				</p>
			) : (
				<>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						<VectorCard title="Giroscópio" unit="°/s" vector={latest.gyro} />
						<VectorCard title="Aceleração" unit="m/s²" vector={latest.accel} />
						<VectorCard
							title="Velocidade linear"
							unit="m/s"
							vector={latest.linear_velocity}
						/>
						<OrientationCard orientation={latest.orientation} />
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<VectorChart
							title="Giroscópio (°/s)"
							history={history}
							field="gyro"
						/>
						<VectorChart
							title="Aceleração (m/s²)"
							history={history}
							field="accel"
						/>
						<VectorChart
							title="Velocidade linear (m/s)"
							history={history}
							field="linear_velocity"
						/>
						<OrientationChart history={history} />
					</div>
				</>
			)}
		</div>
	);
}

const StatusBadge = memo(function StatusBadge({
	status,
}: {
	status: SensorSocketStatus;
}) {
	const color =
		status === "open"
			? "bg-green-500/20 border-green-400/30 text-green-400"
			: status === "connecting"
				? "bg-yellow-500/20 border-yellow-400/30 text-yellow-400"
				: "bg-red-500/20 border-red-400/30 text-red-400";

	return (
		<span
			className={`px-3.5 py-1.5 rounded-full border text-xs font-mono font-medium ${color}`}
		>
			{STATUS_LABEL[status]}
		</span>
	);
});

const VectorCard = memo(function VectorCard({
	title,
	unit,
	vector,
}: {
	title: string;
	unit: string;
	vector: Vector3;
}) {
	return (
		<div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 shadow-sm backdrop-blur-sm">
			<div className="text-xs font-mono text-slate-400 tracking-wider mb-2">
				{title}
			</div>
			<div className="space-y-1 text-sm font-mono text-slate-100">
				<div>
					<span className="text-blue-400 font-semibold mr-1">X:</span>{" "}
					{vector.x.toFixed(3)} {unit}
				</div>
				<div>
					<span className="text-red-400 font-semibold mr-1">Y:</span>{" "}
					{vector.y.toFixed(3)} {unit}
				</div>
				<div>
					<span className="text-green-400 font-semibold mr-1">Z:</span>{" "}
					{vector.z.toFixed(3)} {unit}
				</div>
			</div>
		</div>
	);
});

const OrientationCard = memo(function OrientationCard({
	orientation,
}: {
	orientation: Orientation;
}) {
	return (
		<div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 shadow-sm backdrop-blur-sm">
			<div className="text-xs font-mono text-slate-400 tracking-wider mb-2">
				Orientação
			</div>
			<div className="space-y-1 text-sm font-mono text-slate-100">
				<div>
					<span className="text-blue-400 font-semibold mr-1">Roll:</span>{" "}
					{orientation.roll.toFixed(2)}°
				</div>
				<div>
					<span className="text-red-400 font-semibold mr-1">Pitch:</span>{" "}
					{orientation.pitch.toFixed(2)}°
				</div>
				<div>
					<span className="text-green-400 font-semibold mr-1">Yaw:</span>{" "}
					{orientation.yaw.toFixed(2)}°
				</div>
			</div>
		</div>
	);
});

type DataPoint = {
	timestamp: number;
	values: number[];
};

const CanvasLineChart = memo(function CanvasLineChart({
	title,
	data,
	labels,
	colors = CHART_COLORS,
}: {
	title: string;
	data: DataPoint[];
	labels: string[];
	colors?: string[];
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
		null,
	);

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

		const paddingLeft = 45;
		const paddingRight = 15;
		const paddingTop = 10;
		const paddingBottom = 25;
		const chartWidth = width - paddingLeft - paddingRight;
		const chartHeight = height - paddingTop - paddingBottom;

		let minY = -1;
		let maxY = 1;
		if (data.length > 0) {
			const allValues = data.flatMap((d) => d.values);
			minY = Math.min(...allValues);
			maxY = Math.max(...allValues);
			const range = maxY - minY;
			const extra = range === 0 ? 1 : range * 0.15;
			minY -= extra;
			maxY += extra;
		}

		ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
		ctx.lineWidth = 1;
		const gridCount = 5;
		for (let i = 0; i <= gridCount; i++) {
			const y = paddingTop + (i / gridCount) * chartHeight;
			ctx.beginPath();
			ctx.moveTo(paddingLeft, y);
			ctx.lineTo(width - paddingRight, y);
			ctx.stroke();

			const val = maxY - (i / gridCount) * (maxY - minY);
			ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
			ctx.font = "10px monospace";
			ctx.textAlign = "right";
			ctx.textBaseline = "middle";
			ctx.fillText(val.toFixed(2), paddingLeft - 8, y);
		}

		if (data.length > 1) {
			const len = data.length;
			const seriesCount = data[0].values.length;

			for (let s = 0; s < seriesCount; s++) {
				ctx.beginPath();
				ctx.strokeStyle = colors[s % colors.length];
				ctx.lineWidth = 2;
				ctx.lineCap = "round";
				ctx.lineJoin = "round";

				for (let i = 0; i < len; i++) {
					const pt = data[i];
					const x = paddingLeft + (i / (len - 1)) * chartWidth;
					const val = pt.values[s];
					const y =
						paddingTop + (1 - (val - minY) / (maxY - minY)) * chartHeight;

					if (i === 0) {
						ctx.moveTo(x, y);
					} else {
						ctx.lineTo(x, y);
					}
				}
				ctx.stroke();
			}
		}

		if (data.length > 1) {
			ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
			ctx.font = "10px monospace";
			ctx.textAlign = "center";
			ctx.textBaseline = "top";

			const xGridCount = 4;
			for (let i = 0; i < xGridCount; i++) {
				const idx = Math.floor((i / (xGridCount - 1)) * (data.length - 1));
				const pt = data[idx];
				const x = paddingLeft + (idx / (data.length - 1)) * chartWidth;

				const timeStr = new Date(pt.timestamp).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				});
				ctx.fillText(timeStr, x, height - paddingBottom + 6);
			}
		}

		if (mousePos && data.length > 1) {
			const { x: mouseX, y: mouseY } = mousePos;

			if (mouseX >= paddingLeft && mouseX <= width - paddingRight) {
				const len = data.length;
				const ratio = (mouseX - paddingLeft) / chartWidth;
				const idx = Math.min(
					Math.max(Math.round(ratio * (len - 1)), 0),
					len - 1,
				);
				const activePoint = data[idx];

				const x = paddingLeft + (idx / (len - 1)) * chartWidth;

				ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(x, paddingTop);
				ctx.lineTo(x, height - paddingBottom);
				ctx.stroke();

				const boxWidth = 100;
				const boxHeight = 20 + activePoint.values.length * 14;
				let boxX = x + 10;
				if (boxX + boxWidth > width) {
					boxX = x - boxWidth - 10;
				}
				const boxY = Math.min(
					Math.max(mouseY - boxHeight / 2, paddingTop),
					height - paddingBottom - boxHeight,
				);

				ctx.fillStyle = "rgba(10, 10, 26, 0.9)";
				ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
				ctx.fill();
				ctx.stroke();

				ctx.fillStyle = "#ffffff";
				ctx.font = "bold 9px monospace";
				ctx.textAlign = "left";
				ctx.textBaseline = "top";
				const timeStr = new Date(activePoint.timestamp).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				});
				ctx.fillText(timeStr, boxX + 6, boxY + 6);

				for (let s = 0; s < activePoint.values.length; s++) {
					ctx.fillStyle = colors[s % colors.length];
					ctx.font = "9px monospace";
					ctx.fillText(
						`${labels[s]}: ${activePoint.values[s].toFixed(2)}`,
						boxX + 6,
						boxY + 20 + s * 13,
					);
				}

				for (let s = 0; s < activePoint.values.length; s++) {
					const val = activePoint.values[s];
					const y =
						paddingTop + (1 - (val - minY) / (maxY - minY)) * chartHeight;

					ctx.beginPath();
					ctx.arc(x, y, 4, 0, 2 * Math.PI);
					ctx.fillStyle = colors[s % colors.length];
					ctx.fill();
					ctx.strokeStyle = "#ffffff";
					ctx.lineWidth = 1;
					ctx.stroke();
				}
			}
		}
	}, [data, width, height, colors, labels, mousePos]);

	const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		setMousePos({
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
		});
	};

	const handleMouseLeave = () => {
		setMousePos(null);
	};

	return (
		<div
			ref={containerRef}
			className="h-64 w-full flex flex-col bg-slate-900/40 rounded-xl p-4 border border-white/5 shadow-inner"
		>
			<h2 className="text-sm font-semibold tracking-wide text-slate-300 mb-3">
				{title}
			</h2>
			<div className="flex-1 relative">
				<canvas
					ref={canvasRef}
					onMouseMove={handleMouseMove}
					onMouseLeave={handleMouseLeave}
					className="absolute inset-0 w-full h-full cursor-crosshair"
				/>
			</div>
		</div>
	);
});

const VectorChart = memo(function VectorChart({
	title,
	history,
	field,
}: {
	title: string;
	history: SensorReading[];
	field: "gyro" | "accel" | "linear_velocity";
}) {
	const data = useMemo(
		() =>
			history.map((reading) => ({
				timestamp: reading.timestamp * 1000,
				values: [reading[field].x, reading[field].y, reading[field].z],
			})),
		[history, field],
	);

	return <CanvasLineChart title={title} data={data} labels={["x", "y", "z"]} />;
});

const OrientationChart = memo(function OrientationChart({
	history,
}: {
	history: SensorReading[];
}) {
	const data = useMemo(
		() =>
			history.map((reading) => ({
				timestamp: reading.timestamp * 1000,
				values: [
					reading.orientation.roll,
					reading.orientation.pitch,
					reading.orientation.yaw,
				],
			})),
		[history],
	);

	return (
		<CanvasLineChart
			title="Orientação (°)"
			data={data}
			labels={["roll", "pitch", "yaw"]}
		/>
	);
});
