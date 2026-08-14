import { Link } from "@tanstack/react-router";
import { Activity, Box, Cpu, Home, LineChart, Radio } from "lucide-react";
import { useSensorSocket } from "#/hooks/useSensorSocket";

export function Sidebar() {
	const { status } = useSensorSocket();

	const navItems = [
		{
			to: "/",
			label: "Home",
			icon: Home,
		},
		{
			to: "/dashboard",
			label: "Dashboard",
			icon: LineChart,
		},
		{
			to: "/twin",
			label: "Digital Twin",
			icon: Box,
		},
		{
			to: "/health",
			label: "Health Monitor",
			icon: Activity,
		},
	];

	return (
		<aside className="group fixed top-0 left-0 bottom-0 z-50 flex flex-col justify-between w-16 hover:w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/80 shadow-2xl transition-all duration-300 ease-in-out overflow-hidden select-none">
			{/* Top Section: Logo & Brand */}
			<div>
				<div className="flex items-center gap-3.5 h-16 px-4 border-b border-slate-800/60">
					<div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white shadow-lg shadow-cyan-500/20 shrink-0">
						<Cpu className="w-5 h-5" />
					</div>
					<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
						<h1 className="font-bold text-slate-100 tracking-tight text-sm">
							RPi Twin
						</h1>
						<p className="text-[10px] font-mono text-cyan-400">
							v1.0 telemetry
						</p>
					</div>
				</div>

				{/* Navigation Links */}
				<nav className="p-2 space-y-1.5 mt-3">
					{navItems.map((item) => {
						const Icon = item.icon;
						return (
							<Link
								key={item.to}
								to={item.to}
								activeProps={{
									className:
										"bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-sm shadow-cyan-500/10",
								}}
								inactiveProps={{
									className:
										"text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent",
								}}
								className="flex items-center gap-4 px-3 py-3 rounded-xl border font-medium text-sm transition-all duration-150"
							>
								<Icon className="w-5 h-5 shrink-0" />
								<span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
									{item.label}
								</span>
							</Link>
						);
					})}
				</nav>
			</div>

			{/* Bottom Section: Socket Connection Status */}
			<div className="p-3 border-t border-slate-800/60 bg-slate-950/40">
				<div className="flex items-center gap-3.5 px-1 py-1">
					<div className="relative shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800/80">
						<Radio className="w-4 h-4 text-slate-400" />
						<span
							className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
								status === "open"
									? "bg-emerald-500 animate-pulse"
									: status === "connecting"
										? "bg-amber-500"
										: "bg-rose-500"
							}`}
						/>
					</div>
					<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
						<p className="text-xs font-medium text-slate-300">Robot Stream</p>
						<p
							className={`text-[10px] capitalize font-mono ${
								status === "open"
									? "text-emerald-400"
									: status === "connecting"
										? "text-amber-400"
										: "text-rose-400"
							}`}
						>
							{status === "open"
								? "Connected"
								: status === "connecting"
									? "Connecting..."
									: "Offline"}
						</p>
					</div>
				</div>
			</div>
		</aside>
	);
}
