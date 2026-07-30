import { createFileRoute } from "@tanstack/react-router";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useSensorSocket } from "#/hooks/useSensorSocket";
import type {
	Orientation,
	SensorReading,
	SensorSocketStatus,
	Vector3,
} from "#/interfaces/sensor";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

const STATUS_LABEL: Record<SensorSocketStatus, string> = {
	connecting: "Conectando...",
	open: "Conectado",
	closed: "Desconectado",
	error: "Erro de conexão",
};

const CHART_COLORS = ["#60a5fa", "#f87171", "#4ade80"];
const GRID_COLOR = "#1f2937";
const AXIS_COLOR = "#64748b";

function Dashboard() {
	const { status, latest, history } = useSensorSocket();

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 p-8 space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-semibold tracking-tight text-white">
					Dashboard
				</h1>
				<StatusBadge status={status} />
			</div>

			{!latest ? (
				<p className="text-lg text-slate-400">
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

function StatusBadge({ status }: { status: SensorSocketStatus }) {
	const color =
		status === "open"
			? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30"
			: status === "connecting"
				? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30"
				: "bg-red-500/10 text-red-400 ring-1 ring-red-500/30";

	return (
		<span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
			{STATUS_LABEL[status]}
		</span>
	);
}

function VectorCard({
	title,
	unit,
	vector,
}: {
	title: string;
	unit: string;
	vector: Vector3;
}) {
	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
			<div className="text-sm text-slate-400 mb-2">{title}</div>
			<div className="space-y-1 text-sm font-mono text-slate-200">
				<div>
					x: {vector.x.toFixed(3)} {unit}
				</div>
				<div>
					y: {vector.y.toFixed(3)} {unit}
				</div>
				<div>
					z: {vector.z.toFixed(3)} {unit}
				</div>
			</div>
		</div>
	);
}

function OrientationCard({ orientation }: { orientation: Orientation }) {
	return (
		<div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
			<div className="text-sm text-slate-400 mb-2">Orientação</div>
			<div className="space-y-1 text-sm font-mono text-slate-200">
				<div>roll: {orientation.roll.toFixed(2)}°</div>
				<div>pitch: {orientation.pitch.toFixed(2)}°</div>
				<div>yaw: {orientation.yaw.toFixed(2)}°</div>
			</div>
		</div>
	);
}

function VectorChart({
	title,
	history,
	field,
}: {
	title: string;
	history: SensorReading[];
	field: "gyro" | "accel" | "linear_velocity";
}) {
	const data = history.map((reading) => ({
		timestamp: reading.timestamp * 1000,
		x: reading[field].x,
		y: reading[field].y,
		z: reading[field].z,
	}));

	return (
		<div className="h-64 w-full">
			<h2 className="text-sm font-medium text-slate-300 mb-2">{title}</h2>
			<ResponsiveContainer width="100%" height="100%">
				<LineChart data={data}>
					<CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
					<XAxis
						dataKey="timestamp"
						tickFormatter={(value: number) =>
							new Date(value).toLocaleTimeString()
						}
						stroke={AXIS_COLOR}
						tick={{ fill: AXIS_COLOR, fontSize: 12 }}
					/>
					<YAxis
						stroke={AXIS_COLOR}
						tick={{ fill: AXIS_COLOR, fontSize: 12 }}
					/>
					<Tooltip
						labelFormatter={(value) =>
							typeof value === "number"
								? new Date(value).toLocaleTimeString()
								: String(value)
						}
						contentStyle={{
							backgroundColor: "#0f172a",
							border: "1px solid #1f2937",
							borderRadius: 8,
							color: "#e2e8f0",
						}}
						labelStyle={{ color: "#94a3b8" }}
					/>
					<Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
					<Line
						type="monotone"
						dataKey="x"
						stroke={CHART_COLORS[0]}
						dot={false}
					/>
					<Line
						type="monotone"
						dataKey="y"
						stroke={CHART_COLORS[1]}
						dot={false}
					/>
					<Line
						type="monotone"
						dataKey="z"
						stroke={CHART_COLORS[2]}
						dot={false}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}

function OrientationChart({ history }: { history: SensorReading[] }) {
	const data = history.map((reading) => ({
		timestamp: reading.timestamp * 1000,
		roll: reading.orientation.roll,
		pitch: reading.orientation.pitch,
		yaw: reading.orientation.yaw,
	}));

	return (
		<div className="h-64 w-full">
			<h2 className="text-sm font-medium text-slate-300 mb-2">
				Orientação (°)
			</h2>
			<ResponsiveContainer width="100%" height="100%">
				<LineChart data={data}>
					<CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
					<XAxis
						dataKey="timestamp"
						tickFormatter={(value: number) =>
							new Date(value).toLocaleTimeString()
						}
						stroke={AXIS_COLOR}
						tick={{ fill: AXIS_COLOR, fontSize: 12 }}
					/>
					<YAxis
						stroke={AXIS_COLOR}
						tick={{ fill: AXIS_COLOR, fontSize: 12 }}
					/>
					<Tooltip
						labelFormatter={(value) =>
							typeof value === "number"
								? new Date(value).toLocaleTimeString()
								: String(value)
						}
						contentStyle={{
							backgroundColor: "#0f172a",
							border: "1px solid #1f2937",
							borderRadius: 8,
							color: "#e2e8f0",
						}}
						labelStyle={{ color: "#94a3b8" }}
					/>
					<Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
					<Line
						type="monotone"
						dataKey="roll"
						stroke={CHART_COLORS[0]}
						dot={false}
					/>
					<Line
						type="monotone"
						dataKey="pitch"
						stroke={CHART_COLORS[1]}
						dot={false}
					/>
					<Line
						type="monotone"
						dataKey="yaw"
						stroke={CHART_COLORS[2]}
						dot={false}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
