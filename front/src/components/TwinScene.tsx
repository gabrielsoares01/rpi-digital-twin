import {
	GizmoHelper,
	GizmoViewport,
	Grid,
	OrbitControls,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { memo, type RefObject, useRef } from "react";
import * as THREE from "three";
import { RobotTwin } from "#/components/RobotTwin";
import { TrailPath } from "#/components/TrailPath";
import type { TrackedPoint } from "#/hooks/usePositionTracker";

// Stable empty trail ref used when lockCenter hides the trail — never recreated
const EMPTY_TRAIL_REF: RefObject<TrackedPoint[]> = { current: [] };

type Props = {
	currentPosition: [number, number, number];
	currentOrientation: [number, number, number];
	/** Stable ref to the trail array — mutated in-place by usePositionTracker */
	trailRef: RefObject<TrackedPoint[]>;
	/** Bumped on every new trail point — triggers TrailPath GPU buffer update */
	trailVersion: number;
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

const TwinScene = memo(function TwinScene({
	currentPosition,
	currentOrientation,
	trailRef,
	trailVersion,
	latestAccelMagnitude,
	followCamera,
	lockCenter,
}: Props) {
	const effectivePosition: [number, number, number] = lockCenter
		? [0, 0, 0]
		: currentPosition;
	// Use stable EMPTY_TRAIL_REF when locked — avoids creating new array each render
	const effectiveTrailRef = lockCenter ? EMPTY_TRAIL_REF : trailRef;
	const effectiveTrailVersion = lockCenter ? 0 : trailVersion;

	// Distance from origin [0,0]
	const distFromOrigin = Math.hypot(effectivePosition[0], effectivePosition[2]);
	// Grid starts with 1000cm (10m) radius and grows in 1000cm steps whenever robot nears the border
	const gridRadius = Math.max(
		1000,
		Math.ceil((distFromOrigin + 500) / 1000) * 1000,
	);

	return (
		<Canvas
			camera={{ position: [100, 80, 100], fov: 50, near: 0.1, far: 20000 }}
			style={{ width: "100%", height: "100%", background: "#0a0a1a" }}
		>
			{/* Lighting */}
			<ambientLight intensity={0.4} />
			<directionalLight position={[50, 100, 50]} intensity={0.8} />
			<pointLight position={[0, 50, 0]} intensity={0.3} color="#38bdf8" />

			{/* Ground grid — Fixed at world origin [0,0,0], grows when robot crosses border */}
			<Grid
				position={[0, 0, 0]}
				infiniteGrid
				cellSize={10}
				cellColor="#1e3a5f"
				cellThickness={0.6}
				sectionSize={50}
				sectionColor="#2563eb"
				sectionThickness={1}
				fadeDistance={gridRadius}
				fadeStrength={1}
			/>

			{/* Robot twin */}
			<RobotTwin
				position={effectivePosition}
				rotation={currentOrientation}
				accelMagnitude={latestAccelMagnitude}
			/>

			{/* Movement trail */}
			<TrailPath
				trailRef={effectiveTrailRef}
				trailVersion={effectiveTrailVersion}
			/>

			{/* Camera */}
			<CameraController target={effectivePosition} follow={followCamera} />

			{/* Axis gizmo in corner */}
			<GizmoHelper alignment="bottom-left" margin={[80, 80]}>
				<GizmoViewport />
			</GizmoHelper>

			{/* Atmospheric fog */}
			<fog
				attach="fog"
				args={["#0a0a1a", gridRadius * 0.8, gridRadius * 2.5]}
			/>
		</Canvas>
	);
});

export default TwinScene;
