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

/**
 * Pre-allocated ring buffer to avoid any array spread/concat in the hot flush path.
 * push() overwrites the oldest slot when full.
 * toArray() materializes a chronological view — called only once per flush, not per subscriber.
 */
class RingBuffer<T> {
	private buf: Array<T | undefined>;
	private head = 0; // next write position
	private _size = 0;
	readonly capacity: number;

	constructor(capacity: number) {
		this.capacity = capacity;
		this.buf = new Array<T | undefined>(capacity);
	}

	push(item: T): void {
		this.buf[this.head] = item;
		this.head = (this.head + 1) % this.capacity;
		if (this._size < this.capacity) this._size++;
	}

	pushBatch(items: T[]): void {
		for (let i = 0; i < items.length; i++) this.push(items[i]);
	}

	get size(): number {
		return this._size;
	}

	/** Returns elements in insertion order (oldest first). */
	toArray(): T[] {
		if (this._size === 0) return [];
		const out = new Array<T>(this._size);
		if (this._size < this.capacity) {
			for (let i = 0; i < this._size; i++) out[i] = this.buf[i] as T;
		} else {
			// Buffer full — oldest element is at this.head
			for (let i = 0; i < this._size; i++) {
				out[i] = this.buf[(this.head + i) % this.capacity] as T;
			}
		}
		return out;
	}

	clear(): void {
		this.head = 0;
		this._size = 0;
	}
}

class RealSensorSocket implements SensorSocket {
	private url: string;
	private socket: Socket | null = null;
	private status: SensorSocketStatus = "closed";
	private latest: SensorReading | null = null;
	private historyRing = new RingBuffer<SensorReading>(HISTORY_LIMIT);
	private pendingBuffer: SensorReading[] = [];
	private flushIntervalId: ReturnType<typeof setInterval> | null = null;
	private listeners = new Set<() => void>();
	private statusListeners = new Set<() => void>();
	private snapshot: SensorSocketSnapshot;
	private connectionCount = 0;

	constructor(url: string) {
		this.url = url;
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: [],
			lastBatch: [],
		};
	}

	connect(): void {
		this.connectionCount++;
		if (this.socket || this.status === "connecting" || this.status === "open") {
			return;
		}

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
		this.connectionCount = Math.max(0, this.connectionCount - 1);
		if (this.connectionCount > 0) return;

		this.stopBufferFlusher();
		this.socket?.disconnect();
		this.socket = null;
		this.setStatus("closed");
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	subscribeStatus = (listener: () => void): (() => void) => {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	};

	getSnapshot = (): SensorSocketSnapshot => {
		return this.snapshot;
	};

	getStatus = (): SensorSocketStatus => {
		return this.status;
	};

	private handleMessage(raw: unknown): void {
		if (!Array.isArray(raw)) {
			console.warn("[SensorSocket] Ignoring non-array telemetry payload:", raw);
			return;
		}

		for (let i = 0; i < raw.length; i++) {
			const item = raw[i];
			if (isSensorReading(item)) {
				this.pendingBuffer.push(item);
			} else {
				console.warn(
					"[SensorSocket] Ignoring malformed reading in batch:",
					item,
				);
			}
		}
	}

	private startBufferFlusher(): void {
		if (this.flushIntervalId) return;
		this.flushIntervalId = setInterval(() => {
			if (this.pendingBuffer.length === 0) return;

			// Snapshot the batch BEFORE clearing (used by usePositionTracker for
			// per-frame integration to avoid position jumps during render stalls)
			const flushedBatch = this.pendingBuffer.slice();
			this.historyRing.pushBatch(this.pendingBuffer);
			this.latest = this.pendingBuffer[this.pendingBuffer.length - 1];
			this.pendingBuffer.length = 0;

			this.notify(flushedBatch);
		}, BATCH_FLUSH_INTERVAL_MS);
	}

	private stopBufferFlusher(): void {
		if (this.flushIntervalId) {
			clearInterval(this.flushIntervalId);
			this.flushIntervalId = null;
		}
		this.pendingBuffer.length = 0;
	}

	private setStatus(status: SensorSocketStatus): void {
		if (this.status === status) return;
		this.status = status;
		this.notifyStatus();
		this.notify([]);
	}

	private notifyStatus(): void {
		for (const listener of this.statusListeners) listener();
	}

	private notify(lastBatch: SensorReading[] = []): void {
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: this.historyRing.toArray(),
			lastBatch,
		};
		for (const listener of this.listeners) listener();
	}
}

class MockSensorSocket implements SensorSocket {
	private status: SensorSocketStatus = "closed";
	private latest: SensorReading | null = null;
	private historyRing = new RingBuffer<SensorReading>(HISTORY_LIMIT);
	private listeners = new Set<() => void>();
	private statusListeners = new Set<() => void>();
	private flushIntervalId: ReturnType<typeof setInterval> | null = null;
	private snapshot: SensorSocketSnapshot = {
		status: this.status,
		latest: null,
		history: [],
		lastBatch: [],
	};
	private connectionCount = 0;

	connect(): void {
		this.connectionCount++;
		if (this.status === "open" || this.status === "connecting") return;

		this.setStatus("connecting");
		setTimeout(() => {
			if (this.connectionCount === 0) return;
			this.setStatus("open");
			this.startGenerators();
		}, 300);
	}

	disconnect(): void {
		this.connectionCount = Math.max(0, this.connectionCount - 1);
		if (this.connectionCount > 0) return;

		this.stopGenerators();
		this.setStatus("closed");
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	subscribeStatus = (listener: () => void): (() => void) => {
		this.statusListeners.add(listener);
		return () => this.statusListeners.delete(listener);
	};

	getSnapshot = (): SensorSocketSnapshot => {
		return this.snapshot;
	};

	getStatus = (): SensorSocketStatus => {
		return this.status;
	};

	private startGenerators(): void {
		if (this.flushIntervalId) return;
		// 10Hz flush interval (every 100ms) matching RealSensorSocket buffer flusher.
		// Generates and flushes batches directly to optimize CPU.
		this.flushIntervalId = setInterval(
			() => this.flushBuffer(),
			BATCH_FLUSH_INTERVAL_MS,
		);
	}

	private stopGenerators(): void {
		if (this.flushIntervalId) {
			clearInterval(this.flushIntervalId);
			this.flushIntervalId = null;
		}
		this.historyRing.clear();
	}

	private flushBuffer(): void {
		const now = Date.now() / 1000;
		const batch: SensorReading[] = [];
		// Generate 5 frames representing the last 100ms (each 20ms apart) in order
		for (let i = 4; i >= 0; i--) {
			const frameTime = now - i * 0.02; // 20ms intervals (50Hz)
			const jitter = (range = 0.1) =>
				Number(((Math.random() - 0.5) * range).toFixed(3));
			const timeSec = frameTime % 3600;

			const reading: SensorReading = {
				timestamp: Number(frameTime.toFixed(4)),
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
			batch.push(reading);
		}

		this.historyRing.pushBatch(batch);
		this.latest = batch[batch.length - 1];

		this.notify(batch);
	}

	private setStatus(status: SensorSocketStatus): void {
		if (this.status === status) return;
		this.status = status;
		this.notifyStatus();
		this.notify([]);
	}

	private notifyStatus(): void {
		for (const listener of this.statusListeners) listener();
	}

	private notify(lastBatch: SensorReading[] = []): void {
		this.snapshot = {
			status: this.status,
			latest: this.latest,
			history: this.historyRing.toArray(),
			lastBatch,
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
