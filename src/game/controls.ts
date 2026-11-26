/**
 * Pure tactile mobile joystick & touch steering math (decoupled from DOM for unit testing).
 */

export interface JoystickVector {
  /** Normalized steering input in [-1, 1] (-1 = full left, +1 = full right) */
  steer: number;
  /** Visual thumb knob offset X in [-1, 1] inside the circular joystick ring */
  knobX: number;
  /** Visual thumb knob offset Y in [-1, 1] inside the circular joystick ring */
  knobY: number;
}

/**
 * Converts pointer delta (dx, dy) relative to joystick center and outer radius
 * into a smooth, non-linear precision steering output + clamped circular knob coordinates.
 *
 * Uses a small deadzone (0.07) so holding near center tracks dead-straight at 340+ km/h,
 * plus a gentle power curve (1.22) for surgical mid-corner modulation and effortless full lock.
 */
export function computeJoystickSteer(
  dx: number,
  dy: number,
  maxRadiusPx: number
): JoystickVector {
  const safeR = Math.max(1, maxRadiusPx);
  const dist = Math.hypot(dx, dy);
  const scale = dist > safeR ? safeR / dist : 1;
  const clampedDx = dx * scale;
  const clampedDy = dy * scale;

  const knobX = Math.max(-1, Math.min(1, clampedDx / safeR));
  const knobY = Math.max(-1, Math.min(1, clampedDy / safeR));

  // Pure horizontal deflection drives steering so thumb vertical drift never upsets the car
  const rawX = Math.max(-1, Math.min(1, dx / (safeR * 0.88)));
  const absX = Math.abs(rawX);
  const deadzone = 0.07;

  if (absX <= deadzone) {
    return { steer: 0, knobX, knobY };
  }

  const normalized = Math.min(1, (absX - deadzone) / (1 - deadzone));
  const shaped = Math.pow(normalized, 1.22);
  const steer = Number((Math.sign(rawX) * shaped).toFixed(3));

  return { steer, knobX, knobY };
}
