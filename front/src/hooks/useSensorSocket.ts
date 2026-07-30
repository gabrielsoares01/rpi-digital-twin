import { useEffect, useSyncExternalStore } from "react";
import {
	getSensorSocket,
	type SensorSocketSnapshot,
} from "#/services/websocket";

const SERVER_SNAPSHOT: SensorSocketSnapshot = {
	status: "closed",
	latestBySensor: new Map(),
	history: [],
};

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
