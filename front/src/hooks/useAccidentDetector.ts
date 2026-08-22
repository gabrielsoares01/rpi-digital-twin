import { useCallback, useEffect, useRef, useState } from "react";
import type {
	AccidentAlert,
	AccidentKinematics,
	AccidentPatternDetail,
} from "#/interfaces/accident";
import type { SensorReading } from "#/interfaces/sensor";

// Detection Thresholds
const IMPACT_ACCEL_THRESHOLD = 25.0; // m/s² dynamic acceleration (gravity subtracted)
const MIN_SPEED_BEFORE_DROP = 4.0; // m/s (~14.4 km/h)
const MAX_SPEED_AFTER_DROP = 0.6; // m/s (~2.1 km/h)
const VELOCITY_DROP_TIME_WINDOW = 0.8; // seconds
const ANOMALOUS_TILT_ANGLE = 55.0; // degrees (roll or pitch)
const ANOMALOUS_TILT_DURATION = 1.5; // seconds
const ALERT_COOLDOWN_MS = 10000; // 10s before another alert can auto-trigger

export function useAccidentDetector(batch: SensorReading[]) {
	const [currentAlert, setCurrentAlert] = useState<AccidentAlert | null>(null);
	const [alertHistory, setAlertHistory] = useState<AccidentAlert[]>([]);

	// Internal state tracking
	const historyWindowRef = useRef<SensorReading[]>([]);
	const tiltStartTimeRef = useRef<number | null>(null);
	const lastAlertTimeRef = useRef<number>(0);

	useEffect(() => {
		if (!batch || batch.length === 0) return;

		const now = Date.now();
		if (currentAlert && currentAlert.status === "active") return;
		if (now - lastAlertTimeRef.current < ALERT_COOLDOWN_MS) return;

		for (let i = 0; i < batch.length; i++) {
			const reading = batch[i];
			const history = historyWindowRef.current;

			// Add to sliding window
			history.push(reading);

			// Keep 4 seconds of history
			const windowCutoff = reading.timestamp - 4.0;
			while (history.length > 0 && history[0].timestamp < windowCutoff) {
				history.shift();
			}

			// 1. Calculate dynamic acceleration
			const ax = reading.accel.x;
			const ay = reading.accel.y;
			const az = reading.accel.z - 9.81;
			const dynamicAccel = Math.sqrt(ax * ax + ay * ay + az * az);

			// 2. Calculate current speed and speed in recent window
			const currentSpeed = Math.sqrt(
				reading.linear_velocity.x ** 2 +
					reading.linear_velocity.y ** 2 +
					reading.linear_velocity.z ** 2,
			);

			// Look back ~0.8s for maximum speed prior to drop
			const recentDropCutoff = reading.timestamp - VELOCITY_DROP_TIME_WINDOW;
			let speedBefore = currentSpeed;
			for (const pastReading of history) {
				if (pastReading.timestamp >= recentDropCutoff) {
					const pastSpeed = Math.sqrt(
						pastReading.linear_velocity.x ** 2 +
							pastReading.linear_velocity.y ** 2 +
							pastReading.linear_velocity.z ** 2,
					);
					if (pastSpeed > speedBefore) {
						speedBefore = pastSpeed;
					}
				}
			}
			const speedDropDelta = speedBefore - currentSpeed;

			// 3. Calculate orientation tilt
			const absRoll = Math.abs(reading.orientation.roll);
			const absPitch = Math.abs(reading.orientation.pitch);
			const maxTilt = Math.max(absRoll, absPitch);

			if (maxTilt >= ANOMALOUS_TILT_ANGLE) {
				if (tiltStartTimeRef.current === null) {
					tiltStartTimeRef.current = reading.timestamp;
				}
			} else {
				tiltStartTimeRef.current = null;
			}

			const tiltDurationSec = tiltStartTimeRef.current
				? reading.timestamp - tiltStartTimeRef.current
				: 0;

			// Evaluate patterns
			const isImpactSpike = dynamicAccel >= IMPACT_ACCEL_THRESHOLD;
			const isVelocityDrop =
				speedBefore >= MIN_SPEED_BEFORE_DROP &&
				currentSpeed <= MAX_SPEED_AFTER_DROP &&
				speedDropDelta >= 3.0;
			const isAnomalousTilt = tiltDurationSec >= ANOMALOUS_TILT_DURATION;

			if (isImpactSpike || isVelocityDrop || isAnomalousTilt) {
				const patterns: AccidentPatternDetail[] = [];

				if (isImpactSpike) {
					patterns.push({
						type: "impact_peak",
						title: "Pico Intenso de Impacto",
						description:
							"Variação abrupta e extrema de aceleração/desaceleração nos eixos.",
						valueLabel: `Impacto: ${dynamicAccel.toFixed(1)} m/s² (~${(dynamicAccel / 9.81).toFixed(1)}G)`,
					});
				}

				if (isVelocityDrop) {
					patterns.push({
						type: "velocity_drop",
						title: "Queda da Velocidade Linear",
						description:
							"Parada repentina do veículo detectada em fração de segundo.",
						valueLabel: `Queda: ${(speedBefore * 3.6).toFixed(1)} km/h → ${(currentSpeed * 3.6).toFixed(1)} km/h`,
					});
				}

				if (isAnomalousTilt) {
					patterns.push({
						type: "anomalous_orientation",
						title: "Orientação Anômala Persistente",
						description:
							"Ângulo de inclinação excessivo sustentado após tombamento ou queda.",
						valueLabel: `Inclinado a ${maxTilt.toFixed(1)}° por ${tiltDurationSec.toFixed(1)}s`,
					});
				}

				const kinematics: AccidentKinematics = {
					peakAccel: dynamicAccel,
					speedBefore,
					speedAfter: currentSpeed,
					speedDropDelta,
					maxRoll: absRoll,
					maxPitch: absPitch,
					tiltDurationSec,
				};

				const severity =
					patterns.length >= 2 || dynamicAccel > 35.0 ? "critical" : "high";

				const alert: AccidentAlert = {
					id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
					timestamp: Date.now(),
					severity,
					triggeredPatterns: patterns,
					kinematics,
					status: "active",
				};

				lastAlertTimeRef.current = Date.now();
				setCurrentAlert(alert);
				setAlertHistory((prev) => [alert, ...prev]);
				break;
			}
		}
	}, [batch, currentAlert]);

	const dismissAlert = useCallback(() => {
		setCurrentAlert((prev) => (prev ? { ...prev, status: "dismissed" } : null));
	}, []);

	const triggerSimulation = useCallback(() => {
		const simulatedPatterns: AccidentPatternDetail[] = [
			{
				type: "impact_peak",
				title: "Pico Intenso de Impacto",
				description:
					"Variação abrupta de desaceleração violenta detectada nos sensores de força.",
				valueLabel: "Impacto: 38.4 m/s² (~3.9G)",
			},
			{
				type: "velocity_drop",
				title: "Queda da Velocidade Linear",
				description:
					"Parada abrupta e instantânea do veículo decorrente de colisão frontal/lateral.",
				valueLabel: "Queda: 48.5 km/h → 0.0 km/h",
			},
			{
				type: "anomalous_orientation",
				title: "Orientação Anômala Persistente",
				description:
					"Veículo tombado lateralmente fora do eixo vertical mantido por mais de 1.5s.",
				valueLabel: "Inclinado a 78.2° por 2.4s",
			},
		];

		const simulatedAlert: AccidentAlert = {
			id: `sim-${Date.now()}`,
			timestamp: Date.now(),
			severity: "critical",
			triggeredPatterns: simulatedPatterns,
			kinematics: {
				peakAccel: 38.4,
				speedBefore: 13.47, // ~48.5 km/h
				speedAfter: 0.0,
				speedDropDelta: 13.47,
				maxRoll: 78.2,
				maxPitch: 24.1,
				tiltDurationSec: 2.4,
			},
			status: "active",
		};

		lastAlertTimeRef.current = Date.now();
		setCurrentAlert(simulatedAlert);
		setAlertHistory((prev) => [simulatedAlert, ...prev]);
	}, []);

	return {
		currentAlert,
		alertHistory,
		dismissAlert,
		triggerSimulation,
	};
}
