/** Authored, shared toy-car and turbo locations. No mutable race state lives here. */
export const CRUSH_CARS = Object.freeze([
  Object.freeze({ id: 'car-110', distance: 110, lane: 0, color: 0x54b8ec }),
  Object.freeze({ id: 'car-300', distance: 300, lane: -.75, color: 0xffca45 }),
  Object.freeze({ id: 'car-500', distance: 500, lane: 0, color: 0xe989b8 }),
  Object.freeze({ id: 'car-1185', distance: 1185, lane: 0, color: 0xff8763 }),
  Object.freeze({ id: 'car-1385', distance: 1385, lane: .75, color: 0x8ccb66 }),
  Object.freeze({ id: 'car-1640', distance: 1640, lane: 0, color: 0xa391ed }),
]);

export const TURBO_PADS = Object.freeze([355, 635, 1148, 1460, 1800].map(distance =>
  Object.freeze({ id: `pad-${distance}`, distance, length: 12 })));
