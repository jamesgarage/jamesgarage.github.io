/** Render the original game models into local, transparent garage portraits.
 * Run Vite at the origin root (no base subpath), then:
 * node scripts/render-trucks.mjs [http://127.0.0.1:5173]
 * Optional PLAYWRIGHT_CHROME_PATH selects a locally installed Chrome.
 * One temporary renderer is reused and disposed; gameplay only loads PNGs.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const baseURL = process.argv[2] || 'http://127.0.0.1:5173';
const output = new URL('../public/trucks/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {}),
  args: ['--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  await page.route('**/__truck-portraits', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto(`${baseURL.replace(/\/$/, '')}/__truck-portraits`);
  const portraits = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { makeTruck, disposeTruck } = await import('/src/models.mjs');
    const { TRUCKS } = await import('/src/core.mjs');
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(720, 480); renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe9f9ff, 0x72836e, 3));
    const sun = new THREE.DirectionalLight(0xffedcf, 4); sun.position.set(-6, 10, 8); scene.add(sun);
    const fill = new THREE.DirectionalLight(0x90c9ff, 2); fill.position.set(6, 3, -5); scene.add(fill);
    const camera = new THREE.PerspectiveCamera(27, 1.5, .1, 100);
    const portraits = [];
    for (const spec of TRUCKS) {
      const truck = makeTruck(spec); truck.group.scale.setScalar(1); scene.add(truck.group);
      // A shared frame keeps the collection's silhouette differences legible.
      camera.position.set(8.2, 6, 9.5); camera.lookAt(0, 1.6, 0);
      renderer.render(scene, camera);
      portraits.push({ id: spec.id, png: renderer.domElement.toDataURL('image/png').split(',')[1] });
      scene.remove(truck.group); disposeTruck(truck);
    }
    renderer.dispose(); renderer.forceContextLoss();
    return portraits;
  });
  for (const { id, png } of portraits) {
    await writeFile(new URL(`${id}.png`, output), Buffer.from(png, 'base64'));
    console.log(`Rendered ${id} → ${fileURLToPath(output)}`);
  }
} finally { await browser.close(); }
