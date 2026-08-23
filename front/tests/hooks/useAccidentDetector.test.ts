import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAccidentDetector } from "#/hooks/useAccidentDetector";
import type { SensorReading } from "#/interfaces/sensor";

function createReading(overrides: Partial<SensorReading> = {}): SensorReading {
	return {
		timestamp: 100.0,
		gyro: { x: 0, y: 0, z: 0 },
		accel: { x: 0, y: 0, z: 9.81 },
		linear_velocity: { x: 1, y: 0, z: 0 },
		orientation: { roll: 0, pitch: 0, yaw: 0 },
		...overrides,
	};
}

describe("useAccidentDetector", () => {
	it("starts with no active alert", () => {
		const { result } = renderHook(() => useAccidentDetector([]));
		expect(result.current.currentAlert).toBeNull();
	});

	it("detects high dynamic impact peak", () => {
		const normalBatch = [createReading({ timestamp: 1.0 })];
		const { result, rerender } = renderHook(
			({ batch }) => useAccidentDetector(batch),
			{ initialProps: { batch: normalBatch } },
		);

		expect(result.current.currentAlert).toBeNull();

		// High impact reading (>25 m/s² dynamic acceleration)
		const impactBatch = [
			createReading({
				timestamp: 1.1,
				accel: { x: 20, y: 20, z: 9.81 }, // dynamic accel = sqrt(400+400) = ~28.28 m/s²
			}),
		];

		rerender({ batch: impactBatch });

		expect(result.current.currentAlert).not.toBeNull();
		expect(result.current.currentAlert?.status).toBe("active");
		expect(
			result.current.currentAlert?.triggeredPatterns.some(
				(p) => p.type === "impact_peak",
			),
		).toBe(true);
	});

	it("detects sudden linear velocity drop", () => {
		// History of moving fast
		const movingBatch = [
			createReading({ timestamp: 1.0, linear_velocity: { x: 5, y: 0, z: 0 } }),
			createReading({ timestamp: 1.2, linear_velocity: { x: 5, y: 0, z: 0 } }),
		];

		const { result, rerender } = renderHook(
			({ batch }) => useAccidentDetector(batch),
			{ initialProps: { batch: movingBatch } },
		);

		// Sudden stop (<0.6 m/s after moving at 5 m/s)
		const crashBatch = [
			createReading({
				timestamp: 1.4,
				linear_velocity: { x: 0.1, y: 0, z: 0 },
			}),
		];

		rerender({ batch: crashBatch });

		expect(result.current.currentAlert).not.toBeNull();
		expect(
			result.current.currentAlert?.triggeredPatterns.some(
				(p) => p.type === "velocity_drop",
			),
		).toBe(true);
	});

	it("detects sustained anomalous orientation tilt", () => {
		const startBatch = [
			createReading({
				timestamp: 1.0,
				orientation: { roll: 65, pitch: 0, yaw: 0 },
			}),
		];

		const { result, rerender } = renderHook(
			({ batch }) => useAccidentDetector(batch),
			{ initialProps: { batch: startBatch } },
		);

		expect(result.current.currentAlert).toBeNull();

		// Sustained tilt for 1.6s (> 1.5s threshold)
		const sustainedBatch = [
			createReading({
				timestamp: 2.7,
				orientation: { roll: 65, pitch: 0, yaw: 0 },
			}),
		];

		rerender({ batch: sustainedBatch });

		expect(result.current.currentAlert).not.toBeNull();
		expect(
			result.current.currentAlert?.triggeredPatterns.some(
				(p) => p.type === "anomalous_orientation",
			),
		).toBe(true);
	});

	it("triggers simulation correctly", () => {
		const { result } = renderHook(() => useAccidentDetector([]));

		act(() => {
			result.current.triggerSimulation();
		});

		expect(result.current.currentAlert).not.toBeNull();
		expect(result.current.currentAlert?.severity).toBe("critical");
		expect(result.current.currentAlert?.triggeredPatterns.length).toBe(3);
	});

	it("dismisses active alert", () => {
		const { result } = renderHook(() => useAccidentDetector([]));

		act(() => {
			result.current.triggerSimulation();
		});

		expect(result.current.currentAlert?.status).toBe("active");

		act(() => {
			result.current.dismissAlert();
		});

		expect(result.current.currentAlert?.status).toBe("dismissed");
	});
});
