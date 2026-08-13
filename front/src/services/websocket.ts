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
const BATCH_FLUSH_INTERVAL_MS = 100; // Buffer incoming 50Hz messages and flush to React subscribers at ~10Hz (100ms) to prevent UI/3D stuttering
const MOCK_GENERATION_INTERVAL_MS = 20; // 50Hz (20ms) generation frequency matching backend LOOP_FREQUENCY_HZ = 50

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
	subscribeStatus(listener: () => void): () => void;
	getSnapshot(): SensorSocketSnapshot;
	getStatus(): SensorSocketStatus;
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
	private statusListeners = new Set<() => void>();
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

	subscribeStatus(listener: () => void): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	getSnapshot(): SensorSocketSnapshot {
		return this.snapshot;
	}

	getStatus(): SensorSocketStatus {
		return this.status;
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
		if (this.status === status) return;
		this.status = status;
		this.notifyStatus();
		this.notify();
	}

	private notifyStatus(): void {
		for (const listener of this.statusListeners) listener();
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
	private pendingBuffer: SensorReading[] = [];
	private listeners = new Set<() => void>();
	private statusListeners = new Set<() => void>();
	private genIntervalId: ReturnType<typeof setInterval> | null = null;
	private flushIntervalId: ReturnType<typeof setInterval> | null = null;
	private snapshot: SensorSocketSnapshot = {
		status: this.status,
		latest: this.latest,
		history: this.history,
	};

	connect(): void {
		if (this.status === "open" || this.status === "connecting") return;
		this.setStatus("connecting");
		setTimeout(() => {
			this.setStatus("open");
			this.startGenerators();
		}, 300);
	}

	disconnect(): void {
		this.stopGenerators();
		this.setStatus("closed");
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	subscribeStatus(listener: () => void): () => void {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	}

	getSnapshot(): SensorSocketSnapshot {
		return this.snapshot;
	}

	getStatus(): SensorSocketStatus {
		return this.status;
	}

	private startGenerators(): void {
		if (this.genIntervalId || this.flushIntervalId) return;
		// 50Hz generation interval (every 20ms) matching backend frequency
		this.genIntervalId = setInterval(
			() => this.generateMockFrame(),
			MOCK_GENERATION_INTERVAL_MS,
		);
		// 10Hz flush interval (every 100ms) matching RealSensorSocket buffer flusher
		this.flushIntervalId = setInterval(
			() => this.flushBuffer(),
			BATCH_FLUSH_INTERVAL_MS,
		);
	}

	private stopGenerators(): void {
		if (this.genIntervalId) {
			clearInterval(this.genIntervalId);
			this.genIntervalId = null;
		}
		if (this.flushIntervalId) {
			clearInterval(this.flushIntervalId);
			this.flushIntervalId = null;
		}
		this.pendingBuffer = [];
	}

	private generateMockFrame(): void {
		const now = Date.now() / 1000;
		const jitter = (range = 0.1) =>
			Number(((Math.random() - 0.5) * range).toFixed(3));
		const timeSec = now % 3600;

		const reading: SensorReading = {
			timestamp: Number(now.toFixed(4)),
			gyro: {
				x: Number((Math.sin(timeSec * 2) * 0.5 + jitter(0.05)).toFixed(3)),
				y: Number((Math.cos(timeSec * 2) * 0.5 + jitter(0.05)).toFixed(3)),
				z: Number((Math.sin(timeSec) * 0.2 + jitter(0.02)).toFixed(3)),
			},
			accel: {
				x: Number((Math.sin(timeSec * 3) * 0.4 + jitter(0.05)).toFixed(3)),
				y: Number((Math.cos(timeSec * 3) * 0.4 + jitter(0.05)).toFixed(3)),
				z: Number(
					(9.81 + Math.sin(timeSec * 5) * 0.15 + jitter(0.03)).toFixed(3),
				),
			},
			linear_velocity: {
				x: Number((Math.cos(timeSec) * 0.8 + jitter(0.05)).toFixed(3)),
				y: Number((Math.sin(timeSec) * 0.8 + jitter(0.05)).toFixed(3)),
				z: Number(jitter(0.02).toFixed(3)),
			},
			orientation: {
				roll: Number((Math.sin(timeSec) * 10 + jitter(0.2)).toFixed(3)),
				pitch: Number((Math.cos(timeSec) * 10 + jitter(0.2)).toFixed(3)),
				yaw: Number(((timeSec * 25) % 360).toFixed(3)),
			},
		};
		this.pendingBuffer.push(reading);
	}

	private flushBuffer(): void {
		if (this.pendingBuffer.length === 0) return;

		const batch = this.pendingBuffer;
		this.pendingBuffer = [];

		this.latest = batch[batch.length - 1];
		this.history = [...this.history, ...batch].slice(-HISTORY_LIMIT);
		this.notify();
	}

	private setStatus(status: SensorSocketStatus): void {
		if (this.status === status) return;
		this.status = status;
		this.notifyStatus();
		this.notify();
	}

	private notifyStatus(): void {
		for (const listener of this.statusListeners) listener();
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

export function isMockEnabled(): boolean {
	const raw = import.meta.env.VITE_WS_MOCK;
	return raw === true || String(raw).toLowerCase() === "true";
}

export function createSensorSocket(): SensorSocket {
	if (isMockEnabled()) return new MockSensorSocket();

	const url = import.meta.env.VITE_WS_URL ?? "http://10.42.0.1:8765";
	return new RealSensorSocket(url);
}

export function getSensorSocket(): SensorSocket {
	const wantMock = isMockEnabled();
	if (singleton) {
		const isCurrentlyMock = singleton instanceof MockSensorSocket;
		if (wantMock !== isCurrentlyMock) {
			singleton.disconnect();
			singleton = null;
		}
	}
	if (!singleton) {
		singleton = createSensorSocket();
	}
	return singleton;
}
