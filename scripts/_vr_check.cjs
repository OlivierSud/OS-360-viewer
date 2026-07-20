const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 412, height: 800 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.message || e)));

  await page.goto('http://localhost:5173/OS-360-viewer/viewer?id=proj_1784299627795_yfmcz', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const vr = btns.find(b => /réalité|vr|cardboard/i.test(b.getAttribute('title') || b.textContent || ''));
    if (vr) { vr.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1200);

  // Find a link marker and navigate via its target (simulates gaze on a link)
  const navInfo = await page.evaluate(() => {
    const linkMarker = Array.from(document.querySelectorAll('.psv-marker')).find(m => m.querySelector('[data-target]'));
    if (!linkMarker) return { noLink: true };
    const t = linkMarker.querySelector('[data-target]').getAttribute('data-target');
    if (t && window.selectPSVScene) { window.selectPSVScene(t); return { target: t }; }
    return { noTarget: true };
  });
  await page.waitForTimeout(2000); // allow panorama transition

  const after = await page.evaluate(() => {
    const layer = document.querySelector('[data-vr-layer]');
    const overlay = layer ? layer.querySelector('div:last-child') : null;
    const markers = Array.from(document.querySelectorAll('.psv-marker'));
    return {
      vrLayerPresent: !!layer,
      overlayChildren: overlay ? overlay.children.length : -1,
      nativeMarkers: markers.length,
      nativeHidden: markers.filter(m => getComputedStyle(m).display === 'none').length,
    };
  });

  console.log('enteredVR:', clicked, 'navInfo:', JSON.stringify(navInfo));
  console.log('AFTER scene change in VR:', JSON.stringify(after));
  console.log('ERRORS:', JSON.stringify(errors.slice(0, 10)));

  await browser.close();
})();
