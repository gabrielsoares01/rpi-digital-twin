import { useCallback, useEffect, useRef, useState } from "react";
import type { SensorReading } from "#/interfaces/sensor";

export type TrackedPoint = {
	position: [number, number, number];
	speed: number;
	accelMagnitude: number;
	timestamp: number;
};

const TRAIL_LIMIT = 500;
const SCALE = 100; // m → cm
const DEG2RAD = Math.PI / 180;
const MAX_DT = 5; // ignore gaps longer than 5s

export function usePositionTracker(batch: SensorReading[]) {
	const posRef = useRef<[number, number, number]>([0, 0, 0]);
	// Stable ref to the trail array — mutated in-place, never replaced
	const trailRef = useRef<TrackedPoint[]>([]);
	const prevTsRef = useRef<number | null>(null);

	// Scalar state for position + orientation (cheap — 6 numbers, no arrays)
	const [positionState, setPositionState] = useState({
		currentPosition: [0, 0, 0] as [number, number, number],
		currentOrientation: [0, 0, 0] as [number, number, number],
	});
	// Integer version counter drives TrailPath rerenders without copying the trail array
	const [trailVersion, setTrailVersion] = useState(0);

	useEffect(() => {
		if (!batch || batch.length === 0) return;

		for (let i = 0; i < batch.length; i++) {
			const reading = batch[i];
			const prevTs = prevTsRef.current;
			prevTsRef.current = reading.timestamp;

			if (prevTs === null) continue;

			const dt = reading.timestamp - prevTs;
			if (dt <= 0 || dt > MAX_DT) continue;

			const v = reading.linear_velocity;

			// Integrate velocity → position (sensor Z-up → Three.js Y-up)
			const newPos: [number, number, number] = [
				posRef.current[0] + v.x * dt * SCALE,
				posRef.current[1] + v.z * dt * SCALE, // sensor z → three y (up)
				posRef.current[2] + v.y * dt * SCALE, // sensor y → three z (forward)
			];
			posRef.current = newPos;

			const speed = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
			const a = reading.accel;
			// Subtract gravity (sensor z ≈ 9.81) to get dynamic acceleration
			const accelMag = Math.sqrt(a.x ** 2 + a.y ** 2 + (a.z - 9.81) ** 2);

			const point: TrackedPoint = {
				position: newPos,
				speed,
				accelMagnitude: accelMag,
				timestamp: reading.timestamp,
			};
			// Mutate the trail array in-place — no new array allocated
			if (trailRef.current.length >= TRAIL_LIMIT) {
				trailRef.current.shift();
			}
			trailRef.current.push(point);
		}

		// Update position/orientation using the latest reading of the batch
		const latestReading = batch[batch.length - 1];
		setPositionState({
			currentPosition: posRef.current,
			currentOrientation: [
				latestReading.orientation.pitch * DEG2RAD,
				latestReading.orientation.yaw * DEG2RAD,
				latestReading.orientation.roll * DEG2RAD,
			],
		});
		// Bump version to signal TrailPath that data changed, without copying the array
		setTrailVersion((v) => v + 1);
	}, [batch]);

	const reset = useCallback(() => {
		posRef.current = [0, 0, 0];
		trailRef.current = [];
		prevTsRef.current = null;
		setPositionState({
			currentPosition: [0, 0, 0],
			currentOrientation: [0, 0, 0],
		});
		setTrailVersion((v) => v + 1);
	}, []);

	return {
		currentPosition: positionState.currentPosition,
		currentOrientation: positionState.currentOrientation,
		trailRef,
		trailVersion,
		reset,
	};
}
