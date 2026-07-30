import { useRef, useCallback, useState, useEffect } from "react";
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

export function usePositionTracker(latest: SensorReading | null) {
	const posRef = useRef<[number, number, number]>([0, 0, 0]);
	const trailRef = useRef<TrackedPoint[]>([]);
	const prevTsRef = useRef<number | null>(null);

	const [state, setState] = useState({
		currentPosition: [0, 0, 0] as [number, number, number],
		currentOrientation: [0, 0, 0] as [number, number, number],
		trail: [] as TrackedPoint[],
	});

	useEffect(() => {
		if (!latest) return;

		const prevTs = prevTsRef.current;
		prevTsRef.current = latest.timestamp;

		if (prevTs === null) return;

		const dt = latest.timestamp - prevTs;
		if (dt <= 0 || dt > MAX_DT) return;

		const v = latest.linear_velocity;

		// Integrate velocity → position (sensor Z-up → Three.js Y-up)
		const newPos: [number, number, number] = [
			posRef.current[0] + v.x * dt * SCALE,
			posRef.current[1] + v.z * dt * SCALE, // sensor z → three y (up)
			posRef.current[2] + v.y * dt * SCALE, // sensor y → three z (forward)
		];
		posRef.current = newPos;

		const speed = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
		const a = latest.accel;
		// Subtract gravity (sensor z ≈ 9.81) to get dynamic acceleration
		const accelMag = Math.sqrt(
			a.x ** 2 + a.y ** 2 + (a.z - 9.81) ** 2,
		);

		const point: TrackedPoint = {
			position: [...newPos],
			speed,
			accelMagnitude: accelMag,
			timestamp: latest.timestamp,
		};
		trailRef.current = [...trailRef.current, point].slice(-TRAIL_LIMIT);

		setState({
			currentPosition: [...newPos],
			currentOrientation: [
				latest.orientation.pitch * DEG2RAD,
				latest.orientation.yaw * DEG2RAD,
				latest.orientation.roll * DEG2RAD,
			],
			trail: [...trailRef.current],
		});
	}, [latest]);

	const reset = useCallback(() => {
		posRef.current = [0, 0, 0];
		trailRef.current = [];
		prevTsRef.current = null;
		setState({
			currentPosition: [0, 0, 0],
			currentOrientation: [0, 0, 0],
			trail: [],
		});
	}, []);

	return { ...state, reset };
}
