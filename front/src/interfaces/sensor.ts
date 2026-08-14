export type Vector3 = {
	x: number;
	y: number;
	z: number;
};

export type Orientation = {
	roll: number;
	pitch: number;
	yaw: number;
};

export type SensorReading = {
	timestamp: number;
	gyro: Vector3;
	accel: Vector3;
	linear_velocity: Vector3;
	orientation: Orientation;
};

export type SensorSocketStatus = "connecting" | "open" | "closed" | "error";

export type SensorSocketSnapshot = {
	status: SensorSocketStatus;
	latest: SensorReading | null;
	history: SensorReading[];
	/** All readings flushed in the most recent batch, in chronological order.
	 *  usePositionTracker iterates this to integrate each frame individually,
	 *  preventing position jumps caused by skipped frames during render stalls. */
	lastBatch: SensorReading[];
};
