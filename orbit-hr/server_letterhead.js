'use strict';
/* Orbit HRMS — company letterhead uploaded from the admin panel (Letterhead page).
   The admin uploads a PDF or image of the printed letterhead; the browser turns page 1 into an image and sends it here.
   Stored as data/letterhead.<ext> + data/letterhead.json (content margins in millimetres). Every printed document
   (payslips, letters, policies) is then laid over it. Remove it to go back to the generated letterhead. */
const fs = require('fs'), path = require('path');
module.exports = function (DATA, json, X) {
  const metaFile = path.join(DATA, 'letterhead.json'), DEF = { present: false, top: 38, bottom: 32, side: 18, ext: '', v: 0, name: '' };
  let M = { ...DEF }; try { M = { ...DEF, ...JSON.parse(fs.readFileSync(metaFile, 'utf8')) }; } catch { }
  const imgFile = () => path.join(DATA, 'letterhead.' + (M.ext || 'jpg')), mm = (v, d, lo, hi) => { v = Math.round(+v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  if (M.present && !fs.existsSync(imgFile())) M = { ...DEF };
  const saveMeta = () => { const t = metaFile + '.tmp'; fs.writeFileSync(t, JSON.stringify(M)); fs.renameSync(t, metaFile); };
  const pub = () => ({ present: M.present, top: M.top, bottom: M.bottom, side: M.side, v: M.v, name: M.name });
  const setMargins = b => { if ('top' in b) M.top = mm(b.top, M.top, 5, 120); if ('bottom' in b) M.bottom = mm(b.bottom, M.bottom, 5, 120); if ('side' in b) M.side = mm(b.side, M.side, 5, 50); };
  const readBody = (req, max) => new Promise(r => { let s = '', big = false; req.on('data', c => { if (big) return; s += c; if (s.length > max) { big = true; s = ''; } }); req.on('end', () => { if (big) return r(null); try { r(JSON.parse(s || '{}')); } catch { r({}); } }); req.on('error', () => r(null)); });

  async function handle(req, res, u, p) {
    if (p !== '/api/letterhead' && !p.startsWith('/api/letterhead/')) return false;
    if (p === '/api/letterhead' && req.method === 'GET') return json(res, 200, pub()), true;
    if (p === '/api/letterhead/image' && req.method === 'GET') {
      if (!M.present) return json(res, 404, { error: 'No letterhead uploaded.' }), true;
      return fs.readFile(imgFile(), (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': M.ext === 'png' ? 'image/png' : 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' }); res.end(d); }), true;
    }
    const me = X.who(req); if (!(me && me.priv) && !X.adminOk(req)) return json(res, 403, { error: 'Only HR or an administrator can change the letterhead.' }), true;
    if (p === '/api/letterhead' && req.method === 'POST') {
      const b = await readBody(req, 7e6); if (!b) return json(res, 413, { error: 'That letterhead is too large. Use a file under 4 MB.' }), true;
      if (b.image !== undefined) {
        const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image)); if (!m) return json(res, 400, { error: 'The letterhead must be a PNG or JPEG image (PDFs are converted in the browser before upload).' }), true;
        const buf = Buffer.from(m[2], 'base64'), png = m[1] === 'png';
        if (buf.length < 2000 || buf.length > 5e6 || !(png ? buf.subarray(0, 4).toString('hex') === '89504e47' : buf.subarray(0, 2).toString('hex') === 'ffd8')) return json(res, 400, { error: 'That file is not a valid image.' }), true;
        try { if (M.present) fs.unlinkSync(imgFile()); } catch { }
        M.ext = png ? 'png' : 'jpg'; fs.writeFileSync(imgFile(), buf); M.present = true; M.v = Date.now(); M.name = String(b.name || '').slice(0, 120);
      }
      setMargins(b); saveMeta(); return json(res, 200, pub()), true;
    }
    if (p === '/api/letterhead' && req.method === 'DELETE') { try { if (M.present) fs.unlinkSync(imgFile()); } catch { } M = { ...DEF, top: M.top, bottom: M.bottom, side: M.side }; saveMeta(); return json(res, 200, pub()), true; }
    return json(res, 404, { error: 'not found' }), true;
  }
  return { handle };
};
