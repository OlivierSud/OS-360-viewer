const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('http://localhost:5173/OS-360-viewer/viewer?id=proj_1784299627795_yfmcz', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const result = await page.evaluate(async () => {
    try {
      const mod = await import('/OS-360-viewer/src/components/Map/PanoCapture.tsx');
      const RES = 256;
      // LEFT half GREEN (camera left = -X), RIGHT half YELLOW (camera right = +X). yaw 0, pitch 0.
      function makePhoto(yaw) {
        const cv = document.createElement('canvas');
        cv.width = RES; cv.height = RES;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = 'green'; ctx.fillRect(0, 0, RES/2, RES);   // left
        ctx.fillStyle = 'yellow'; ctx.fillRect(RES/2, 0, RES/2, RES); // right
        return createImageBitmap(cv).then(bmp => ({ bitmap: bmp, yaw, pitch: 0, roll: 0 }));
      }
      const photos = await Promise.all([makePhoto(0), makePhoto(180)]);
      const blob = await mod.stitchPanorama(photos, 1024, 512, { w: 1280, h: 720 });
      const img = await createImageBitmap(blob);
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
      const W = img.width, H = img.height;
      const at = (lngDeg, latDeg) => {
        const u = (lngDeg + 180) / 360;
        const v = 0.5 - (latDeg * Math.PI / 180) / Math.PI;
        const x = Math.round(u * (W - 1));
        const y = Math.round(v * (H - 1));
        const d = c.getImageData(x, y, 1, 1).data;
        return `rgb(${d[0]},${d[1]},${d[2]})`;
      };
      return { ok: true, rightColor: at(10, 0), leftColor: at(-10, 0) };
    } catch (e) { return { err: String(e && e.stack || e) }; }
  });
  console.log('RESULT:', JSON.stringify(result));
  console.log('ERRORS:', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})();
