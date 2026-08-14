import { memo, type RefObject, useEffect, useRef } from "react";
import * as THREE from "three";
import type { TrackedPoint } from "#/hooks/usePositionTracker";

const MAX_POINTS = 500;
// Module-level static buffers — allocated once, reused on every update (zero GC)
const posBuffer = new Float32Array(MAX_POINTS * 3);
const colBuffer = new Float32Array(MAX_POINTS * 3);

const GREEN = new THREE.Color("#22c55e");
const YELLOW = new THREE.Color("#eab308");
const RED = new THREE.Color("#ef4444");
const scratchColor = new THREE.Color();

function writeSpeedColor(
	speed: number,
	maxSpeed: number,
	target: Float32Array,
	offset: number,
) {
	const t = Math.min(speed / maxSpeed, 1);
	if (t < 0.5) {
		scratchColor.lerpColors(GREEN, YELLOW, t * 2);
	} else {
		scratchColor.lerpColors(YELLOW, RED, (t - 0.5) * 2);
	}
	target[offset] = scratchColor.r;
	target[offset + 1] = scratchColor.g;
	target[offset + 2] = scratchColor.b;
}

type Props = {
	/** Stable ref to the trail array — mutated in-place by usePositionTracker */
	trailRef: RefObject<TrackedPoint[]>;
	/** Incremented each time the trail data changes — triggers this effect */
	trailVersion: number;
	maxSpeed?: number;
};

export const TrailPath = memo(function TrailPath({
	trailRef,
	trailVersion,
	maxSpeed = 1.0,
}: Props) {
	const geomRef = useRef<THREE.BufferGeometry>(null);

	// Update geometry data on trailVersion changes (zero object allocations)
	// biome-ignore lint/correctness/useExhaustiveDependencies: stable ref pattern, trailVersion is the signal to update
	useEffect(() => {
		const geom = geomRef.current;
		const trail = trailRef.current;
		if (!geom || !trail || trail.length < 2) return;

		const len = Math.min(trail.length, MAX_POINTS);
		for (let i = 0; i < len; i++) {
			const pt = trail[i];
			const off = i * 3;
			posBuffer[off] = pt.position[0];
			posBuffer[off + 1] = pt.position[1];
			posBuffer[off + 2] = pt.position[2];
			writeSpeedColor(pt.speed, maxSpeed, colBuffer, off);
		}

		// Update geometry attributes in-place using standard BufferAttribute setters
		const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
		const colAttr = geom.getAttribute("color") as THREE.BufferAttribute;

		posAttr.needsUpdate = true;
		colAttr.needsUpdate = true;

		geom.setDrawRange(0, len);
	}, [trailVersion, maxSpeed, trailRef]);

	return (
		<line>
			<bufferGeometry ref={geomRef}>
				<bufferAttribute
					attach="attributes-position"
					args={[posBuffer, 3]}
					count={MAX_POINTS}
					itemSize={3}
				/>
				<bufferAttribute
					attach="attributes-color"
					args={[colBuffer, 3]}
					count={MAX_POINTS}
					itemSize={3}
				/>
			</bufferGeometry>
			<lineBasicMaterial vertexColors transparent opacity={0.9} />
		</line>
	);
});
