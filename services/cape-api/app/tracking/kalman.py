"""Constant-velocity 2D Kalman filter (state x, y, vx, vy; time unit = 1 frame)."""

from __future__ import annotations

import numpy as np

from app.schemas import Point

_H = np.array([[1.0, 0, 0, 0], [0, 1.0, 0, 0]])


class Kalman2D:
    def __init__(
        self,
        p0: Point,
        v0: Point = (0.0, 0.0),
        process_noise: float = 1.0,
        measurement_noise: float = 4.0,
        initial_velocity_var: float = 100.0,
    ) -> None:
        self.x = np.array([p0[0], p0[1], v0[0], v0[1]], dtype=np.float64)
        self.P = np.diag([measurement_noise, measurement_noise, initial_velocity_var, initial_velocity_var])
        self.q = process_noise
        self.R = np.eye(2) * measurement_noise

    @property
    def position(self) -> Point:
        return (float(self.x[0]), float(self.x[1]))

    @property
    def velocity(self) -> Point:
        return (float(self.x[2]), float(self.x[3]))

    def predict(self, dt: float = 1.0) -> Point:
        F = np.eye(4)
        F[0, 2] = F[1, 3] = dt
        # Discrete white-noise acceleration model.
        g = np.array([[dt * dt / 2, 0], [0, dt * dt / 2], [dt, 0], [0, dt]])
        self.x = F @ self.x
        self.P = F @ self.P @ F.T + g @ g.T * self.q
        return self.position

    def update(self, p: Point) -> Point:
        y = np.asarray(p, dtype=np.float64) - _H @ self.x
        S = _H @ self.P @ _H.T + self.R
        K = self.P @ _H.T @ np.linalg.inv(S)
        self.x = self.x + K @ y
        self.P = (np.eye(4) - K @ _H) @ self.P
        return self.position

    def step(self, p: Point | None, dt: float = 1.0) -> Point:
        self.predict(dt)
        return self.update(p) if p is not None else self.position
