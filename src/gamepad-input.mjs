const DEADZONE = .2;
const REPEAT_DELAY = 350;
const REPEAT_INTERVAL = 150;
const BUTTONS = Object.freeze([0, 1, 2, 7, 9, 12, 13, 14, 15]);

function axis(value) {
  if (!Number.isFinite(value)) return 0;
  const bounded = Math.min(1, Math.max(-1, value));
  const magnitude = Math.abs(bounded);
  return magnitude <= DEADZONE ? 0 : Math.sign(bounded) * (magnitude - DEADZONE) / (1 - DEADZONE);
}

function pressed(button) {
  if (typeof button === 'number') return Number.isFinite(button) && button >= .5;
  return button?.pressed === true || (Number.isFinite(button?.value) && button.value >= .5);
}

function snapshot(pad) {
  try {
    if (!pad || typeof pad !== 'object' || pad.connected !== true || pad.mapping !== 'standard' || !Number.isSafeInteger(pad.index) || pad.index < 0) return null;
    let buttons = 0;
    for (const index of BUTTONS) if (pressed(pad.buttons?.[index])) buttons |= 1 << index;
    const x = axis(pad.axes?.[0]), y = axis(pad.axes?.[1]);
    const left = !!(buttons & (1 << 14)), right = !!(buttons & (1 << 15));
    const up = !!(buttons & (1 << 12)), down = !!(buttons & (1 << 13));
    const steer = left || right ? Number(right) - Number(left) : x;
    return {
      index: pad.index, id: typeof pad.id === 'string' ? pad.id : '', buttons, steer,
      navX: Math.sign(steer), navY: up || down ? Number(down) - Number(up) : Math.sign(y),
    };
  } catch {
    // A malformed/inaccessible snapshot must not break the application's loop.
    return null;
  }
}

function neutral() {
  return { connected: false, id: '', index: -1, steer: 0, jump: false, turbo: false, transform: false, pause: false, confirm: false, back: false, navX: 0, navY: 0 };
}

function primeNavigation(state, direction) {
  state.direction = direction;
  state.blocked = direction !== 0;
  state.next = Infinity;
}

function navigate(state, direction, now) {
  if (direction !== state.direction) {
    state.direction = direction;
    state.blocked = false;
    state.next = direction ? now + REPEAT_DELAY : Infinity;
    return direction;
  }
  if (!direction || state.blocked || now < state.next) return 0;
  // Emit at most one pulse after a delayed frame; never replay a backlog.
  state.next = now + REPEAT_INTERVAL;
  return direction;
}

/** Reads injected standard Gamepad snapshots only. First connection, replacement
 * and clear/reset prime held controls, requiring a fresh action-button press.
 * Analog steering remains continuous; menu directions repeat independently. */
export class GamepadInput {
  constructor() {
    this.activeIndex = -1;
    this.activeId = '';
    this.previousButtons = 0;
    this.priming = true;
    this.lastTime = 0;
    this.horizontal = { direction: 0, blocked: false, next: Infinity };
    this.vertical = { direction: 0, blocked: false, next: Infinity };
  }

  clear() {
    this.previousButtons = 0;
    this.priming = true;
    primeNavigation(this.horizontal, 0);
    primeNavigation(this.vertical, 0);
  }

  reset() { this.clear(); }

  sample(gamepads, nowMs = 0) {
    let selected = null, first = null;
    try {
      // Real snapshots are small array-like lists. Bound malformed lengths so a
      // corrupt adapter cannot stall an animation frame with an enormous loop.
      const length = Number.isSafeInteger(gamepads?.length) && gamepads.length >= 0 ? Math.min(gamepads.length, 256) : 0;
      for (let slot = 0; slot < length; slot++) {
        const candidate = snapshot(gamepads[slot]);
        if (!candidate) continue;
        first ??= candidate;
        if (candidate.index === this.activeIndex) { selected = candidate; break; }
      }
    } catch {
      // A list with throwing indexed getters is treated like a disconnect.
      selected = first = null;
    }
    selected ??= first;
    if (!selected) {
      this.activeIndex = -1;
      this.activeId = '';
      this.clear();
      return neutral();
    }
    const now = Number.isFinite(nowMs) && nowMs >= 0 && nowMs <= Number.MAX_SAFE_INTEGER ? nowMs : this.lastTime;
    if (now < this.lastTime) {
      this.horizontal.next = now + REPEAT_DELAY;
      this.vertical.next = now + REPEAT_DELAY;
    }
    this.lastTime = now;
    if (selected.index !== this.activeIndex || selected.id !== this.activeId) {
      this.activeIndex = selected.index;
      this.activeId = selected.id;
      this.clear();
    }
    const result = neutral();
    result.connected = true; result.id = selected.id; result.index = selected.index; result.steer = selected.steer;
    if (this.priming) {
      this.previousButtons = selected.buttons;
      primeNavigation(this.horizontal, selected.navX);
      primeNavigation(this.vertical, selected.navY);
      this.priming = false;
      return result;
    }
    const rising = selected.buttons & ~this.previousButtons;
    this.previousButtons = selected.buttons;
    result.jump = result.confirm = !!(rising & 1);
    result.back = !!(rising & (1 << 1));
    result.turbo = result.back || !!(rising & (1 << 7));
    result.transform = !!(rising & (1 << 2));
    result.pause = !!(rising & (1 << 9));
    result.navX = navigate(this.horizontal, selected.navX, now);
    result.navY = navigate(this.vertical, selected.navY, now);
    return result;
  }
}
