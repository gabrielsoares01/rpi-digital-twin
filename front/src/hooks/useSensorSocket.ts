import { useEffect, useSyncExternalStore } from "react";
import type { SensorSocketSnapshot } from "#/interfaces/sensor";
import { getSensorSocket } from "#/services/websocket";

const SERVER_SNAPSHOT: SensorSocketSnapshot = {
	status: "closed",
	latest: null,
	history: [],
};

export function useSensorStatus() {
	const socket = getSensorSocket();

	useEffect(() => {
		socket.connect();
		return () => socket.disconnect();
	}, [socket]);

	return useSyncExternalStore(
		socket.subscribeStatus.bind(socket),
		socket.getStatus.bind(socket),
		() => "closed",
	);
}

export function useLatestTelemetry() {
	const socket = getSensorSocket();

	useEffect(() => {
		socket.connect();
		return () => socket.disconnect();
	}, [socket]);

	return useSyncExternalStore(
		socket.subscribe.bind(socket),
		() => socket.getSnapshot().latest,
		() => null,
	);
}

export function useSensorHistory() {
	const socket = getSensorSocket();

	useEffect(() => {
		socket.connect();
		return () => socket.disconnect();
	}, [socket]);

	return useSyncExternalStore(
		socket.subscribe.bind(socket),
		() => socket.getSnapshot().history,
		() => [],
	);
}

export function useSensorSocket() {
	const socket = getSensorSocket();

	useEffect(() => {
		socket.connect();
		return () => socket.disconnect();
	}, [socket]);

	return useSyncExternalStore(
		socket.subscribe.bind(socket),
		socket.getSnapshot.bind(socket),
		() => SERVER_SNAPSHOT,
	);
}
