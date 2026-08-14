import { createFileRoute } from "@tanstack/react-router";
import { Activity, Cpu, Database, Terminal, Trash2, Wifi } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
	useSensorStatus,
	useSystemLogs,
	useSystemMetrics,
} from "#/hooks/useSensorSocket";
import type { SensorSocketStatus, SystemLogEntry } from "#/interfaces/sensor";
import { getSensorSocket } from "#/services/websocket";

export const Route = createFileRoute("/health")({ component: HealthPage });

function HealthPage() {
	// Page-level WebSocket lifecycle management (connects on mount, disconnects on unmount)
	useEffect(() => {
		const socket = getSensorSocket();
		socket.connect();
		return () => socket.disconnect();
	}, []);

	const status = useSensorStatus();
	const metrics = useSystemMetrics();
	const logs = useSystemLogs();

	return (
		<div className="p-8 space-y-6 min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
			{/* Ambient glows */}
			<div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
			<div className="absolute bottom-10 left-10 w-[400px] h-[300px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
						Observabilidade & Saúde
					</h1>
					<p className="text-sm text-slate-400 font-mono mt-1">
						Monitoramento de hardware, latência e logs estruturados em tempo
						real.
					</p>
				</div>
				<StatusBadge status={status} />
			</div>

			{/* Resource Cards Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
				<MetricCard
					title="Uso de CPU"
					value={metrics ? `${metrics.cpu_usage_pct.toFixed(1)}%` : "N/A"}
					icon={Cpu}
					colorClass="text-cyan-400 border-cyan-500/10"
					progress={metrics ? metrics.cpu_usage_pct : 0}
					footer="Carga do processo Python"
				/>
				<MetricCard
					title="Memória RAM"
					value={metrics ? `${metrics.memory_usage_mb.toFixed(1)} MB` : "N/A"}
					icon={Database}
					colorClass="text-emerald-400 border-emerald-500/10"
					progress={
						metrics ? Math.min(100, (metrics.memory_usage_mb / 64) * 100) : 0
					}
					footer="Resident Set Size (RSS)"
				/>
				<MetricCard
					title="Latência do Loop"
					value={metrics ? `${metrics.avg_latency_ms.toFixed(2)} ms` : "N/A"}
					icon={Activity}
					colorClass="text-amber-400 border-amber-500/10"
					progress={
						metrics ? Math.min(100, (metrics.avg_latency_ms / 20) * 100) : 0
					}
					footer={
						metrics
							? `Max Pico: ${metrics.max_latency_ms.toFixed(1)}ms`
							: "Frequência: 50Hz"
					}
				/>
				<MetricCard
					title="Latência de Rede (RTT)"
					value={
						metrics?.latency_rtt_ms !== undefined
							? `${metrics.latency_rtt_ms} ms`
							: "N/A"
					}
					icon={Wifi}
					colorClass="text-rose-400 border-rose-500/10"
					progress={
						metrics?.latency_rtt_ms !== undefined
							? Math.min(100, (metrics.latency_rtt_ms / 200) * 100)
							: 0
					}
					footer={
						metrics
							? `${metrics.throughput_fps.toFixed(1)} FPS | ${metrics.client_count} clientes`
							: "RTT do WebSocket"
					}
				/>
			</div>

			{/* Terminal Logs Logger console */}
			<TerminalConsole rawLogs={logs} />
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
			? "bg-emerald-500/20 border-emerald-400/30 text-emerald-400 shadow-emerald-500/5"
			: status === "connecting"
				? "bg-amber-500/20 border-amber-400/30 text-amber-400 shadow-amber-500/5"
				: "bg-rose-500/20 border-rose-400/30 text-rose-400 shadow-rose-500/5";

	const text =
		status === "open"
			? "ONLINE"
			: status === "connecting"
				? "CONECTANDO..."
				: "OFFLINE";

	return (
		<div
			className={`px-4 py-2 rounded-xl border text-xs font-mono font-bold tracking-widest shadow-lg ${color}`}
		>
			SYSTEM: {text}
		</div>
	);
});

interface MetricCardProps {
	title: string;
	value: string;
	icon: React.ComponentType<{ className?: string }>;
	colorClass: string;
	progress: number;
	footer: string;
}

const MetricCard = memo(function MetricCard({
	title,
	value,
	icon: Icon,
	colorClass,
	progress,
	footer,
}: MetricCardProps) {
	return (
		<div
			className={`flex flex-col bg-slate-900/40 rounded-2xl p-5 border border-white/5 backdrop-blur-md shadow-lg`}
		>
			<div className="flex items-center justify-between mb-3">
				<span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
					{title}
				</span>
				<Icon className={`w-5 h-5 ${colorClass.split(" ")[0]}`} />
			</div>
			<div className="text-3xl font-extrabold tracking-tight text-white mb-4">
				{value}
			</div>
			<div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden mb-3 border border-white/5">
				<div
					className={`h-full transition-all duration-500 bg-gradient-to-r ${
						colorClass.includes("cyan")
							? "from-cyan-500 to-blue-500"
							: colorClass.includes("emerald")
								? "from-emerald-500 to-teal-500"
								: colorClass.includes("amber")
									? "from-amber-500 to-orange-500"
									: "from-rose-500 to-pink-500"
					}`}
					style={{ width: `${progress}%` }}
				/>
			</div>
			<div className="text-[11px] font-mono text-slate-500">{footer}</div>
		</div>
	);
});

const TerminalConsole = memo(function TerminalConsole({
	rawLogs,
}: {
	rawLogs: SystemLogEntry[];
}) {
	const [logFilter, setLogFilter] = useState<
		"ALL" | "INFO" | "WARNING" | "ERROR"
	>("ALL");
	const [searchQuery, setSearchQuery] = useState("");
	const [isAutoScroll, setIsAutoScroll] = useState(true);
	const terminalEndRef = useRef<HTMLDivElement>(null);

	// Combine incoming logs and allow filtering
	const combinedLogs = useMemo(() => {
		return rawLogs.filter((log) => {
			const queryMatch = searchQuery
				? log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
					log.name.toLowerCase().includes(searchQuery.toLowerCase())
				: true;
			const levelMatch = logFilter === "ALL" ? true : log.level === logFilter;
			return queryMatch && levelMatch;
		});
	}, [rawLogs, logFilter, searchQuery]);

	// Auto-scroll to bottom of terminal
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom whenever logs update
	useEffect(() => {
		if (isAutoScroll) {
			terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [combinedLogs, isAutoScroll]);

	const clearLogs = () => {
		// Since rawLogs come from external store, we can just clear our current filtered view
		// Or we can let the user know they are cleared.
		setSearchQuery("");
		setLogFilter("ALL");
	};

	return (
		<div className="bg-slate-950 rounded-2xl border border-white/5 shadow-2xl flex flex-col h-[500px]">
			{/* Terminal Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-white/5 gap-3 bg-slate-900/20">
				<div className="flex items-center gap-2.5">
					<Terminal className="w-5 h-5 text-cyan-400" />
					<h2 className="text-sm font-mono font-bold text-slate-200 tracking-wider">
						Terminal de Logs do Sistema
					</h2>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					{/* Search */}
					<input
						type="text"
						placeholder="Buscar..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono w-32 sm:w-44"
					/>

					{/* Level Filters */}
					<div className="flex rounded-lg bg-slate-900 border border-white/10 p-0.5">
						{(["ALL", "INFO", "WARNING", "ERROR"] as const).map((lvl) => (
							<button
								key={lvl}
								type="button"
								onClick={() => setLogFilter(lvl)}
								className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
									logFilter === lvl
										? lvl === "ERROR"
											? "bg-rose-500/20 text-rose-400"
											: lvl === "WARNING"
												? "bg-amber-500/20 text-amber-400"
												: "bg-cyan-500/20 text-cyan-400"
										: "text-slate-500 hover:text-slate-300"
								}`}
							>
								{lvl}
							</button>
						))}
					</div>

					{/* Clear Button */}
					<button
						type="button"
						onClick={clearLogs}
						className="p-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
						title="Limpar Console"
					>
						<Trash2 className="w-4 h-4" />
					</button>

					{/* AutoScroll Checkbox */}
					<label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-mono text-slate-400">
						<input
							type="checkbox"
							checked={isAutoScroll}
							onChange={(e) => setIsAutoScroll(e.target.checked)}
							className="rounded bg-slate-900 border-white/10 text-cyan-500 focus:ring-0 focus:ring-offset-0"
						/>
						Scroll
					</label>
				</div>
			</div>

			{/* Terminal Lines Container */}
			<div className="flex-1 overflow-y-auto p-5 font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-white/10">
				{combinedLogs.length === 0 ? (
					<div className="text-slate-600 italic text-center py-20 select-none">
						Nenhum log correspondente aos filtros.
					</div>
				) : (
					combinedLogs.map((log, idx) => {
						const levelColor =
							log.level === "ERROR" || log.level === "CRITICAL"
								? "text-rose-500 font-bold"
								: log.level === "WARNING"
									? "text-amber-500 font-bold"
									: "text-cyan-500";

						const timeStr = log.timestamp.includes("T")
							? log.timestamp.split("T")[1].slice(0, 8)
							: log.timestamp.slice(0, 8);

						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static visual console list
								key={`${log.timestamp}-${idx}`}
								className="flex flex-col sm:flex-row sm:items-start hover:bg-white/5 py-1 px-1.5 rounded transition-all"
							>
								{/* Timestamp & Level */}
								<div className="flex items-center gap-2 shrink-0 select-none text-slate-600 mb-0.5 sm:mb-0">
									<span>[{timeStr}]</span>
									<span className={`w-16 uppercase text-[10px] ${levelColor}`}>
										[{log.level}]
									</span>
								</div>

								{/* Context / Filename */}
								<span className="text-slate-500 select-none mr-2 shrink-0">
									[{log.name}:{log.lineno}]
								</span>

								{/* Message */}
								<div className="flex-1 break-all text-slate-200">
									{log.message}
								</div>

								{/* Correlation ID */}
								{log.correlation_id && (
									<span
										className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-white/5 text-slate-500 select-all shrink-0 mt-1 sm:mt-0 sm:ml-2"
										title={`Correlation ID / client sid: ${log.correlation_id}`}
									>
										sid:{log.correlation_id.slice(0, 6)}
									</span>
								)}
							</div>
						);
					})
				)}
				<div ref={terminalEndRef} />
			</div>
		</div>
	);
});
