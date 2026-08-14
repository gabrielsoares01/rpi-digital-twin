"""Unit tests for velocity_estimator.VelocityEstimator."""

import pytest

from velocity_estimator import VelocityEstimator, GRAVITY

FLAT_ORIENTATION = {"roll": 0.0, "pitch": 0.0, "yaw": 0.0}
GRAVITY_ONLY_ACCEL = {"x": 0.0, "y": 0.0, "z": GRAVITY}
ZERO_GYRO = {"x": 0.0, "y": 0.0, "z": 0.0}


def test_starts_at_zero_velocity():
    estimator = VelocityEstimator()
    assert estimator.get_velocity() == {"x": 0.0, "y": 0.0, "z": 0.0}


def test_dt_zero_or_negative_returns_unchanged_velocity():
    estimator = VelocityEstimator()
    v1 = estimator.update(GRAVITY_ONLY_ACCEL, ZERO_GYRO, FLAT_ORIENTATION, dt=0.0)
    v2 = estimator.update(GRAVITY_ONLY_ACCEL, ZERO_GYRO, FLAT_ORIENTATION, dt=-0.1)
    assert v1 == {"x": 0.0, "y": 0.0, "z": 0.0}
    assert v2 == {"x": 0.0, "y": 0.0, "z": 0.0}


def test_stationary_level_robot_stays_at_zero_velocity():
    estimator = VelocityEstimator()
    for _ in range(10):
        v = estimator.update(GRAVITY_ONLY_ACCEL, ZERO_GYRO, FLAT_ORIENTATION, dt=0.05)
    assert v["x"] == pytest.approx(0.0, abs=1e-9)
    assert v["y"] == pytest.approx(0.0, abs=1e-9)
    assert v["z"] == pytest.approx(0.0, abs=1e-9)


def test_leaky_integrator_matches_expected_formula_before_zupt_triggers():
    estimator = VelocityEstimator(zupt_min_samples=5, highpass_alpha=0.95)
    accel = {"x": 1.0, "y": 0.0, "z": GRAVITY}  # 1 m/s^2 of real motion in X

    v1 = estimator.update(accel, ZERO_GYRO, FLAT_ORIENTATION, dt=0.05)
    expected_v1 = 0.95 * (0.0 + 1.0 * 0.05)
    assert v1["x"] == pytest.approx(expected_v1)

    v2 = estimator.update(accel, ZERO_GYRO, FLAT_ORIENTATION, dt=0.05)
    expected_v2 = 0.95 * (expected_v1 + 1.0 * 0.05)
    assert v2["x"] == pytest.approx(expected_v2)


def test_zupt_zeroes_velocity_after_enough_consecutive_rest_samples():
    estimator = VelocityEstimator(zupt_min_samples=3)
    moving_accel = {"x": 2.0, "y": 0.0, "z": GRAVITY}

    # Build up non-zero velocity while moving.
    for _ in range(3):
        v = estimator.update(moving_accel, ZERO_GYRO, FLAT_ORIENTATION, dt=0.05)
    assert v["x"] != 0.0

    # Come to rest: after zupt_min_samples consecutive still frames, velocity resets.
    for i in range(3):
        v = estimator.update(GRAVITY_ONLY_ACCEL, ZERO_GYRO, FLAT_ORIENTATION, dt=0.05)

    assert v == {"x": 0.0, "y": 0.0, "z": 0.0}


def test_rest_counter_resets_when_motion_resumes():
    estimator = VelocityEstimator(zupt_min_samples=3)
    moving_accel = {"x": 2.0, "y": 0.0, "z": GRAVITY}

    # Two rest samples (not enough to trigger ZUPT), then motion again.
    estimator.update(GRAVITY_ONLY_ACCEL, ZERO_GYRO, FLAT_ORIENTATION, dt=0.05)
    estimator.update(GRAVITY_ONLY_ACCEL, ZERO_GYRO, FLAT_ORIENTATION, dt=0.05)
    v = estimator.update(moving_accel, ZERO_GYRO, FLAT_ORIENTATION, dt=0.05)

    # Motion resumed before ZUPT triggered, so velocity should be non-zero.
    assert v["x"] != 0.0


def test_gravity_removal_accounts_for_tilt():
    # Sensor tilted 90 deg in pitch: gravity now fully projects onto sensor X axis.
    estimator = VelocityEstimator(accel_threshold=100.0, gyro_threshold=1000.0)
    tilted_orientation = {"roll": 0.0, "pitch": 90.0, "yaw": 0.0}
    accel = {"x": -GRAVITY, "y": 0.0, "z": 0.0}

    accel_no_gravity = estimator._remove_gravity(accel, tilted_orientation)

    assert accel_no_gravity["x"] == pytest.approx(0.0, abs=1e-6)
    assert accel_no_gravity["y"] == pytest.approx(0.0, abs=1e-6)
    assert accel_no_gravity["z"] == pytest.approx(0.0, abs=1e-6)


def test_get_velocity_reflects_last_update():
    estimator = VelocityEstimator()
    v = estimator.update({"x": 1.0, "y": 0.0, "z": GRAVITY}, ZERO_GYRO, FLAT_ORIENTATION, dt=0.05)
    assert estimator.get_velocity() == v
