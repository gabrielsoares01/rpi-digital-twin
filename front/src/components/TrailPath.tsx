import { Line } from "@react-three/drei";
import { memo, type RefObject, useMemo } from "react";
import * as THREE from "three";
import type { TrackedPoint } from "#/hooks/usePositionTracker";

const GREEN = new THREE.Color("#22c55e");
const YELLOW = new THREE.Color("#eab308");
const RED = new THREE.Color("#ef4444");
// Reused scratch color — avoids allocating a new THREE.Color per trail point
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
	/** Stable ref to the trail array — mutated in-place by usePositionTracker */
	trailRef: RefObject<TrackedPoint[]>;
	/** Bumped each time trail data changes — used as the useMemo dependency signal */
	trailVersion: number;
	maxSpeed?: number;
};

export const TrailPath = memo(function TrailPath({
	trailRef,
	trailVersion,
	maxSpeed = 1.0,
}: Props) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: stable ref pattern — trailVersion is the signal
	const { points, colors } = useMemo(() => {
		const trail = trailRef.current;
		if (!trail || trail.length < 2) return { points: [], colors: [] };
		const pts = trail.map((p) => p.position as [number, number, number]);
		const cols = trail.map((p) => speedToColor(p.speed, maxSpeed));
		return { points: pts, colors: cols };
	}, [trailVersion, maxSpeed]);

	if (points.length < 2) return null;

	return (
		<Line
			points={points}
			vertexColors={colors}
			lineWidth={3}
			transparent
			opacity={0.9}
		/>
	);
});
