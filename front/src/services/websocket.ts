import { io, type Socket } from "socket.io-client";
import type {
	Orientation,
	SensorReading,
	SensorSocketSnapshot,
	SensorSocketStatus,
	SystemLogEntry,
	SystemMetrics,
	Vector3,
} from "#/interfaces/sensor";

const HISTORY_LIMIT = 50;
const SENSOR_READING_EVENT = "telemetry";
const RECONNECTION_DELAY_MS = 1000;
const RECONNECTION_DELAY_MAX_MS = 10000;
const BATCH_FLUSH_INTERVAL_MS = 100; // Buffer incoming 50Hz messages and flush to React subscribers at ~10Hz (100ms) to prevent UI/3D stuttering

function isVector3(data: unknown): data is Vector3 {
	if (typeof data !== "object" || data === null) return false;
	const candidate = data as Record<string, unknown>;
	return (
		typeof candidate.x === "number" &&
		typeof candidate.y === "number" &&
		typeof candidate.z === "number"
	);
}

function isOrientation(data: unknown): data is Orientation {
	if (typeof data !== "object" || data === null) return false;
	const candidate = data as Record<string, unknown>;
	return (
		typeof candidate.roll === "number" &&
		typeof candidate.pitch === "number" &&
		typeof candidate.yaw === "number"
	);
}

function isSensorReading(data: unknown): data is SensorReading {
	if (typeof data !== "object" || data === null) return false;
	const candidate = data as Record<string, unknown>;
	return (
		typeof candidate.timestamp === "number" &&
		isVector3(candidate.gyro) &&
		isVector3(candidate.accel) &&
		isVector3(candidate.linear_velocity) &&
		isOrientation(candidate.orientation)
	);
}

export interface SensorSocket {
	connect(): void;
	disconnect(): void;
	subscribe(listener: () => void): () => void;
	getSnapshot(): SensorSocketSnapshot;
}

class RealSensorSocket implements SensorSocket {
	private url: string;
	private socket: Socket | null = null;
	private status: SensorSocketStatus = "closed";
	private latest: SensorReading | null = null;
	private history: SensorReading[] = [];
	private metrics: SystemMetrics | null = null;
	private logs: SystemLogEntry[] = [];
	private pendingBuffer: SensorReading[] = [];

	private flushIntervalId: ReturnType<typeof setInterval> | null = null;
	private pingIntervalId: ReturnType<typeof setInterval> | null = null;
	private listeners = new Set<() => void>();
	private snapshot: SensorSocketSnapshot;

	constructor(url: string) {
		this.url = url;
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: this.history,
			metrics: this.metrics,
			logs: this.logs,
		};
	}

	connect(): void {
		this.setStatus("connecting");
		this.socket = io(this.url, {
			reconnection: true,
			reconnectionAttempts: 20,
			reconnectionDelay: RECONNECTION_DELAY_MS,
			reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
			randomizationFactor: 0.5,
		});

		this.socket.on("connect", () => {
			this.setStatus("open");
			this.startBufferFlusher();
			this.startPingInterval();
		});

		this.socket.on(SENSOR_READING_EVENT, (payload: unknown) => {
			this.handleMessage(payload);
		});

		this.socket.on("system_metrics", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				const rtt = this.metrics?.latency_rtt_ms;
				this.metrics = {
					...(payload as SystemMetrics),
					latency_rtt_ms: rtt,
				};
				this.notify();
			}
		});

		this.socket.on("system_log", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				this.logs = [payload as SystemLogEntry, ...this.logs].slice(0, 150);
				this.notify();
			}
		});

		this.socket.on("pong_latency", (sentTime: unknown) => {
			if (typeof sentTime === "number") {
				const rtt = Date.now() - sentTime;
				if (this.metrics) {
					this.metrics = { ...this.metrics, latency_rtt_ms: rtt };
				} else {
					this.metrics = {
						timestamp: Date.now() / 1000,
						cpu_usage_pct: 0.0,
						memory_usage_mb: 0.0,
						avg_latency_ms: 0.0,
						max_latency_ms: 0.0,
						throughput_fps: 0.0,
						client_count: 1,
						queue_backlog_len: 0,
						latency_rtt_ms: rtt,
					};
				}
				this.notify();
			}
		});

		this.socket.on("connect_error", () => {
			this.setStatus("error");
		});

		this.socket.on("disconnect", () => {
			this.stopBufferFlusher();
			this.stopPingInterval();
			this.setStatus("closed");
		});

		this.socket.io.on("reconnect_attempt", () => {
			this.setStatus("connecting");
		});
	}

	disconnect(): void {
		this.stopBufferFlusher();
		this.stopPingInterval();
		this.socket?.disconnect();
		this.socket = null;
		this.setStatus("closed");
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getSnapshot(): SensorSocketSnapshot {
		return this.snapshot;
	}

	private handleMessage(raw: unknown): void {
		if (!isSensorReading(raw)) {
			console.warn("[SensorSocket] Ignoring malformed reading:", raw);
			return;
		}

		// Buffer high-frequency telemetry messages
		this.pendingBuffer.push(raw);
	}

	private startBufferFlusher(): void {
		if (this.flushIntervalId) return;
		this.flushIntervalId = setInterval(() => {
			if (this.pendingBuffer.length === 0) return;

			// Flush all buffered readings accumulated during the 100ms interval in a single batch
			const batch = this.pendingBuffer;
			this.pendingBuffer = [];

			this.latest = batch[batch.length - 1];
			this.history = [...this.history, ...batch].slice(-HISTORY_LIMIT);
			this.notify();
		}, BATCH_FLUSH_INTERVAL_MS);
	}

	private stopBufferFlusher(): void {
		if (this.flushIntervalId) {
			clearInterval(this.flushIntervalId);
			this.flushIntervalId = null;
		}
		this.pendingBuffer = [];
	}

	private startPingInterval(): void {
		if (this.pingIntervalId) return;
		this.pingIntervalId = setInterval(() => {
			if (this.socket?.connected) {
				this.socket.emit("ping_latency", Date.now());
			}
		}, 2000);
	}

	private stopPingInterval(): void {
		if (this.pingIntervalId) {
			clearInterval(this.pingIntervalId);
			this.pingIntervalId = null;
		}
	}

	private setStatus(status: SensorSocketStatus): void {
		this.status = status;
		this.notify();
	}

	private notify(): void {
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: this.history,
			metrics: this.metrics,
			logs: this.logs,
		};
		for (const listener of this.listeners) listener();
	}
}

class MockSensorSocket implements SensorSocket {
	private status: SensorSocketStatus = "closed";
	private latest: SensorReading | null = null;
	private history: SensorReading[] = [];
	private metrics: SystemMetrics | null = null;
	private logs: SystemLogEntry[] = [];
	private listeners = new Set<() => void>();

	private intervalId: ReturnType<typeof setInterval> | null = null;
	private metricsIntervalId: ReturnType<typeof setInterval> | null = null;
	private snapshot: SensorSocketSnapshot;

	constructor() {
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: this.history,
			metrics: this.metrics,
			logs: this.logs,
		};
	}

	connect(): void {
		this.setStatus("connecting");
		setTimeout(() => {
			this.setStatus("open");

			// Mock telemetry readings (10Hz)
			this.intervalId = setInterval(() => this.emitReading(), 100);

			// Mock system metrics and structured logs (1Hz)
			this.emitMockMetricsAndLogs();
			this.metricsIntervalId = setInterval(
				() => this.emitMockMetricsAndLogs(),
				1000,
			);
		}, 300);
	}

	disconnect(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		if (this.metricsIntervalId) {
			clearInterval(this.metricsIntervalId);
			this.metricsIntervalId = null;
		}
		this.setStatus("closed");
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getSnapshot(): SensorSocketSnapshot {
		return this.snapshot;
	}

	private emitReading(): void {
		const jitter = () => Number((Math.random() - 0.5).toFixed(3));
		const reading: SensorReading = {
			timestamp: Date.now() / 1000,
			gyro: { x: jitter() * 0.3, y: jitter() * 0.3, z: jitter() * 0.3 },
			accel: { x: jitter() * 0.2, y: jitter() * 0.2, z: 9.81 + jitter() * 0.1 },
			linear_velocity: { x: jitter(), y: jitter(), z: jitter() * 0.1 },
			orientation: {
				roll: jitter() * 5,
				pitch: jitter() * 5,
				yaw: (Date.now() / 100) % 360,
			},
		};
		this.latest = reading;
		this.history = [...this.history, reading].slice(-HISTORY_LIMIT);
		this.notify();
	}

	private emitMockMetricsAndLogs(): void {
		// Mock CPU usage 2% - 12%, Memory 15MB - 18MB, loop latency 0.3ms - 0.9ms
		const randomVal = (min: number, max: number) =>
			Number((Math.random() * (max - min) + min).toFixed(2));

		this.metrics = {
			timestamp: Date.now() / 1000,
			cpu_usage_pct: randomVal(2, 12),
			memory_usage_mb: randomVal(15.2, 17.8),
			avg_latency_ms: randomVal(0.3, 0.9),
			max_latency_ms: randomVal(1.1, 3.5),
			throughput_fps: 50.0,
			client_count: 1,
			queue_backlog_len: 0,
			latency_rtt_ms: Math.floor(randomVal(3, 15)),
		};

		// Mock structured logs
		const mockLogMessages = [
			{
				level: "INFO",
				name: "main",
				msg: "Telemetry stream active and healthy",
			},
			{
				level: "INFO",
				name: "sensor_reader",
				msg: "I2C read successful, packet validation OK",
			},
			{
				level: "INFO",
				name: "websocket",
				msg: "Broadcasted metrics payload to all active listeners",
			},
			{
				level: "WARNING",
				name: "main",
				msg: "Temporary loop overhead fluctuation detected",
			},
		];

		if (Math.random() > 0.4) {
			const selectLog =
				mockLogMessages[Math.floor(Math.random() * mockLogMessages.length)];
			const mockLog: SystemLogEntry = {
				timestamp: new Date().toISOString(),
				level: selectLog.level,
				name: selectLog.name,
				message: selectLog.msg,
				filename:
					selectLog.name === "main" ? "main.py" : `${selectLog.name}.py`,
				lineno: Math.floor(Math.random() * 80) + 10,
				correlation_id:
					selectLog.level === "WARNING" ? undefined : "mock-session-id",
			};
			this.logs = [mockLog, ...this.logs].slice(0, 150);
		}

		this.notify();
	}

	private setStatus(status: SensorSocketStatus): void {
		this.status = status;
		this.notify();
	}

	private notify(): void {
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: this.history,
			metrics: this.metrics,
			logs: this.logs,
		};
		for (const listener of this.listeners) listener();
	}
}

let singleton: SensorSocket | null = null;

export function createSensorSocket(): SensorSocket {
	const isMock = import.meta.env.VITE_WS_MOCK === "true";
	if (isMock) return new MockSensorSocket();

	const url = import.meta.env.VITE_WS_URL ?? "http://10.42.0.1:8765";
	return new RealSensorSocket(url);
}

export function getSensorSocket(): SensorSocket {
	if (!singleton) singleton = createSensorSocket();
	return singleton;
}
