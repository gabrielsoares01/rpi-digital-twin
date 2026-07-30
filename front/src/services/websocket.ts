import { io, type Socket } from "socket.io-client";

export type SensorReading = {
	sensorId: string;
	value: number;
	unit?: string;
	timestamp: number;
};

export type SensorSocketStatus = "connecting" | "open" | "closed" | "error";

export type SensorSocketSnapshot = {
	status: SensorSocketStatus;
	latestBySensor: Map<string, SensorReading>;
	history: SensorReading[];
};

const HISTORY_LIMIT = 50;
const SENSOR_READING_EVENT = "sensor:reading";
const RECONNECTION_DELAY_MS = 1000;
const RECONNECTION_DELAY_MAX_MS = 30000;

const MOCK_SENSORS: Array<{
	sensorId: string;
	unit: string;
	base: number;
	amplitude: number;
}> = [
	{ sensorId: "temp-1", unit: "°C", base: 24, amplitude: 3 },
	{ sensorId: "humidity-1", unit: "%", base: 55, amplitude: 10 },
	{ sensorId: "pressure-1", unit: "hPa", base: 1013, amplitude: 5 },
];

function isSensorReading(data: unknown): data is SensorReading {
	if (typeof data !== "object" || data === null) return false;
	const candidate = data as Record<string, unknown>;
	return (
		typeof candidate.sensorId === "string" &&
		typeof candidate.value === "number" &&
		typeof candidate.timestamp === "number" &&
		(candidate.unit === undefined || typeof candidate.unit === "string")
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
	private latestBySensor = new Map<string, SensorReading>();
	private history: SensorReading[] = [];
	private listeners = new Set<() => void>();
	private snapshot: SensorSocketSnapshot;

	constructor(url: string) {
		this.url = url;
		this.snapshot = {
			status: this.status,
			latestBySensor: this.latestBySensor,
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
		});

		this.socket.on(SENSOR_READING_EVENT, (payload: unknown) => {
			this.handleMessage(payload);
		});

		this.socket.on("connect_error", () => {
			this.setStatus("error");
		});

		this.socket.on("disconnect", () => {
			this.setStatus("closed");
		});

		this.socket.io.on("reconnect_attempt", () => {
			this.setStatus("connecting");
		});
	}

	disconnect(): void {
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

		this.latestBySensor.set(raw.sensorId, raw);
		this.history = [...this.history, raw].slice(-HISTORY_LIMIT);
		this.notify();
	}

	private setStatus(status: SensorSocketStatus): void {
		this.status = status;
		this.notify();
	}

	private notify(): void {
		this.snapshot = {
			status: this.status,
			latestBySensor: this.latestBySensor,
			history: this.history,
		};
		for (const listener of this.listeners) listener();
	}
}

class MockSensorSocket implements SensorSocket {
	private status: SensorSocketStatus = "closed";
	private latestBySensor = new Map<string, SensorReading>();
	private history: SensorReading[] = [];
	private listeners = new Set<() => void>();
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private snapshot: SensorSocketSnapshot = {
		status: this.status,
		latestBySensor: this.latestBySensor,
		history: this.history,
	};

	connect(): void {
		this.setStatus("connecting");
		setTimeout(() => {
			this.setStatus("open");
			this.intervalId = setInterval(() => this.emitReading(), 1000);
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
		const sensor =
			MOCK_SENSORS[Math.floor(Math.random() * MOCK_SENSORS.length)];
		const reading: SensorReading = {
			sensorId: sensor.sensorId,
			value: Number(
				(sensor.base + (Math.random() - 0.5) * 2 * sensor.amplitude).toFixed(2),
			),
			unit: sensor.unit,
			timestamp: Date.now(),
		};
		this.latestBySensor.set(reading.sensorId, reading);
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
			latestBySensor: this.latestBySensor,
			history: this.history,
		};
		for (const listener of this.listeners) listener();
	}
}

let singleton: SensorSocket | null = null;

export function createSensorSocket(): SensorSocket {
	const isMock = import.meta.env.VITE_WS_MOCK === "true";
	if (isMock) return new MockSensorSocket();

	const url = import.meta.env.VITE_WS_URL ?? "http://raspberrypi.local:8765";
	return new RealSensorSocket(url);
}

export function getSensorSocket(): SensorSocket {
	if (!singleton) singleton = createSensorSocket();
	return singleton;
}
