import { createFileRoute, Link } from "@tanstack/react-router";
import { Box, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/twin")({ component: TwinPlaceholder });

function TwinPlaceholder() {
	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8 text-center">
			<div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 animate-pulse">
				<Box className="w-8 h-8" />
			</div>
			<h1 className="text-3xl font-bold mb-3 text-slate-100">
				3D Digital Twin Space
			</h1>
			<p className="text-slate-400 max-w-md leading-relaxed mb-8">
				Real-time 3D spatial twin visualization workspace.
			</p>
			<Link
				to="/"
				className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-sm font-medium transition-all"
			>
				<ArrowLeft className="w-4 h-4" />
				Back to Home
			</Link>
		</div>
	);
}
