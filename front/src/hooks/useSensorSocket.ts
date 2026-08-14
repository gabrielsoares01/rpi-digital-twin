import { useSyncExternalStore } from "react";
import type {
	SensorReading,
	SensorSocketSnapshot,
	SystemLogEntry,
} from "#/interfaces/sensor";
import { getSensorSocket } from "#/services/websocket";

const EMPTY_HISTORY: SensorReading[] = [];
const EMPTY_BATCH: SensorReading[] = [];
const EMPTY_LOGS: SystemLogEntry[] = [];

const SERVER_SNAPSHOT: SensorSocketSnapshot = {
	status: "closed",
	latest: null,
	history: EMPTY_HISTORY,
	lastBatch: EMPTY_BATCH,
	metrics: null,
	logs: EMPTY_LOGS,
};

const getClosedStatus = () => "closed" as const;
const getNull = () => null;
const getEmptyHistory = () => EMPTY_HISTORY;
const getEmptyBatch = () => EMPTY_BATCH;
const getEmptyLogs = () => EMPTY_LOGS;
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

export function useSystemMetrics() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe,
		() => socket.getSnapshot().metrics,
		getNull,
	);
}

export function useSystemLogs() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe,
		() => socket.getSnapshot().logs,
		getEmptyLogs,
	);
}

export function useSensorSocket() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe,
		socket.getSnapshot,
		getCachedServerSnapshot,
	);
}
