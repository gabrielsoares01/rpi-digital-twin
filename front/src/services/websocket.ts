import { io, type Socket } from "socket.io-client";
import type {
	Orientation,
	SensorReading,
	SensorSocketSnapshot,
	SensorSocketStatus,
	Vector3,
} from "#/interfaces/sensor";

const HISTORY_LIMIT = 50;
const SENSOR_READING_EVENT = "telemetry";
const RECONNECTION_DELAY_MS = 1000;
const RECONNECTION_DELAY_MAX_MS = 30000;
const BATCH_FLUSH_INTERVAL_MS = 50; // Buffer incoming 50Hz messages and flush to React subscribers at ~20Hz (50ms) to prevent UI/3D stuttering

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
	private pendingBuffer: SensorReading[] = [];
	private flushIntervalId: ReturnType<typeof setInterval> | null = null;
	private listeners = new Set<() => void>();
	private snapshot: SensorSocketSnapshot;

	constructor(url: string) {
		this.url = url;
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: this.history,
		};
	}

	connect(): void {
		this.setStatus("connecting");
		this.socket = io(this.url, {
			reconnectionDelay: RECONNECTION_DELAY_MS,
			reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
		});

		this.socket.on("connect", () => {
			this.setStatus("open");
			this.startBufferFlusher();
		});

		this.socket.on(SENSOR_READING_EVENT, (payload: unknown) => {
			this.handleMessage(payload);
		});

		this.socket.on("connect_error", () => {
			this.setStatus("error");
		});

		this.socket.on("disconnect", () => {
			this.stopBufferFlusher();
			this.setStatus("closed");
		});

		this.socket.io.on("reconnect_attempt", () => {
			this.setStatus("connecting");
		});
	}

	disconnect(): void {
		this.stopBufferFlusher();
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

			// Flush all buffered readings accumulated during the 50ms interval in a single batch
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

	private setStatus(status: SensorSocketStatus): void {
		this.status = status;
		this.notify();
	}

	private notify(): void {
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: this.history,
		};
		for (const listener of this.listeners) listener();
	}
}

class MockSensorSocket implements SensorSocket {
	private status: SensorSocketStatus = "closed";
	private latest: SensorReading | null = null;
	private history: SensorReading[] = [];
	private listeners = new Set<() => void>();
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private snapshot: SensorSocketSnapshot = {
		status: this.status,
		latest: this.latest,
		history: this.history,
	};

	connect(): void {
		this.setStatus("connecting");
		setTimeout(() => {
			this.setStatus("open");
			this.intervalId = setInterval(() => this.emitReading(), 100);
		}, 300);
	}

	disconnect(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
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

	private setStatus(status: SensorSocketStatus): void {
		this.status = status;
		this.notify();
	}

	private notify(): void {
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: this.history,
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
