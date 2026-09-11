import * as THREE from 'three';
import { sampleTrack } from './track.mjs';

/** Reusable finish portal for races that end before the grand-tour finish. */
export function createCourseFinish() {
  const group = new THREE.Group(); group.name = 'selected-course-finish';
  const box = new THREE.BoxGeometry(1, 1, 1);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc84d, roughness: .5 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff2cf, roughness: .7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x214758, roughness: .7 });
  const add = (material, x, y, z, sx, sy, sz) => { const mesh = new THREE.Mesh(box, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; group.add(mesh); };
  for (const side of [-1, 1]) { add(gold, side * 10.4, 11, 0, .75, 22, .75); add(cream, side * 10.4, .35, 0, 2.3, .7, 2.3); }
  for (let row = 0; row < 2; row++) for (let i = 0; i < 16; i++) add((row + i) % 2 ? cream : dark, -8 + i * 1.07, .025, row * 1.1, 1.07, .04, 1.1);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff2cf'; ctx.fillRect(0, 0, 512, 96); ctx.fillStyle = '#214758'; ctx.font = '900 66px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FINISH!', 256, 72);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 3.75), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  sign.position.set(0, 20, 0); sign.rotation.y = Math.PI; group.add(sign);
  group.visible = false;
  let disposed=false;
  return { group, setCourse(course) { if(disposed)return;group.visible = course.end < 1900; const frame = sampleTrack(course.end); group.position.copy(frame.position); group.quaternion.copy(frame.quaternion); },
    dispose() { if(disposed)return;group.removeFromParent();box.dispose();gold.dispose();cream.dispose();dark.dispose();sign.geometry.dispose();sign.material.dispose();texture.dispose();disposed=true; } };
}
