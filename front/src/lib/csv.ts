import type { SensorReading } from "#/interfaces/sensor";

const CSV_HEADER = [
	"timestamp",
	"gyro_x",
	"gyro_y",
	"gyro_z",
	"accel_x",
	"accel_y",
	"accel_z",
	"linear_velocity_x",
	"linear_velocity_y",
	"linear_velocity_z",
	"orientation_roll",
	"orientation_pitch",
	"orientation_yaw",
];

export function sensorReadingsToCsv(history: SensorReading[]): string {
	const rows = history.map((reading) =>
		[
			reading.timestamp,
			reading.gyro.x,
			reading.gyro.y,
			reading.gyro.z,
			reading.accel.x,
			reading.accel.y,
			reading.accel.z,
			reading.linear_velocity.x,
			reading.linear_velocity.y,
			reading.linear_velocity.z,
			reading.orientation.roll,
			reading.orientation.pitch,
			reading.orientation.yaw,
		].join(","),
	);

	return [CSV_HEADER.join(","), ...rows].join("\n");
}

export function downloadCsv(csv: string, filename: string): void {
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
