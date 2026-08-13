import { useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { TrackedPoint } from "#/hooks/usePositionTracker";

const MAX_POINTS = 500;
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
	trail: TrackedPoint[];
	maxSpeed?: number;
};

export const TrailPath = memo(function TrailPath({
	trail,
	maxSpeed = 1.0,
}: Props) {
	const { size } = useThree();

	const { geometry, material, lineMesh } = useMemo(() => {
		const geom = new LineGeometry();
		const mat = new LineMaterial({
			linewidth: 3,
			vertexColors: true,
			transparent: true,
			opacity: 0.9,
		});
		const mesh = new Line2(geom, mat);
		mesh.frustumCulled = false;
		return { geometry: geom, material: mat, lineMesh: mesh };
	}, []);

	useEffect(() => {
		material.resolution.set(size.width, size.height);
	}, [size.width, size.height, material]);

	useEffect(() => {
		if (!trail || trail.length < 2) {
			lineMesh.visible = false;
			return;
		}

		const len = Math.min(trail.length, MAX_POINTS);
		for (let i = 0; i < len; i++) {
			const pt = trail[i];
			const off = i * 3;
			posBuffer[off] = pt.position[0];
			posBuffer[off + 1] = pt.position[1];
			posBuffer[off + 2] = pt.position[2];
			writeSpeedColor(pt.speed, maxSpeed, colBuffer, off);
		}

		const posSub = posBuffer.subarray(0, len * 3);
		const colSub = colBuffer.subarray(0, len * 3);

		geometry.setPositions(posSub);
		geometry.setColors(colSub);
		lineMesh.computeLineDistances();
		lineMesh.visible = true;
	}, [trail, maxSpeed, geometry, lineMesh]);

	useEffect(() => {
		return () => {
			geometry.dispose();
			material.dispose();
		};
	}, [geometry, material]);

	return <primitive object={lineMesh} />;
});
