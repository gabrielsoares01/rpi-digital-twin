import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SensorReading, SensorSocketSnapshot } from "#/interfaces/sensor";
import { getSensorSocket } from "#/services/websocket";

const EMPTY_HISTORY: SensorReading[] = [];
const EMPTY_BATCH: SensorReading[] = [];

const SERVER_SNAPSHOT: SensorSocketSnapshot = {
	status: "closed",
	latest: null,
	history: EMPTY_HISTORY,
	lastBatch: EMPTY_BATCH,
};

const getClosedStatus = () => "closed" as const;
const getNull = () => null;
const getEmptyHistory = () => EMPTY_HISTORY;
const getEmptyBatch = () => EMPTY_BATCH;
const getCachedServerSnapshot = () => SERVER_SNAPSHOT;

export function useSensorStatus() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribeStatus,
		socket.getStatus,
		getClosedStatus,
	);
}

export function useLatestTelemetry() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe,
		() => socket.getSnapshot().latest,
		getNull,
	);
}

export function useLatestBatch() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe,
		() => socket.getSnapshot().lastBatch,
		getEmptyBatch,
	);
}

export function useSensorHistory() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe,
		() => socket.getSnapshot().history,
		getEmptyHistory,
	);
}

/**
 * Like useSensorHistory but throttles React re-renders to at most `hz` times per second.
 * Prevents Recharts ResponsiveContainer from triggering sync reflows on every 10Hz flush.
 */
export function useThrottledSensorHistory(hz = 4): SensorReading[] {
	const socket = getSensorSocket();
	const intervalMs = 1000 / hz;
	const lastFlushRef = useRef(0);
	const [history, setHistory] = useState<SensorReading[]>(
		() => socket.getSnapshot().history,
	);

	useEffect(() => {
		const unsub = socket.subscribe(() => {
			const now = Date.now();
			if (now - lastFlushRef.current < intervalMs) return;
			lastFlushRef.current = now;
			setHistory(socket.getSnapshot().history);
		});
		return unsub;
	}, [socket, intervalMs]);

	return history;
}

export function useSensorSocket() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe,
		socket.getSnapshot,
		getCachedServerSnapshot,
	);
}
