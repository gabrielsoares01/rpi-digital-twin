import {
	Activity,
	AlertTriangle,
	ArrowDownRight,
	CheckCircle2,
	Clock,
	RotateCw,
	ShieldAlert,
	Sparkles,
	X,
} from "lucide-react";
import { memo } from "react";
import type { AccidentAlert, AccidentPatternType } from "#/interfaces/accident";

type Props = {
	alert: AccidentAlert;
	onDismiss: () => void;
	onReSimulate?: () => void;
};

export const AccidentAlertModal = memo(function AccidentAlertModal({
	alert,
	onDismiss,
	onReSimulate,
}: Props) {
	if (alert.status !== "active") return null;

	const formattedTime = new Date(alert.timestamp).toLocaleTimeString("pt-BR", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

	const getPatternIcon = (type: AccidentPatternType) => {
		switch (type) {
			case "impact_peak":
				return <Activity className="w-5 h-5 text-rose-400" />;
			case "velocity_drop":
				return <ArrowDownRight className="w-5 h-5 text-amber-400" />;
			case "anomalous_orientation":
				return <RotateCw className="w-5 h-5 text-purple-400" />;
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
			{/* Main Modal Card */}
			<div className="relative w-full max-w-xl overflow-hidden bg-slate-950/90 border border-rose-500/40 rounded-2xl shadow-2xl shadow-rose-950/50 text-white">
				{/* Top Emergency Glow Bar */}
				<div className="h-1.5 w-full bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 animate-pulse" />

				{/* Header */}
				<div className="p-6 pb-4 flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-b from-rose-950/40 to-transparent">
					<div className="flex items-center gap-3.5">
						<div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
							<AlertTriangle className="w-6 h-6 animate-bounce" />
							<span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<span className="px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-full">
									{alert.severity === "critical"
										? "Acidente Crítico"
										: "Possível Acidente"}
								</span>
								<span className="text-xs text-white/50 font-mono flex items-center gap-1">
									<Clock className="w-3 h-3" /> {formattedTime}
								</span>
							</div>
							<h2 className="text-xl font-bold tracking-tight text-white mt-1">
								Possível Acidente Detectado
							</h2>
						</div>
					</div>

					<button
						type="button"
						onClick={onDismiss}
						className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
						aria-label="Fechar"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Body Content */}
				<div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
					{/* Padrões Cinemáticos Identificados */}
					<div>
						<h3 className="text-xs font-semibold uppercase tracking-wider text-rose-300/80 mb-3 flex items-center gap-1.5">
							<ShieldAlert className="w-4 h-4 text-rose-400" /> Padrões
							Cinemáticos Identificados
						</h3>

						<div className="space-y-2.5">
							{alert.triggeredPatterns.map((pattern) => (
								<div
									key={pattern.type}
									className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-rose-500/30 transition-all flex items-start gap-3"
								>
									<div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
										{getPatternIcon(pattern.type)}
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between gap-2">
											<h4 className="text-sm font-semibold text-white">
												{pattern.title}
											</h4>
											<span className="text-xs font-mono font-medium px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-md">
												{pattern.valueLabel}
											</span>
										</div>
										<p className="text-xs text-white/60 mt-1 leading-relaxed">
											{pattern.description}
										</p>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Metrics Grid */}
					<div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-black/40 border border-white/10">
						<div className="text-center p-2 rounded-lg bg-white/[0.02]">
							<span className="text-[10px] uppercase font-semibold text-white/40 block">
								Pico de Impacto
							</span>
							<span className="text-base font-bold font-mono text-rose-400">
								{alert.kinematics.peakAccel.toFixed(1)}{" "}
								<span className="text-xs text-white/50 font-sans">m/s²</span>
							</span>
						</div>

						<div className="text-center p-2 rounded-lg bg-white/[0.02]">
							<span className="text-[10px] uppercase font-semibold text-white/40 block">
								Velocidade Pré
							</span>
							<span className="text-base font-bold font-mono text-amber-400">
								{(alert.kinematics.speedBefore * 3.6).toFixed(1)}{" "}
								<span className="text-xs text-white/50 font-sans">km/h</span>
							</span>
						</div>

						<div className="text-center p-2 rounded-lg bg-white/[0.02]">
							<span className="text-[10px] uppercase font-semibold text-white/40 block">
								Maior Inclinação
							</span>
							<span className="text-base font-bold font-mono text-purple-400">
								{Math.max(
									alert.kinematics.maxRoll,
									alert.kinematics.maxPitch,
								).toFixed(1)}
								°
							</span>
						</div>
					</div>
				</div>

				{/* Modal Footer */}
				<div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-3">
					{onReSimulate ? (
						<button
							type="button"
							onClick={onReSimulate}
							className="px-3.5 py-2 text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
						>
							<Sparkles className="w-3.5 h-3.5 text-amber-400" /> Simular
							Acidente
						</button>
					) : (
						<div />
					)}

					<button
						type="button"
						onClick={onDismiss}
						className="px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-xl transition-all shadow-lg shadow-rose-900/40 flex items-center gap-2 cursor-pointer"
					>
						<CheckCircle2 className="w-4 h-4" /> Reconhecer e Fechar
					</button>
				</div>
			</div>
		</div>
	);
});
