import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
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

const CHART_COLORS = ["#2563eb", "#dc2626", "#16a34a"];

function Dashboard() {
	const { status, latest, history } = useSensorSocket();

	return (
		<div className="p-8 space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-4xl font-bold">Dashboard</h1>
				<StatusBadge status={status} />
			</div>

			{!latest ? (
				<p className="text-lg text-gray-500">
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
			? "bg-green-100 text-green-800"
			: status === "connecting"
				? "bg-yellow-100 text-yellow-800"
				: "bg-red-100 text-red-800";

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
		<div className="rounded-lg border border-gray-200 p-4 shadow-sm">
			<div className="text-sm text-gray-500 mb-2">{title}</div>
			<div className="space-y-1 text-sm font-mono">
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
		<div className="rounded-lg border border-gray-200 p-4 shadow-sm">
			<div className="text-sm text-gray-500 mb-2">Orientação</div>
			<div className="space-y-1 text-sm font-mono">
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
	const data = useMemo(
		() =>
			history.map((reading) => ({
				timestamp: reading.timestamp * 1000,
				x: reading[field].x,
				y: reading[field].y,
				z: reading[field].z,
			})),
		[history, field],
	);

	return (
		<div className="h-64 w-full">
			<h2 className="text-sm font-medium text-gray-600 mb-2">{title}</h2>
			<ResponsiveContainer width="100%" height="100%">
				<LineChart data={data}>
					<CartesianGrid strokeDasharray="3 3" />
					<XAxis
						dataKey="timestamp"
						tickFormatter={(value: number) =>
							new Date(value).toLocaleTimeString()
						}
					/>
					<YAxis />
					<Tooltip
						labelFormatter={(value) =>
							typeof value === "number"
								? new Date(value).toLocaleTimeString()
								: String(value)
						}
					/>
					<Legend />
					<Line
						type="monotone"
						dataKey="x"
						stroke={CHART_COLORS[0]}
						dot={false}
						isAnimationActive={false}
					/>
					<Line
						type="monotone"
						dataKey="y"
						stroke={CHART_COLORS[1]}
						dot={false}
						isAnimationActive={false}
					/>
					<Line
						type="monotone"
						dataKey="z"
						stroke={CHART_COLORS[2]}
						dot={false}
						isAnimationActive={false}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}

function OrientationChart({ history }: { history: SensorReading[] }) {
	const data = useMemo(
		() =>
			history.map((reading) => ({
				timestamp: reading.timestamp * 1000,
				roll: reading.orientation.roll,
				pitch: reading.orientation.pitch,
				yaw: reading.orientation.yaw,
			})),
		[history],
	);

	return (
		<div className="h-64 w-full">
			<h2 className="text-sm font-medium text-gray-600 mb-2">Orientação (°)</h2>
			<ResponsiveContainer width="100%" height="100%">
				<LineChart data={data}>
					<CartesianGrid strokeDasharray="3 3" />
					<XAxis
						dataKey="timestamp"
						tickFormatter={(value: number) =>
							new Date(value).toLocaleTimeString()
						}
					/>
					<YAxis />
					<Tooltip
						labelFormatter={(value) =>
							typeof value === "number"
								? new Date(value).toLocaleTimeString()
								: String(value)
						}
					/>
					<Legend />
					<Line
						type="monotone"
						dataKey="roll"
						stroke={CHART_COLORS[0]}
						dot={false}
						isAnimationActive={false}
					/>
					<Line
						type="monotone"
						dataKey="pitch"
						stroke={CHART_COLORS[1]}
						dot={false}
						isAnimationActive={false}
					/>
					<Line
						type="monotone"
						dataKey="yaw"
						stroke={CHART_COLORS[2]}
						dot={false}
						isAnimationActive={false}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
