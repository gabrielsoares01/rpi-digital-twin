import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SensorReading } from "#/interfaces/sensor";

type Handler = (...args: unknown[]) => void;

function createFakeSocket() {
	const handlers = new Map<string, Handler>();
	const ioHandlers = new Map<string, Handler>();

	return {
		on: vi.fn((event: string, cb: Handler) => handlers.set(event, cb)),
		disconnect: vi.fn(),
		io: {
			on: vi.fn((event: string, cb: Handler) => ioHandlers.set(event, cb)),
		},
		__trigger: (event: string, ...args: unknown[]) =>
			handlers.get(event)?.(...args),
		__triggerIo: (event: string, ...args: unknown[]) =>
			ioHandlers.get(event)?.(...args),
	};
}

const ioMock = vi.fn();

vi.mock("socket.io-client", () => ({
	io: (...args: unknown[]) => ioMock(...args),
}));

function validReading(overrides: Partial<SensorReading> = {}): SensorReading {
	return {
		timestamp: 1,
		gyro: { x: 0, y: 0, z: 0 },
		accel: { x: 0, y: 0, z: 9.81 },
		linear_velocity: { x: 0, y: 0, z: 0 },
		orientation: { roll: 0, pitch: 0, yaw: 0 },
		...overrides,
	};
}

describe("RealSensorSocket (via createSensorSocket)", () => {
	let fakeSocket: ReturnType<typeof createFakeSocket>;

	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		vi.stubEnv("VITE_WS_MOCK", "false");
		vi.stubEnv("VITE_WS_URL", "http://test-host:1234");
		fakeSocket = createFakeSocket();
		ioMock.mockReturnValue(fakeSocket);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
		vi.clearAllMocks();
	});

	async function makeSocket() {
		const { createSensorSocket } = await import("./websocket");
		return createSensorSocket();
	}

	it("starts in 'closed' status and moves to 'connecting' on connect()", async () => {
		const socket = await makeSocket();
		expect(socket.getSnapshot().status).toBe("closed");

		socket.connect();

		expect(socket.getSnapshot().status).toBe("connecting");
		expect(ioMock).toHaveBeenCalledWith(
			"http://test-host:1234",
			expect.any(Object),
		);
	});

	it("moves to 'open' once the underlying socket connects", async () => {
		const socket = await makeSocket();
		socket.connect();

		fakeSocket.__trigger("connect");

		expect(socket.getSnapshot().status).toBe("open");
	});

	it("moves to 'error' on connect_error", async () => {
		const socket = await makeSocket();
		socket.connect();

		fakeSocket.__trigger("connect_error");

		expect(socket.getSnapshot().status).toBe("error");
	});

	it("drops malformed telemetry payloads", async () => {
		const socket = await makeSocket();
		socket.connect();
		fakeSocket.__trigger("connect");

		fakeSocket.__trigger("telemetry", { garbage: true });
		vi.advanceTimersByTime(100);

		expect(socket.getSnapshot().latest).toBeNull();
		expect(socket.getSnapshot().history).toEqual([]);
	});

	it("buffers valid telemetry and flushes it to subscribers on the flush interval", async () => {
		const socket = await makeSocket();
		const listener = vi.fn();
		socket.subscribe(listener);
		socket.connect();
		fakeSocket.__trigger("connect");
		listener.mockClear();

		const reading = validReading({ timestamp: 42 });
		fakeSocket.__trigger("telemetry", reading);

		// Not flushed yet: still buffered.
		expect(socket.getSnapshot().latest).toBeNull();

		vi.advanceTimersByTime(100);

		expect(socket.getSnapshot().latest).toEqual(reading);
		expect(socket.getSnapshot().history).toEqual([reading]);
		expect(listener).toHaveBeenCalled();
	});

	it("caps history at 50 readings", async () => {
		const socket = await makeSocket();
		socket.connect();
		fakeSocket.__trigger("connect");

		for (let i = 0; i < 60; i++) {
			fakeSocket.__trigger("telemetry", validReading({ timestamp: i }));
			vi.advanceTimersByTime(100);
		}

		const { history, latest } = socket.getSnapshot();
		expect(history).toHaveLength(50);
		expect(latest?.timestamp).toBe(59);
		expect(history[0].timestamp).toBe(10);
	});

	it("stops flushing after disconnect event and resets to 'closed'", async () => {
		const socket = await makeSocket();
		socket.connect();
		fakeSocket.__trigger("connect");

		fakeSocket.__trigger("disconnect");
		expect(socket.getSnapshot().status).toBe("closed");

		// A telemetry frame arriving after disconnect should not be flushed anymore.
		fakeSocket.__trigger("telemetry", validReading());
		vi.advanceTimersByTime(500);

		expect(socket.getSnapshot().latest).toBeNull();
	});

	it("disconnect() tears down the socket and clears status", async () => {
		const socket = await makeSocket();
		socket.connect();
		fakeSocket.__trigger("connect");

		socket.disconnect();

		expect(fakeSocket.disconnect).toHaveBeenCalled();
		expect(socket.getSnapshot().status).toBe("closed");
	});

	it("reconnect_attempt sets status back to 'connecting'", async () => {
		const socket = await makeSocket();
		socket.connect();
		fakeSocket.__trigger("connect");

		fakeSocket.__triggerIo("reconnect_attempt");

		expect(socket.getSnapshot().status).toBe("connecting");
	});

	it("unsubscribe stops future notifications", async () => {
		const socket = await makeSocket();
		const listener = vi.fn();
		const unsubscribe = socket.subscribe(listener);
		unsubscribe();

		socket.connect();
		fakeSocket.__trigger("connect");

		expect(listener).not.toHaveBeenCalled();
	});
});
