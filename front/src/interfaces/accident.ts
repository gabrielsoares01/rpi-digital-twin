export type AccidentPatternType =
	| "impact_peak"
	| "velocity_drop"
	| "anomalous_orientation";

export type AccidentKinematics = {
	/** Peak dynamic acceleration magnitude in m/s² (gravity subtracted) */
	peakAccel: number;
	/** Linear speed prior to crash in m/s */
	speedBefore: number;
	/** Linear speed after crash in m/s */
	speedAfter: number;
	/** Magnitude of linear speed drop in m/s */
	speedDropDelta: number;
	/** Absolute roll angle in degrees */
	maxRoll: number;
	/** Absolute pitch angle in degrees */
	maxPitch: number;
	/** Duration vehicle stayed in abnormal orientation in seconds */
	tiltDurationSec: number;
};

export type AccidentPatternDetail = {
	type: AccidentPatternType;
	title: string;
	description: string;
	valueLabel: string;
};

export type AccidentAlert = {
	id: string;
	timestamp: number;
	severity: "high" | "critical";
	triggeredPatterns: AccidentPatternDetail[];
	kinematics: AccidentKinematics;
	status: "active" | "dismissed";
};
