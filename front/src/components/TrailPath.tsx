import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { TrackedPoint } from "#/hooks/usePositionTracker";

const GREEN = new THREE.Color("#22c55e");
const YELLOW = new THREE.Color("#eab308");
const RED = new THREE.Color("#ef4444");
// Reused across calls to avoid allocating a THREE.Color per trail point:
// with a 500-point trail refreshed at 10Hz that was ~5000 allocations/sec,
// which was frequent enough to cause periodic GC-related frame stutter.
const scratchColor = new THREE.Color();

function speedToColor(
	speed: number,
	maxSpeed: number,
): [number, number, number] {
	const t = Math.min(speed / maxSpeed, 1);
	if (t < 0.5) {
		scratchColor.lerpColors(GREEN, YELLOW, t * 2);
	} else {
		scratchColor.lerpColors(YELLOW, RED, (t - 0.5) * 2);
	}
	return [scratchColor.r, scratchColor.g, scratchColor.b];
}

type Props = {
	trail: TrackedPoint[];
	maxSpeed?: number;
};

export function TrailPath({ trail, maxSpeed = 1.0 }: Props) {
	const { points, colors } = useMemo(() => {
		const pts = trail.map((p) => p.position as [number, number, number]);
		const cols = trail.map((p) => speedToColor(p.speed, maxSpeed));
		return { points: pts, colors: cols };
	}, [trail, maxSpeed]);

	if (points.length < 2) return null;

	return <Line points={points} vertexColors={colors} lineWidth={3} />;
}
