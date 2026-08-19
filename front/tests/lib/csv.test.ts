import { describe, expect, it } from "vitest";
import type { SensorReading } from "#/interfaces/sensor";
import { sensorReadingsToCsv } from "#/lib/csv";

function reading(overrides: Partial<SensorReading> = {}): SensorReading {
	return {
		timestamp: 1700000000.123,
		gyro: { x: 0.1, y: 0.2, z: 0.3 },
		accel: { x: 1.1, y: 1.2, z: 9.8 },
		linear_velocity: { x: 0.5, y: -0.5, z: 0 },
		orientation: { roll: 1, pitch: 2, yaw: 3 },
		...overrides,
	};
}

describe("sensorReadingsToCsv", () => {
	it("returns only the header row for an empty history", () => {
		const csv = sensorReadingsToCsv([]);
		expect(csv).toBe(
			"timestamp,gyro_x,gyro_y,gyro_z,accel_x,accel_y,accel_z,linear_velocity_x,linear_velocity_y,linear_velocity_z,orientation_roll,orientation_pitch,orientation_yaw",
		);
	});

	it("serializes each reading as a comma-separated row in order", () => {
		const history = [
			reading({ timestamp: 1 }),
			reading({ timestamp: 2, gyro: { x: 9, y: 9, z: 9 } }),
		];

		const csv = sensorReadingsToCsv(history);
		const lines = csv.split("\n");

		expect(lines).toHaveLength(3);
		expect(lines[1]).toBe("1,0.1,0.2,0.3,1.1,1.2,9.8,0.5,-0.5,0,1,2,3");
		expect(lines[2]).toBe("2,9,9,9,1.1,1.2,9.8,0.5,-0.5,0,1,2,3");
	});
});
