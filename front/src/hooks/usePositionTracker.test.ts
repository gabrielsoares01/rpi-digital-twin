import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SensorReading } from "#/interfaces/sensor";
import { usePositionTracker } from "./usePositionTracker";

function reading(overrides: Partial<SensorReading>): SensorReading {
	return {
		timestamp: 0,
		gyro: { x: 0, y: 0, z: 0 },
		accel: { x: 0, y: 0, z: 9.81 },
		linear_velocity: { x: 0, y: 0, z: 0 },
		orientation: { roll: 0, pitch: 0, yaw: 0 },
		...overrides,
	};
}

describe("usePositionTracker", () => {
	it("starts at the origin with an empty trail", () => {
		const { result } = renderHook(() => usePositionTracker(null));

		expect(result.current.currentPosition).toEqual([0, 0, 0]);
		expect(result.current.currentOrientation).toEqual([0, 0, 0]);
		expect(result.current.trail).toEqual([]);
	});

	it("does not move on the first reading (no previous timestamp to diff against)", () => {
		const { result, rerender } = renderHook(
			({ latest }) => usePositionTracker(latest),
			{
				initialProps: {
					latest: reading({
						timestamp: 10,
						linear_velocity: { x: 1, y: 0, z: 0 },
					}),
				},
			},
		);
		rerender({
			latest: reading({ timestamp: 10, linear_velocity: { x: 1, y: 0, z: 0 } }),
		});

		expect(result.current.currentPosition).toEqual([0, 0, 0]);
		expect(result.current.trail).toEqual([]);
	});

	it("integrates velocity into position, remapping sensor axes to three.js axes", () => {
		const { result, rerender } = renderHook(
			({ latest }) => usePositionTracker(latest),
			{ initialProps: { latest: reading({ timestamp: 0 }) } },
		);

		// dt = 1s, velocity 2 m/s in sensor X, 3 m/s in sensor Y, 4 m/s in sensor Z.
		rerender({
			latest: reading({
				timestamp: 1,
				linear_velocity: { x: 2, y: 3, z: 4 },
			}),
		});

		// SCALE = 100 (m -> cm). Sensor Z (up) -> three Y, sensor Y (forward) -> three Z.
		expect(result.current.currentPosition[0]).toBeCloseTo(2 * 1 * 100);
		expect(result.current.currentPosition[1]).toBeCloseTo(4 * 1 * 100);
		expect(result.current.currentPosition[2]).toBeCloseTo(3 * 1 * 100);
		expect(result.current.trail).toHaveLength(1);
	});

	it("ignores updates with a non-positive or excessively large dt", () => {
		const { result, rerender } = renderHook(
			({ latest }) => usePositionTracker(latest),
			{ initialProps: { latest: reading({ timestamp: 0 }) } },
		);

		rerender({
			latest: reading({ timestamp: 0, linear_velocity: { x: 5, y: 0, z: 0 } }),
		}); // dt = 0
		expect(result.current.trail).toHaveLength(0);

		rerender({
			latest: reading({
				timestamp: 100,
				linear_velocity: { x: 5, y: 0, z: 0 },
			}),
		}); // dt = 100 > MAX_DT
		expect(result.current.trail).toHaveLength(0);
	});

	it("converts orientation degrees to radians in [pitch, yaw, roll] order", () => {
		const { result, rerender } = renderHook(
			({ latest }) => usePositionTracker(latest),
			{ initialProps: { latest: reading({ timestamp: 0 }) } },
		);

		rerender({
			latest: reading({
				timestamp: 1,
				orientation: { roll: 90, pitch: 45, yaw: 180 },
			}),
		});

		const [pitchRad, yawRad, rollRad] = result.current.currentOrientation;
		expect(pitchRad).toBeCloseTo((45 * Math.PI) / 180);
		expect(yawRad).toBeCloseTo((180 * Math.PI) / 180);
		expect(rollRad).toBeCloseTo((90 * Math.PI) / 180);
	});

	it("caps the trail length at 500 points", () => {
		const { result, rerender } = renderHook(
			({ latest }) => usePositionTracker(latest),
			{ initialProps: { latest: reading({ timestamp: 0 }) } },
		);

		for (let i = 1; i <= 510; i++) {
			rerender({
				latest: reading({
					timestamp: i,
					linear_velocity: { x: 0.1, y: 0, z: 0 },
				}),
			});
		}

		expect(result.current.trail).toHaveLength(500);
	});

	it("reset() clears position, orientation and trail", () => {
		const { result, rerender } = renderHook(
			({ latest }) => usePositionTracker(latest),
			{ initialProps: { latest: reading({ timestamp: 0 }) } },
		);

		rerender({
			latest: reading({
				timestamp: 1,
				linear_velocity: { x: 1, y: 1, z: 1 },
				orientation: { roll: 10, pitch: 10, yaw: 10 },
			}),
		});
		expect(result.current.trail).toHaveLength(1);

		act(() => result.current.reset());

		expect(result.current.currentPosition).toEqual([0, 0, 0]);
		expect(result.current.currentOrientation).toEqual([0, 0, 0]);
		expect(result.current.trail).toEqual([]);
	});
});
