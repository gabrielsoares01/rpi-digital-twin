import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
	OrbitControls,
	Grid,
	GizmoHelper,
	GizmoViewport,
} from "@react-three/drei";
import * as THREE from "three";
import { RobotTwin } from "#/components/RobotTwin";
import { TrailPath } from "#/components/TrailPath";
import type { TrackedPoint } from "#/hooks/usePositionTracker";

type Props = {
	currentPosition: [number, number, number];
	currentOrientation: [number, number, number];
	trail: TrackedPoint[];
	latestAccelMagnitude: number;
	followCamera: boolean;
	lockCenter: boolean;
};

function CameraController({
	target,
	follow,
}: {
	target: [number, number, number];
	follow: boolean;
}) {
	const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
	const targetVec = useRef(new THREE.Vector3());

	useFrame(() => {
		if (!controlsRef.current || !follow) return;
		targetVec.current.set(...target);
		controlsRef.current.target.lerp(targetVec.current, 0.05);
		controlsRef.current.update();
	});

	return (
		<OrbitControls
			ref={controlsRef}
			makeDefault
			enableDamping
			dampingFactor={0.05}
		/>
	);
}

export default function TwinScene({
	currentPosition,
	currentOrientation,
	trail,
	latestAccelMagnitude,
	followCamera,
	lockCenter,
}: Props) {
	const effectivePosition: [number, number, number] = lockCenter
		? [0, 0, 0]
		: currentPosition;
	const effectiveTrail = lockCenter ? [] : trail;

	return (
		<Canvas
			camera={{ position: [100, 80, 100], fov: 50, near: 0.1, far: 10000 }}
			style={{ width: "100%", height: "100%", background: "#0a0a1a" }}
		>
			{/* Lighting */}
			<ambientLight intensity={0.4} />
			<directionalLight position={[50, 100, 50]} intensity={0.8} />
			<pointLight position={[0, 50, 0]} intensity={0.3} color="#38bdf8" />

			{/* Ground grid — 10cm cells, 50cm sections, extends infinitely around robot position */}
			<Grid
				position={[effectivePosition[0], 0, effectivePosition[2]]}
				infiniteGrid
				cellSize={10}
				cellColor="#1e3a5f"
				cellThickness={0.6}
				sectionSize={50}
				sectionColor="#2563eb"
				sectionThickness={1}
				fadeDistance={2500}
				fadeStrength={1}
			/>

			{/* Robot twin */}
			<RobotTwin
				position={effectivePosition}
				rotation={currentOrientation}
				accelMagnitude={latestAccelMagnitude}
			/>

			{/* Movement trail */}
			<TrailPath trail={effectiveTrail} />

			{/* Camera */}
			<CameraController target={effectivePosition} follow={followCamera} />

			{/* Axis gizmo in corner */}
			<GizmoHelper alignment="bottom-left" margin={[80, 80]}>
				<GizmoViewport />
			</GizmoHelper>

			{/* Atmospheric fog */}
			<fog attach="fog" args={["#0a0a1a", 1000, 4000]} />
		</Canvas>
	);
}
