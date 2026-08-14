"""Unit tests for sensor_reader.SensorReader.

The MPU6050 talks over I2C via smbus2, so all tests replace smbus2.SMBus
with a mock bus that returns pre-packed raw register bytes.
"""

import struct
from unittest.mock import MagicMock, patch

import pytest

from sensor_reader import SensorReader, ACCEL_SCALE, GYRO_SCALE, GRAVITY


def _pack_raw(ax, ay, az, gx, gy, gz, temp=0):
    """Pack raw sensor register values the way the MPU6050 reports them."""
    packed = struct.pack(">7h", ax, ay, az, temp, gx, gy, gz)
    return list(packed)


@pytest.fixture
def mock_bus():
    with patch("sensor_reader.smbus2.SMBus") as mock_smbus_cls:
        bus = MagicMock()
        mock_smbus_cls.return_value = bus
        yield bus


def test_init_wakes_sensor_and_resets_offsets(mock_bus):
    sensor = SensorReader()
    mock_bus.write_byte_data.assert_called_once_with(0x68, 0x6B, 0)
    assert sensor.accel_offset == {"x": 0.0, "y": 0.0, "z": 0.0}
    assert sensor.gyro_offset == {"x": 0.0, "y": 0.0, "z": 0.0}


def test_calibrate_computes_average_offsets(mock_bus):
    # Constant raw reading: accel at rest with 1g on Z, gyro all zero except
    # a fixed noise bias to prove the offset is picked up.
    raw_ax = int(0.01 * ACCEL_SCALE)
    raw_ay = int(-0.02 * ACCEL_SCALE)
    raw_az = int(1.0 * ACCEL_SCALE)
    raw_gx = int(0.5 * GYRO_SCALE)
    raw_gy = int(-0.3 * GYRO_SCALE)
    raw_gz = int(0.1 * GYRO_SCALE)
    mock_bus.read_i2c_block_data.return_value = _pack_raw(
        raw_ax, raw_ay, raw_az, raw_gx, raw_gy, raw_gz
    )

    sensor = SensorReader()
    sensor.calibrate(samples=10, delay=0)

    assert sensor.accel_offset["x"] == pytest.approx(raw_ax / ACCEL_SCALE)
    assert sensor.accel_offset["y"] == pytest.approx(raw_ay / ACCEL_SCALE)
    # Z offset is shifted down by 1.0 so a resting sensor reads ~1g after calibration.
    assert sensor.accel_offset["z"] == pytest.approx(raw_az / ACCEL_SCALE - 1.0)

    assert sensor.gyro_offset["x"] == pytest.approx(raw_gx / GYRO_SCALE)
    assert sensor.gyro_offset["y"] == pytest.approx(raw_gy / GYRO_SCALE)
    assert sensor.gyro_offset["z"] == pytest.approx(raw_gz / GYRO_SCALE)


def test_read_applies_offset_and_converts_to_si_units(mock_bus):
    # Raw reading used purely for calibration: sensor perfectly level and still.
    mock_bus.read_i2c_block_data.return_value = _pack_raw(
        0, 0, int(1.0 * ACCEL_SCALE), 0, 0, 0
    )
    sensor = SensorReader()
    sensor.calibrate(samples=5, delay=0)

    # Now simulate a real reading with 1 m/s^2 of motion in X (raw units).
    moved_ax = int(1.0 / GRAVITY * ACCEL_SCALE)
    mock_bus.read_i2c_block_data.return_value = _pack_raw(
        moved_ax, 0, int(1.0 * ACCEL_SCALE), int(10 * GYRO_SCALE), 0, 0
    )

    data = sensor.read()

    assert data["accel"]["x"] == pytest.approx(1.0, abs=1e-2)
    assert data["accel"]["y"] == pytest.approx(0.0, abs=1e-2)
    assert data["accel"]["z"] == pytest.approx(GRAVITY, abs=1e-2)
    assert data["gyro"]["x"] == pytest.approx(10.0, abs=1e-2)
    assert "timestamp" in data


def test_close_closes_the_bus(mock_bus):
    sensor = SensorReader()
    sensor.close()
    mock_bus.close.assert_called_once()


def test_close_swallows_bus_errors(mock_bus):
    mock_bus.close.side_effect = OSError("bus already closed")
    sensor = SensorReader()
    sensor.close()  # must not raise
