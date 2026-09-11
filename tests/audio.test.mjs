import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../src/audio.mjs';

// This fake records scheduled values and graph cleanup; it does not synthesize sound.
class FakeParam {
  value = 0;
  setValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}

class FakeNode {
  constructor(context) { this.context = context; }
  connect(destination) { this.destination = destination; }
  disconnect() { this.disconnected = true; }
}

class FakeOscillator extends FakeNode {
  frequency = new FakeParam();
  start() { this.started = true; }
  stop(when = 0) {
    this.stopAt = when;
    if (when <= this.context.currentTime) this.stoppedImmediately = true;
  }
}

class FakeAudioContext {
  static instances = [];
  currentTime = 1;
  state = 'suspended';
  destination = {};
  oscillators = [];
  constructor() { FakeAudioContext.instances.push(this); }
  createGain() { return Object.assign(new FakeNode(this), { gain: new FakeParam() }); }
  createOscillator() {
    const oscillator = new FakeOscillator(this);
    this.oscillators.push(oscillator);
    return oscillator;
  }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
}

function installAudio(t, Context = FakeAudioContext) {
  FakeAudioContext.instances = [];
  for (const [name, value] of [['AudioContext', Context], ['webkitAudioContext', undefined]]) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  }
}

test('audio creates no context or nodes until start is called from a gesture', async t => {
  installAudio(t);
  const audio = new GameAudio();
  audio.setMuted(false);
  audio.setDriving(true);
  audio.update(1, true, false);
  audio.play('jump');
  audio.pause();
  assert.equal(await audio.resume(), false);
  assert.equal(audio.context, null);
  assert.equal(FakeAudioContext.instances.length, 0);

  assert.equal(await audio.start(), true);
  assert.equal(FakeAudioContext.instances.length, 1);
  assert.ok(audio.context.oscillators.length > 0);
});

test('visiting the garage before the first race can start and resume audio', async t => {
  installAudio(t);
  const audio = new GameAudio();
  audio.pause();
  await audio.start();
  assert.equal(audio.context.state, 'suspended');
  assert.equal(audio.master.gain.value, 0);

  assert.equal(await audio.resume(), true);
  audio.setDriving(true);
  audio.play('jump');
  assert.equal(FakeAudioContext.instances.length, 1);
  assert.equal(audio.context.state, 'running');
  assert.ok(audio.master.gain.value > 0);
  assert.ok(audio.engineGain.gain.value > 0);
  assert.ok(audio.voices.size > 0);
});

test('muting silences the master and stops and disconnects active effects', async t => {
  installAudio(t);
  const audio = new GameAudio();
  await audio.start();
  audio.setDriving(true);
  audio.play('finish');
  const active = [...audio.voices];
  assert.ok(active.length > 0, 'the test must begin with audible effects scheduled');

  audio.setMuted(true);
  assert.equal(audio.master.gain.value, 0);
  assert.equal(audio.voices.size, 0);
  for (const voice of active) {
    assert.equal(voice.oscillator.stoppedImmediately, true);
    assert.equal(voice.oscillator.disconnected, true);
    assert.equal(voice.gain.disconnected, true);
  }
  audio.play('jump');
  assert.equal(audio.voices.size, 0);

  audio.setMuted(false);
  audio.play('star');
  assert.ok(audio.master.gain.value > 0);
  assert.ok(audio.voices.size > 0);
});

test('browsers without Web Audio keep optional audio calls harmless', async t => {
  installAudio(t, null);
  const audio = new GameAudio();
  assert.equal(await audio.start(), false);
  audio.setDriving(true);
  audio.update(1, true, true);
  audio.play('transform');
  audio.setMuted(true);
  audio.pause();
  assert.equal(await audio.resume(), false);
  assert.equal(audio.context, null);
  assert.equal(audio.voices.size, 0);
  assert.equal(FakeAudioContext.instances.length, 0);
});

test('pause silences driving and effects; resume reuses and restores the graph', async t => {
  installAudio(t);
  const audio = new GameAudio();
  await audio.start();
  audio.setDriving(true);
  audio.play('star');
  const context = audio.context;
  const oscillatorCount = context.oscillators.length;
  assert.ok(audio.engineGain.gain.value > 0);

  audio.pause();
  audio.play('land');
  assert.equal(context.state, 'suspended');
  assert.equal(audio.master.gain.value, 0);
  assert.equal(audio.engineGain.gain.value, 0);
  assert.equal(audio.voices.size, 0);
  assert.equal(context.oscillators.length, oscillatorCount);

  assert.equal(await audio.resume(), true);
  assert.equal(audio.context, context);
  assert.equal(context.oscillators.length, oscillatorCount);
  assert.ok(audio.master.gain.value > 0);
  assert.ok(audio.engineGain.gain.value > 0);
  audio.setDriving(false);
  assert.equal(audio.engineGain.gain.value, 0);
});
