#!/usr/bin/env node
/* Builds app icon + splash from your branding (logo/colours set in Settings → Branding) and generates every Android / iOS size.
   Needs the Orbit server running (it draws the icon). Or drop your own resources/icon.png (1024²) and resources/splash.png (2732²). */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : process.env['ORBIT_' + k.toUpperCase()]; };
const root = path.resolve(__dirname, '..'), res = path.join(root, 'resources'); fs.mkdirSync(res, { recursive: true });
(async () => {
  const server = (arg('server') || '').replace(/\/+$/, '');
  if (server) {
    const get = async u => { const r = await fetch(server + u); if (!r.ok) throw new Error(u + ' → ' + r.status); return Buffer.from(await r.arrayBuffer()); };
    const pub = await (await fetch(server + '/api/public')).json(), color = (pub.brand && pub.brand.primary) || '#17406f';
    fs.writeFileSync(path.join(res, 'icon.png'), await get('/pwa/icon-1024.png'));
    const sharp = require('sharp'), icon = await sharp(path.join(res, 'icon.png')).resize(760).png().toBuffer();
    await sharp({ create: { width: 2732, height: 2732, channels: 4, background: color } }).composite([{ input: icon, gravity: 'center' }]).png().toFile(path.join(res, 'splash.png'));
    fs.copyFileSync(path.join(res, 'splash.png'), path.join(res, 'splash-dark.png')); fs.writeFileSync(path.join(res, '.color'), color);
    console.log('✔ icon + splash drawn from your branding (' + color + ')');
  }
  if (!fs.existsSync(path.join(res, 'icon.png'))) throw new Error('no resources/icon.png');
  const color = fs.existsSync(path.join(res, '.color')) ? fs.readFileSync(path.join(res, '.color'), 'utf8') : '#17406f';
  execSync(`npx capacitor-assets generate --iconBackgroundColor "${color}" --iconBackgroundColorDark "${color}" --splashBackgroundColor "${color}" --splashBackgroundColorDark "${color}"`, { stdio: 'inherit', cwd: root });
  console.log('✔ all icon and splash sizes generated for Android and iOS');
})().catch(e => { console.error('✖ ' + e.message); process.exit(1); });
