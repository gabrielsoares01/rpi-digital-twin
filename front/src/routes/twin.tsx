import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { usePositionTracker } from "#/hooks/usePositionTracker";
import { useLatestTelemetry, useSensorStatus } from "#/hooks/useSensorSocket";
import type { SensorSocketStatus } from "#/interfaces/sensor";

const TwinScene = lazy(() => import("#/components/TwinScene"));

export const Route = createFileRoute("/twin")({ component: TwinPage });

function TwinPage() {
	const status = useSensorStatus();
	const latest = useLatestTelemetry();
	const { currentPosition, currentOrientation, trail, reset } =
		usePositionTracker(latest);
	const [followCamera, setFollowCamera] = useState(true);
	const [lockCenter, setLockCenter] = useState(false);

	const latestSpeed = latest
		? Math.sqrt(
				latest.linear_velocity.x ** 2 +
					latest.linear_velocity.y ** 2 +
					latest.linear_velocity.z ** 2,
			)
		: 0;
	const latestAccelMag = latest
		? Math.sqrt(
				latest.accel.x ** 2 +
					latest.accel.y ** 2 +
					(latest.accel.z - 9.81) ** 2,
			)
		: 0;

	const handleToggleLockCenter = () => {
		if (lockCenter) {
			reset();
		}
		setLockCenter((prev) => !prev);
	};

	return (
		<div className="relative w-full h-screen overflow-hidden bg-[#0a0a1a]">
			{/* 3D Scene — lazy loaded (Three.js needs browser APIs) */}
			<Suspense fallback={<LoadingFallback />}>
				<TwinScene
					currentPosition={currentPosition}
					currentOrientation={currentOrientation}
					trail={trail}
					latestAccelMagnitude={latestAccelMag}
					followCamera={followCamera}
					lockCenter={lockCenter}
				/>
			</Suspense>

			{/* ── HUD Overlay ─────────────────────────────────────── */}

			{/* Top bar */}
			<div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-10">
				{/* Left panel: title + status + readout */}
				<div className="backdrop-blur-md bg-black/40 rounded-xl p-4 border border-white/10 pointer-events-auto">
					<div className="flex items-center gap-3 mb-3">
						<h1 className="text-white text-lg font-semibold tracking-tight">
							Digital Twin
						</h1>
						<StatusBadge status={status} />
					</div>
					{latest && (
						<div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm font-mono">
							<span className="text-white/50">Speed</span>
							<span className="text-white/90">
								{latestSpeed.toFixed(3)} m/s
							</span>
							<span className="text-white/50">Accel</span>
							<span className="text-white/90">
								{latestAccelMag.toFixed(3)} m/s²
							</span>
							<span className="text-white/50">Position</span>
							<span className="text-white/90">
								{lockCenter
									? "(0.0, 0.0, 0.0) cm [Fixed]"
									: `(${currentPosition.map((v) => v.toFixed(1)).join(", ")}) cm`}
							</span>
						</div>
					)}
				</div>

				{/* Right panel: controls */}
				<div className="flex flex-col gap-2 pointer-events-auto">
					<button
						type="button"
						onClick={reset}
						className="backdrop-blur-md bg-black/40 rounded-lg px-4 py-2 border border-white/10 text-white text-sm font-medium hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
					>
						↺ Reset Trail
					</button>
					<button
						type="button"
						onClick={handleToggleLockCenter}
						className={`backdrop-blur-md rounded-lg px-4 py-2 border text-sm font-medium transition-colors cursor-pointer ${
							lockCenter
								? "bg-purple-500/20 border-purple-400/30 text-purple-300 hover:bg-purple-500/30"
								: "bg-black/40 border-white/10 text-white/70 hover:bg-white/10"
						}`}
					>
						🎯 {lockCenter ? "Center Locked" : "Lock Center"}
					</button>
					<button
						type="button"
						onClick={() => setFollowCamera((f) => !f)}
						className={`backdrop-blur-md rounded-lg px-4 py-2 border text-sm font-medium transition-colors cursor-pointer ${
							followCamera
								? "bg-sky-500/20 border-sky-400/30 text-sky-300 hover:bg-sky-500/30"
								: "bg-black/40 border-white/10 text-white/70 hover:bg-white/10"
						}`}
					>
						📷 {followCamera ? "Following" : "Free Camera"}
					</button>
				</div>
			</div>

			{/* Bottom bar */}
			<div className="absolute bottom-4 left-4 right-4 flex flex-col items-center gap-2 pointer-events-none z-10">
				{/* Drift warning */}
				<div className="backdrop-blur-md bg-amber-950/40 rounded-lg px-3 py-1.5 border border-amber-500/20 text-amber-300/80 text-xs">
					⚠ Position is estimated via velocity integration and may drift over
					time
				</div>

				{/* Color legends */}
				<div className="backdrop-blur-md bg-black/40 rounded-xl px-5 py-3 border border-white/10 flex gap-8">
					{/* Speed legend (trail) */}
					<div className="flex items-center gap-2">
						<span className="text-white/50 text-xs font-medium">
							Trail · Speed
						</span>
						<div
							className="w-24 h-2 rounded-full"
							style={{
								background:
									"linear-gradient(to right, #22c55e, #eab308, #ef4444)",
							}}
						/>
						<span className="text-white/50 text-xs">High</span>
					</div>

					{/* Accel legend (box glow) */}
					<div className="flex items-center gap-2">
						<span className="text-white/50 text-xs font-medium">
							Glow · Accel
						</span>
						<div
							className="w-24 h-2 rounded-full"
							style={{
								background: "linear-gradient(to right, #1e40af, #ef4444)",
							}}
						/>
						<span className="text-white/50 text-xs">High</span>
					</div>
				</div>
			</div>
		</div>
	);
}

/* ── Sub-components ───────────────────────────────────── */

function StatusBadge({ status }: { status: SensorSocketStatus }) {
	const config = {
		open: {
			bg: "bg-green-500/20",
			text: "text-green-400",
			label: "Conectado",
			dot: "bg-green-400",
			pulse: true,
		},
		connecting: {
			bg: "bg-yellow-500/20",
			text: "text-yellow-400",
			label: "Conectando...",
			dot: "bg-yellow-400",
			pulse: false,
		},
		closed: {
			bg: "bg-red-500/20",
			text: "text-red-400",
			label: "Desconectado",
			dot: "bg-red-400",
			pulse: false,
		},
		error: {
			bg: "bg-red-500/20",
			text: "text-red-400",
			label: "Erro",
			dot: "bg-red-400",
			pulse: false,
		},
	}[status];

	return (
		<span
			className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
		>
			<span
				className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.pulse ? "animate-pulse" : ""}`}
			/>
			{config.label}
		</span>
	);
}

function LoadingFallback() {
	return (
		<div className="w-full h-full flex items-center justify-center bg-[#0a0a1a]">
			<div className="flex flex-col items-center gap-4">
				<div className="w-10 h-10 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
				<span className="text-white/50 text-sm font-medium">
					Loading 3D scene...
				</span>
			</div>
		</div>
	);
}
