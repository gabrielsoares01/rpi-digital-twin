import { useEffect, useSyncExternalStore } from "react";
import type { SensorSocketSnapshot } from "#/interfaces/sensor";
import { getSensorSocket } from "#/services/websocket";

const SERVER_SNAPSHOT: SensorSocketSnapshot = {
	status: "closed",
	latest: null,
	history: [],
	metrics: null,
	logs: [],
};

const getClosedStatus = () => "closed" as const;
const getNull = () => null;
const getEmptyHistory = () => [];
const getEmptyLogs = () => [];
const getCachedServerSnapshot = () => SERVER_SNAPSHOT;

export function useSensorSocket() {
	const socket = getSensorSocket();

	useEffect(() => {
		socket.connect();
		return () => socket.disconnect();
	}, [socket]);

	return useSyncExternalStore(
		socket.subscribe.bind(socket),
		socket.getSnapshot.bind(socket),
		getCachedServerSnapshot,
	);
}

export function useSensorStatus() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe.bind(socket),
		() => socket.getSnapshot().status,
		getClosedStatus,
	);
}

export function useLatestTelemetry() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe.bind(socket),
		() => socket.getSnapshot().latest,
		getNull,
	);
}

export function useSensorHistory() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe.bind(socket),
		() => socket.getSnapshot().history,
		getEmptyHistory,
	);
}

export function useSystemMetrics() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe.bind(socket),
		() => socket.getSnapshot().metrics,
		getNull,
	);
}

export function useSystemLogs() {
	const socket = getSensorSocket();

	return useSyncExternalStore(
		socket.subscribe.bind(socket),
		() => socket.getSnapshot().logs,
		getEmptyLogs,
	);
}
