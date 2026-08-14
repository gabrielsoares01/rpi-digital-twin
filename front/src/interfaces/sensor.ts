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

export type SystemMetrics = {
	timestamp: number;
	cpu_usage_pct: number;
	memory_usage_mb: number;
	avg_latency_ms: number;
	max_latency_ms: number;
	throughput_fps: number;
	client_count: number;
	queue_backlog_len: number;
	latency_rtt_ms?: number;
};

export type SystemLogEntry = {
	timestamp: string;
	level: string;
	name: string;
	message: string;
	filename: string;
	lineno: number;
	correlation_id?: string;
};

export type SensorSocketSnapshot = {
	status: SensorSocketStatus;
	latest: SensorReading | null;
	history: SensorReading[];
	metrics: SystemMetrics | null;
	logs: SystemLogEntry[];
	/** All readings flushed in the most recent batch, in chronological order.
	 *  usePositionTracker iterates this to integrate each frame individually,
	 *  preventing position jumps caused by skipped frames during render stalls. */
	lastBatch: SensorReading[];
};
