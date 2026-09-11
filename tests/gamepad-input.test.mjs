import test from 'node:test';
import assert from 'node:assert/strict';
import { GamepadInput } from '../src/gamepad-input.mjs';

function pad({ index = 0, id = 'Test controller', axes = [0, 0], held = [], values = {}, ...rest } = {}) {
  return { index, id, connected: true, mapping: 'standard', axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i), value: values[i] ?? (held.includes(i) ? 1 : 0) })), ...rest };
}

function actions(sample) {
  return ['jump', 'turbo', 'transform', 'pause', 'confirm', 'back'].map(key => sample[key]);
}

test('the output schema is neutral without a supported connected controller', () => {
  const input = new GamepadInput();
  const expected = { connected: false, id: '', index: -1, steer: 0, jump: false, turbo: false, transform: false, pause: false, confirm: false, back: false, navX: 0, navY: 0 };
  for (const pads of [undefined, null, [], [null, undefined], [pad({ connected: false })], [pad({ mapping: '' })], [pad({ mapping: 'xr-standard' })]]) assert.deepEqual(input.sample(pads), expected);
});

test('horizontal steering has an exact rescaled deadzone and clamps malformed axis magnitudes', () => {
  const input = new GamepadInput(); input.sample([pad()]);
  for (const [value, expected] of [[0, 0], [.2, 0], [-.2, 0], [.6, .5], [-.6, -.5], [1, 1], [-1, -1], [9, 1], [-9, -1], [NaN, 0], [Infinity, 0], ['1', 0], [undefined, 0]]) {
    assert.ok(Math.abs(input.sample([pad({ axes: [value, 0] })]).steer - expected) < 1e-12, `axis ${String(value)}`);
  }
  assert.equal(input.sample([pad({ axes: [-1, 0], held: [15] })]).steer, 1);
  assert.equal(input.sample([pad({ axes: [1, 0], held: [14] })]).steer, -1);
  assert.equal(input.sample([pad({ axes: [1, 0], held: [14, 15] })]).steer, 0, 'Opposing D-pad directions cancel instead of leaking the stick');
});

test('standard action buttons emit rising edges once, including independent turbo sources', () => {
  const input = new GamepadInput(); input.sample([pad()]);
  const pressed = input.sample([pad({ held: [0, 1, 2, 9] })], 10);
  assert.deepEqual(actions(pressed), [true, true, true, true, true, true]);
  for (const time of [20, 350, 1000, 10_000]) assert.deepEqual(actions(input.sample([pad({ held: [0, 1, 2, 9] })], time)), Array(6).fill(false));
  const trigger = input.sample([pad({ held: [0, 1, 2, 9], values: { 7: .5 } })], 10_010);
  assert.equal(trigger.turbo, true, 'A new trigger press works even while B remains held');
  assert.equal(trigger.back, false);
  assert.equal(input.sample([pad({ values: { 7: .49 } })], 10_020).turbo, false);
  assert.equal(input.sample([pad({ values: { 7: .8 } })], 10_030).turbo, true);
  input.sample([pad()], 10_040);
  assert.equal(input.sample([pad({ held: [2] })], 10_050).transform, true);
});

test('menu navigation emits an edge, repeats after 350ms then 150ms, and never catches up in a burst', () => {
  const input = new GamepadInput(); input.sample([pad()], 0);
  assert.equal(input.sample([pad({ axes: [.8, 0] })], 10).navX, 1);
  assert.equal(input.sample([pad({ axes: [.8, 0] })], 359).navX, 0);
  assert.equal(input.sample([pad({ axes: [.8, 0] })], 360).navX, 1);
  assert.equal(input.sample([pad({ axes: [.8, 0] })], 509).navX, 0);
  assert.equal(input.sample([pad({ axes: [.8, 0] })], 510).navX, 1);
  assert.equal(input.sample([pad({ axes: [.8, 0] })], 5000).navX, 1);
  assert.equal(input.sample([pad({ axes: [.8, 0] })], 5001).navX, 0);
  assert.equal(input.sample([pad({ axes: [-.8, 0] })], 5002).navX, -1, 'Direction reversal is a new edge');
  assert.equal(input.sample([pad({ axes: [0, 0] })], 5003).navX, 0);
  assert.equal(input.sample([pad({ held: [12, 15] })], 5004).navY, -1);
  const repeat = input.sample([pad({ held: [12, 15] })], 5354);
  assert.equal(repeat.navX, 1); assert.equal(repeat.navY, -1);
  const opposite = input.sample([pad({ axes: [0, -1], held: [12, 13] })], 5355);
  assert.equal(opposite.navY, 0, 'Opposing vertical D-pad buttons override the stick with neutral');
});

test('controller choice survives holes and list reordering until the selected index disconnects', () => {
  const input = new GamepadInput(), first = pad({ index: 3, id: 'First' }), second = pad({ index: 8, id: 'Second' });
  assert.equal(input.sample([null, first, second]).index, 3);
  assert.equal(input.sample([second, null, pad({ index: 3, id: 'First', held: [0] })]).jump, true);
  assert.equal(input.sample([second, null, first]).index, 3);
  const switched = input.sample([pad({ index: 3, id: 'First', connected: false }), pad({ index: 8, id: 'Second', held: [0, 2] })]);
  assert.equal(switched.index, 8); assert.deepEqual(actions(switched), Array(6).fill(false));
  assert.deepEqual(actions(input.sample([pad({ index: 8, id: 'Second', held: [0, 2] })], 1000)), Array(6).fill(false));
  input.sample([second]);
  assert.equal(input.sample([pad({ index: 8, id: 'Second', held: [2] })]).transform, true);
});

test('initial connect, reconnect and a replacement at the same index cannot inherit held-button actions', () => {
  const input = new GamepadInput(), held = pad({ held: [0, 2, 9, 15] });
  const initial = input.sample([held]); assert.deepEqual(actions(initial), Array(6).fill(false)); assert.equal(initial.navX, 0);
  assert.equal(input.sample([held], 1000).navX, 0, 'A direction held before connection waits for neutral or a deliberate reversal');
  input.sample([pad()]); assert.equal(input.sample([held]).jump, true);
  assert.equal(input.sample([]).connected, false);
  assert.deepEqual(actions(input.sample([held])), Array(6).fill(false));
  assert.deepEqual(actions(input.sample([pad({ id: 'Replacement', held: [2, 9] })])), Array(6).fill(false));
});

test('clear and reset preserve controller selection and suppress held controls until a fresh press', () => {
  for (const method of ['clear', 'reset']) {
    const input = new GamepadInput(), selected = pad({ index: 4, id: 'Selected' });
    input.sample([selected]); input.sample([pad({ index: 4, id: 'Selected', held: [2, 9, 15] })], 20);
    input[method]();
    const pads = [pad({ index: 0, id: 'Other' }), pad({ index: 4, id: 'Selected', held: [2, 9, 15] })];
    for (const time of [30, 400, 2000]) {
      const result = input.sample(pads, time); assert.equal(result.index, 4); assert.deepEqual(actions(result), Array(6).fill(false)); assert.equal(result.navX, 0);
    }
    input.sample([selected], 2010);
    const fresh = input.sample(pads, 2020); assert.equal(fresh.transform, true); assert.equal(fresh.pause, true); assert.equal(fresh.navX, 1);
  }
});

test('malformed snapshots and invalid clocks stay finite and cannot cause navigation storms', () => {
  const input = new GamepadInput();
  const throwing = { get connected() { throw new Error('stale adapter'); } };
  for (const pads of [123, 'bad', { length: Infinity }, { length: -1 }, { length: NaN }, [throwing], [pad({ index: -1 })], [pad({ index: NaN })], [pad({ index: '0' })]]) assert.equal(input.sample(pads).connected, false);
  const weird = pad({ axes: { 0: NaN, 1: Infinity }, buttons: [null, false, { pressed: 'true', value: Infinity }] });
  assert.equal(input.sample([weird]).steer, 0);
  assert.deepEqual(actions(input.sample([weird])), Array(6).fill(false));
  input.sample([pad()], 1000); assert.equal(input.sample([pad({ held: [13] })], 1010).navY, 1);
  assert.equal(input.sample([pad({ held: [13] })], NaN).navY, 0);
  assert.equal(input.sample([pad({ held: [13] })], Infinity).navY, 0);
  assert.equal(input.sample([pad({ held: [13] })], Number.MAX_VALUE).navY, 0);
  assert.equal(input.sample([pad({ held: [13] })], 5).navY, 0, 'A backwards clock restarts the repeat delay');
  assert.equal(input.sample([pad({ held: [13] })], 354).navY, 0);
  assert.equal(input.sample([pad({ held: [13] })], 355).navY, 1);
  const list = { length: 1, get 0() { throw new Error('expired list'); } };
  assert.equal(input.sample(list).connected, false);
});

test('sparse array-like snapshots and frozen inputs are read without mutation', () => {
  const input = new GamepadInput();
  const controller = pad({ index: 2, axes: [.6, 0] });
  Object.freeze(controller.axes); controller.buttons.forEach(Object.freeze); Object.freeze(controller.buttons); Object.freeze(controller);
  const list = Object.freeze({ length: 8, 7: controller });
  const first = input.sample(list);
  assert.equal(first.index, 2, 'Controller index is independent of its snapshot slot');
  first.steer = -1; first.transform = true;
  const second = input.sample(list);
  assert.ok(Math.abs(second.steer - .5) < 1e-12); assert.equal(second.transform, false);
  assert.equal(controller.axes[0], .6);
  assert.equal(controller.buttons[2].pressed, false);
});
