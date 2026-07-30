import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import type { SensorReading, SensorSocketStatus } from "#/services/websocket";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

const STATUS_LABEL: Record<SensorSocketStatus, string> = {
	connecting: "Conectando...",
	open: "Conectado",
	closed: "Desconectado",
	error: "Erro de conexão",
};

function Dashboard() {
	const { status, latestBySensor, history } = useSensorSocket();
	const sensors = Array.from(latestBySensor.values());
	const chartData = buildChartData(history);

	return (
		<div className="p-8 space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-4xl font-bold">Dashboard</h1>
				<StatusBadge status={status} />
			</div>

			{sensors.length === 0 ? (
				<p className="text-lg text-gray-500">
					Aguardando leituras dos sensores...
				</p>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{sensors.map((reading) => (
						<SensorCard key={reading.sensorId} reading={reading} />
					))}
				</div>
			)}

			{chartData.length > 0 && (
				<div className="h-80 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<LineChart data={chartData}>
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
							{Array.from(latestBySensor.keys()).map((sensorId, index) => (
								<Line
									key={sensorId}
									type="monotone"
									dataKey={sensorId}
									stroke={CHART_COLORS[index % CHART_COLORS.length]}
									connectNulls
									dot={false}
								/>
							))}
						</LineChart>
					</ResponsiveContainer>
				</div>
			)}
		</div>
	);
}

const CHART_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed"];

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

function SensorCard({ reading }: { reading: SensorReading }) {
	const secondsAgo = useSecondsAgo(reading.timestamp);

	return (
		<div className="rounded-lg border border-gray-200 p-4 shadow-sm">
			<div className="text-sm text-gray-500">{reading.sensorId}</div>
			<div className="text-3xl font-bold">
				{reading.value}
				{reading.unit && (
					<span className="text-lg font-normal ml-1">{reading.unit}</span>
				)}
			</div>
			<div className="text-xs text-gray-400 mt-1">
				última atualização há {secondsAgo}s
			</div>
		</div>
	);
}

function useSecondsAgo(timestamp: number): number {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);

	return Math.max(0, Math.round((now - timestamp) / 1000));
}

function buildChartData(
	history: SensorReading[],
): Array<Record<string, number>> {
	const byTimestamp = new Map<number, Record<string, number>>();

	for (const reading of history) {
		const point = byTimestamp.get(reading.timestamp) ?? {
			timestamp: reading.timestamp,
		};
		point[reading.sensorId] = reading.value;
		byTimestamp.set(reading.timestamp, point);
	}

	return Array.from(byTimestamp.values()).sort(
		(a, b) => a.timestamp - b.timestamp,
	);
}
