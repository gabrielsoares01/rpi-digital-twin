import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { TrackedPoint } from "#/hooks/usePositionTracker";

const GREEN = new THREE.Color("#22c55e");
const YELLOW = new THREE.Color("#eab308");
const RED = new THREE.Color("#ef4444");

function speedToColor(
	speed: number,
	maxSpeed: number,
): [number, number, number] {
	const t = Math.min(speed / maxSpeed, 1);
	const color = new THREE.Color();
	if (t < 0.5) {
		color.lerpColors(GREEN, YELLOW, t * 2);
	} else {
		color.lerpColors(YELLOW, RED, (t - 0.5) * 2);
	}
	return [color.r, color.g, color.b];
}

type Props = {
	trail: TrackedPoint[];
	maxSpeed?: number;
};

export function TrailPath({ trail, maxSpeed = 1.0 }: Props) {
	const { points, colors } = useMemo(() => {
		const pts = trail.map(
			(p) => p.position as [number, number, number],
		);
		const cols = trail.map((p) => speedToColor(p.speed, maxSpeed));
		return { points: pts, colors: cols };
	}, [trail, maxSpeed]);

	if (points.length < 2) return null;

	return <Line points={points} vertexColors={colors} lineWidth={3} />;
}
