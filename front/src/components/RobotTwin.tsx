import { Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

type Props = {
	position: [number, number, number];
	rotation: [number, number, number];
	accelMagnitude: number;
};

const LOW_COLOR = new THREE.Color("#1e40af");
const HIGH_COLOR = new THREE.Color("#ef4444");
const EDGE_COLOR = "#38bdf8";
const BOX_HEIGHT = 7;

export const RobotTwin = memo(function RobotTwin({
	position,
	rotation,
	accelMagnitude,
}: Props) {
	const meshRef = useRef<THREE.Mesh>(null);
	const targetPos = useRef(new THREE.Vector3());
	const targetQuat = useRef(new THREE.Quaternion());
	const tempEuler = useRef(new THREE.Euler());

	// Smooth interpolation via animation frame
	useFrame(() => {
		if (!meshRef.current) return;

		// Offset Y up by half box height so the box sits ON the grid
		targetPos.current.set(
			position[0],
			position[1] + BOX_HEIGHT / 2,
			position[2],
		);
		tempEuler.current.set(rotation[0], rotation[1], rotation[2], "YXZ");
		targetQuat.current.setFromEuler(tempEuler.current);

		meshRef.current.position.lerp(targetPos.current, 0.15);
		meshRef.current.quaternion.slerp(targetQuat.current, 0.15);
	});

	const glowIntensity = Math.min(accelMagnitude / 2, 1);

	const emissiveColor = useMemo(() => {
		return new THREE.Color().lerpColors(LOW_COLOR, HIGH_COLOR, glowIntensity);
	}, [glowIntensity]);

	return (
		<mesh ref={meshRef}>
			<boxGeometry args={[20, BOX_HEIGHT, 20]} />
			<meshStandardMaterial
				color="#1e293b"
				transparent
				opacity={0.7}
				emissive={emissiveColor}
				emissiveIntensity={0.4 + glowIntensity * 0.6}
			/>
			<Edges color={EDGE_COLOR} threshold={15} />
		</mesh>
	);
});
