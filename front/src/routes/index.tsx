import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Activity,
	ArrowRight,
	Box,
	Compass,
	Cpu,
	Gauge,
	Layers,
	LineChart,
	Radio,
	Zap,
} from "lucide-react";
import { useEffect } from "react";
import { useLatestTelemetry, useSensorStatus } from "#/hooks/useSensorSocket";
import { getSensorSocket } from "#/services/websocket";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	useEffect(() => {
		const socket = getSensorSocket();
		socket.connect();
		return () => socket.disconnect();
	}, []);

	const status = useSensorStatus();
	const latest = useLatestTelemetry();

	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
			{/* Ambient background glow */}
			<div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
			<div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

			<div className="max-w-6xl mx-auto px-6 py-12 lg:py-16 space-y-16">
				{/* ── Hero Section ───────────────────────────────────── */}
				<section className="space-y-8">
					<div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-medium tracking-wide">
						<Zap className="w-3.5 h-3.5 text-cyan-400" />
						Real-Time Robotics Telemetry & 3D Spatial Twin
					</div>

					<div className="space-y-4 max-w-3xl">
						<h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
							Raspberry Pi <br />
							<span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
								Digital Twin System
							</span>
						</h1>
						<p className="text-lg text-slate-400 leading-relaxed">
							A real-time 3D digital twin monitoring system for an autonomous or
							remote-controlled robot. Processes live accelerometer, gyroscope,
							linear velocity, and orientation data streamed via Socket.IO to
							visualize movement and spatial trajectories.
						</p>
					</div>

					{/* Action Buttons */}
					<div className="flex flex-wrap items-center gap-4">
						<Link
							to="/twin"
							className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-200"
						>
							<Box className="w-5 h-5" />
							Launch 3D Twin
							<ArrowRight className="w-4 h-4 ml-1" />
						</Link>

						<Link
							to="/dashboard"
							className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold transition-all duration-200"
						>
							<LineChart className="w-5 h-5 text-cyan-400" />
							View Telemetry Dashboard
						</Link>
					</div>
				</section>

				{/* ── Live Telemetry Quick Status Widget ─────────────── */}
				<section className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-6">
					<div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-xl bg-slate-800 text-cyan-400">
								<Radio className="w-5 h-5" />
							</div>
							<div>
								<h2 className="text-sm font-semibold text-slate-200">
									Live Robot Stream Status
								</h2>
								<p className="text-xs text-slate-400">
									WebSocket connection to Raspberry Pi backend
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800">
							<span
								className={`w-2.5 h-2.5 rounded-full ${
									status === "open"
										? "bg-emerald-500 animate-pulse"
										: status === "connecting"
											? "bg-amber-500"
											: "bg-rose-500"
								}`}
							/>
							<span className="text-xs font-mono font-medium text-slate-300 capitalize">
								{status === "open"
									? "Connected (Receiving Data)"
									: status === "connecting"
										? "Connecting to backend..."
										: "Offline"}
							</span>
						</div>
					</div>

					{/* Live Readouts Summary */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
						<div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
							<div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
								<Activity className="w-3.5 h-3.5 text-cyan-400" /> Accelerometer
							</div>
							<p className="text-base font-mono font-semibold text-slate-100">
								{latest
									? `${Math.sqrt(
											latest.accel.x ** 2 +
												latest.accel.y ** 2 +
												latest.accel.z ** 2,
										).toFixed(2)} m/s²`
									: "--"}
							</p>
						</div>

						<div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
							<div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
								<Gauge className="w-3.5 h-3.5 text-blue-400" /> Linear Speed
							</div>
							<p className="text-base font-mono font-semibold text-slate-100">
								{latest
									? `${Math.sqrt(
											latest.linear_velocity.x ** 2 +
												latest.linear_velocity.y ** 2 +
												latest.linear_velocity.z ** 2,
										).toFixed(2)} m/s`
									: "--"}
							</p>
						</div>

						<div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
							<div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
								<Compass className="w-3.5 h-3.5 text-indigo-400" /> Orientation
							</div>
							<p className="text-base font-mono font-semibold text-slate-100">
								{latest ? `${latest.orientation.yaw.toFixed(1)}° Yaw` : "--"}
							</p>
						</div>

						<div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60">
							<div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
								<Layers className="w-3.5 h-3.5 text-emerald-400" /> Robot Specs
							</div>
							<p className="text-base font-mono font-semibold text-slate-100">
								20×20×7 cm
							</p>
						</div>
					</div>
				</section>

				{/* ── Key Features Grid ─────────────────────────────── */}
				<section className="space-y-6">
					<div className="space-y-2">
						<h2 className="text-2xl font-bold text-slate-100">
							Project Capabilities
						</h2>
						<p className="text-slate-400 text-sm">
							Designed for real-time visualization and analytics of physical
							robotics hardware.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-cyan-500/40 transition-all duration-200 group">
							<div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200">
								<Box className="w-6 h-6" />
							</div>
							<h3 className="text-lg font-semibold text-slate-100 mb-2">
								3D Spatial Digital Twin
							</h3>
							<p className="text-sm text-slate-400 leading-relaxed">
								Interactive 3D representation matching the 20×20×7 cm robot box.
								Translates and rotates in real-time space while drawing a
								dynamic velocity heatmap trajectory.
							</p>
						</div>

						<div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-blue-500/40 transition-all duration-200 group">
							<div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200">
								<LineChart className="w-6 h-6" />
							</div>
							<h3 className="text-lg font-semibold text-slate-100 mb-2">
								Real-Time Telemetry Dashboard
							</h3>
							<p className="text-sm text-slate-400 leading-relaxed">
								Live time-series charts powered by Recharts, tracking 3-axis
								gyroscope, acceleration vectors, linear velocities, and Euler
								orientation angles.
							</p>
						</div>

						<div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-sky-500/40 transition-all duration-200 group">
							<div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200">
								<Cpu className="w-6 h-6" />
							</div>
							<h3 className="text-lg font-semibold text-slate-100 mb-2">
								Hardware & Socket.IO Backend
							</h3>
							<p className="text-sm text-slate-400 leading-relaxed">
								Integrated with Raspberry Pi onboard sensors. Transmits
								high-frequency IMU sensor payloads over WebSocket protocol with
								built-in mock mode support.
							</p>
						</div>
					</div>
				</section>

				{/* ── System Architecture Diagram Section ───────────── */}
				<section className="p-8 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950 border border-slate-800 space-y-6">
					<h2 className="text-xl font-bold text-slate-100">
						Data Flow Architecture
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
						<div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center">
							<Cpu className="w-8 h-8 text-cyan-400 mb-2" />
							<p className="text-xs font-semibold text-slate-200">IMU Sensor</p>
							<p className="text-[11px] text-slate-500 mt-1">
								Accel & Gyro Data
							</p>
						</div>

						<div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center">
							<Radio className="w-8 h-8 text-blue-400 mb-2" />
							<p className="text-xs font-semibold text-slate-200">
								Raspberry Pi Server
							</p>
							<p className="text-[11px] text-slate-500 mt-1">
								Socket.IO Streaming
							</p>
						</div>

						<div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center">
							<Activity className="w-8 h-8 text-indigo-400 mb-2" />
							<p className="text-xs font-semibold text-slate-200">
								React Web App
							</p>
							<p className="text-[11px] text-slate-500 mt-1">
								State & Telemetry Store
							</p>
						</div>

						<div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center">
							<Box className="w-8 h-8 text-emerald-400 mb-2" />
							<p className="text-xs font-semibold text-slate-200">
								3D Twin & Charts
							</p>
							<p className="text-[11px] text-slate-500 mt-1">
								Spatial Trajectory
							</p>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
