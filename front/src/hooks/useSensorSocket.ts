import { useEffect, useSyncExternalStore } from "react";
import type { SensorSocketSnapshot } from "#/interfaces/sensor";
import { getSensorSocket } from "#/services/websocket";

const SERVER_SNAPSHOT: SensorSocketSnapshot = {
	status: "closed",
	latest: null,
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
