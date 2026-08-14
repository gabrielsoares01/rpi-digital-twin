"""Unit tests for orientation_filter.ComplementaryFilter."""

import math

import pytest

from orientation_filter import ComplementaryFilter

LEVEL_ACCEL = {"x": 0.0, "y": 0.0, "z": 9.81}
ZERO_GYRO = {"x": 0.0, "y": 0.0, "z": 0.0}


def test_starts_at_zero_orientation():
    filt = ComplementaryFilter()
    assert filt.get_orientation() == {"roll": 0.0, "pitch": 0.0, "yaw": 0.0}


def test_level_and_stationary_stays_level():
    filt = ComplementaryFilter()
    for _ in range(5):
        orientation = filt.update(LEVEL_ACCEL, ZERO_GYRO, dt=0.1)
    assert orientation["roll"] == pytest.approx(0.0, abs=1e-9)
    assert orientation["pitch"] == pytest.approx(0.0, abs=1e-9)
    assert orientation["yaw"] == pytest.approx(0.0, abs=1e-9)


def test_yaw_is_pure_gyro_integration():
    filt = ComplementaryFilter(alpha=0.96)
    gyro = {"x": 0.0, "y": 0.0, "z": 10.0}
    orientation = filt.update(LEVEL_ACCEL, gyro, dt=1.0)
    # Accelerometer carries no yaw information, so yaw is only integrated.
    assert orientation["yaw"] == pytest.approx(10.0)

    orientation = filt.update(LEVEL_ACCEL, gyro, dt=0.5)
    assert orientation["yaw"] == pytest.approx(15.0)


def test_update_blends_gyro_and_accel_per_complementary_formula():
    alpha = 0.9
    filt = ComplementaryFilter(alpha=alpha)
    accel = {"x": 1.0, "y": 2.0, "z": 9.5}
    gyro = {"x": 5.0, "y": -3.0, "z": 0.0}
    dt = 0.02

    orientation = filt.update(accel, gyro, dt=dt)

    roll_acc = math.degrees(
        math.atan2(accel["y"], math.sqrt(accel["x"] ** 2 + accel["z"] ** 2))
    )
    pitch_acc = math.degrees(
        math.atan2(-accel["x"], math.sqrt(accel["y"] ** 2 + accel["z"] ** 2))
    )
    expected_roll = alpha * (0.0 + gyro["x"] * dt) + (1 - alpha) * roll_acc
    expected_pitch = alpha * (0.0 + gyro["y"] * dt) + (1 - alpha) * pitch_acc

    assert orientation["roll"] == pytest.approx(expected_roll)
    assert orientation["pitch"] == pytest.approx(expected_pitch)


def test_stationary_tilted_sensor_converges_towards_accel_angle():
    # Sensor physically tilted ~30 deg in roll and held still (no rotation).
    tilted_accel = {"x": 0.0, "y": 4.905, "z": 8.4863}
    filt = ComplementaryFilter(alpha=0.96)

    orientation = None
    for _ in range(500):
        orientation = filt.update(tilted_accel, ZERO_GYRO, dt=0.02)

    roll_acc = math.degrees(
        math.atan2(
            tilted_accel["y"],
            math.sqrt(tilted_accel["x"] ** 2 + tilted_accel["z"] ** 2),
        )
    )
    assert orientation["roll"] == pytest.approx(roll_acc, abs=0.5)


def test_get_orientation_does_not_mutate_state():
    filt = ComplementaryFilter()
    filt.update({"x": 1.0, "y": 1.0, "z": 9.5}, {"x": 2.0, "y": 2.0, "z": 2.0}, dt=0.1)
    before = filt.get_orientation()
    after = filt.get_orientation()
    assert before == after


def test_dt_defaults_to_zero_on_first_call_without_explicit_dt():
    filt = ComplementaryFilter()
    # No dt passed and no previous call -> gyro integration contributes nothing.
    orientation = filt.update(LEVEL_ACCEL, {"x": 100.0, "y": 100.0, "z": 100.0})
    assert orientation["roll"] == pytest.approx(0.0, abs=1e-9)
    assert orientation["pitch"] == pytest.approx(0.0, abs=1e-9)
    assert orientation["yaw"] == pytest.approx(0.0, abs=1e-9)
