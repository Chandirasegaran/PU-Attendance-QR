// Attendance QR generator. The QR payload is just the register number,
// matching the PNGs this project used to ship in assets/.
(() => {
  'use strict';

  const REG_NO_PATTERN = /^\d{6,12}$/;
  const STORAGE_KEY = 'pu-attendance-qr:last';

  // Output image geometry (px). Width x height must match the canvas in index.html.
  const W = 1080;
  const H = 1440;
  const HEADER_H = 300;
  const FRAME = { x: 160, y: 350, size: 760, radius: 40 };
  const FOOTER_H = 76;
  const QUIET_MODULES = 4;

  const COLORS = {
    headerFrom: '#14286b',
    headerTo: '#1f4fd8',
    accent: '#1f4fd8',
    frame: '#e3e8f4',
    ink: '#0d1220',
    muted: '#6b7489',
    footer: '#f2f5fc',
  };
  const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

  const logo = new Image();
  logo.src = window.PU_LOGO_DATA_URL || 'assets/logo.png';

  const form = document.getElementById('qr-form');
  const regInput = document.getElementById('reg-no');
  const nameInput = document.getElementById('name');
  const regField = regInput.closest('.field');
  const regHint = document.getElementById('reg-hint');
  const downloadBtn = document.getElementById('download');
  const shareBtn = document.getElementById('share');
  const preview = document.getElementById('preview');
  const canvas = document.getElementById('qr-canvas');
  const status = document.getElementById('status');
  const ctx = canvas.getContext('2d');

  let lastRegNo = '';
  const DEFAULT_HINT = regHint.textContent;
  const canShareFiles = typeof navigator.canShare === 'function' && typeof File === 'function';
  if (canShareFiles) shareBtn.hidden = false;

  function setStatus(text, tone) {
    status.textContent = text;
    if (tone) status.dataset.tone = tone;
    else delete status.dataset.tone;
  }

  function setInvalid(message) {
    if (message) {
      regField.dataset.invalid = '';
      regInput.setAttribute('aria-invalid', 'true');
      regHint.textContent = message;
    } else {
      delete regField.dataset.invalid;
      regInput.removeAttribute('aria-invalid');
      regHint.textContent = DEFAULT_HINT;
    }
  }

  function fitText(text, maxWidth, size, weight, family) {
    let px = size;
    do {
      ctx.font = `${weight} ${px}px ${family}`;
      px -= 2;
    } while (ctx.measureText(text).width > maxWidth && px > 12);
  }

  function drawHeader() {
    const grad = ctx.createLinearGradient(0, 0, W, HEADER_H);
    grad.addColorStop(0, COLORS.headerFrom);
    grad.addColorStop(1, COLORS.headerTo);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, HEADER_H);

    // Soft decorative rings in the corner.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (const r of [140, 200, 260]) {
      ctx.beginPath();
      ctx.arc(W - 40, 30, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const cx = 160;
    const cy = HEADER_H / 2;
    const radius = 84;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    if (logo.complete && logo.naturalWidth) {
      const s = radius * 1.6;
      ctx.drawImage(logo, cx - s / 2, cy - s / 2, s, s);
    }

    const tx = cx + radius + 44;
    const maxW = W - tx - 60;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `600 24px ${SANS}`;
    ctx.letterSpacing = '4px';
    ctx.fillText('ATTENDANCE QR', tx, cy - 46);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = '#ffffff';
    fitText('Pondicherry University', maxW, 50, 700, SANS);
    ctx.fillText('Pondicherry University', tx, cy + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    fitText('Department of Computer Science', maxW, 30, 500, SANS);
    ctx.fillText('Department of Computer Science', tx, cy + 60);
  }

  function drawFrame() {
    const { x, y, size, radius } = FRAME;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = COLORS.frame;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.fill();
    ctx.stroke();

    // Accent corner brackets, drawn on the frame so they stay outside the quiet zone.
    const len = 90;
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    const corners = [
      [x, y, 1, 1], [x + size, y, -1, 1],
      [x, y + size, 1, -1], [x + size, y + size, -1, -1],
    ];
    for (const [px, py, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(px, py + dy * len);
      ctx.lineTo(px, py + dy * radius);
      ctx.arcTo(px, py, px + dx * radius, py, radius);
      ctx.lineTo(px + dx * len, py);
      ctx.stroke();
    }
  }

  function drawQr(regNo) {
    const qr = qrcode(0, 'M');
    qr.addData(regNo, 'Byte');
    qr.make();

    const modules = qr.getModuleCount();
    const cell = Math.floor(FRAME.size / (modules + QUIET_MODULES * 2));
    const size = cell * modules;
    const x0 = FRAME.x + Math.round((FRAME.size - size) / 2);
    const y0 = FRAME.y + Math.round((FRAME.size - size) / 2);

    // One path, one fill: much cheaper than a fillRect per module.
    const path = new Path2D();
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (qr.isDark(r, c)) path.rect(x0 + c * cell, y0 + r * cell, cell, cell);
      }
    }
    ctx.fillStyle = '#000000';
    ctx.fill(path);
  }

  function drawDetails(regNo, name) {
    // Without a name, nudge the block down so it sits centred above the footer.
    const top = FRAME.y + FRAME.size + (name ? 0 : 28);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = COLORS.muted;
    ctx.font = `600 24px ${SANS}`;
    ctx.letterSpacing = '5px';
    ctx.fillText('REGISTER NUMBER', W / 2, top + 72);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = COLORS.ink;
    fitText(regNo, W - 160, 80, 600, MONO);
    ctx.letterSpacing = '6px';
    ctx.fillText(regNo, W / 2, top + 156);
    ctx.letterSpacing = '0px';

    if (name) {
      ctx.fillStyle = '#2b3245';
      fitText(name, W - 160, 40, 500, SANS);
      ctx.fillText(name, W / 2, top + 214);
    }
  }

  function drawFooter() {
    ctx.fillStyle = COLORS.footer;
    ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(0, H - FOOTER_H, W, 4);
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'center';
    ctx.font = `500 24px ${SANS}`;
    ctx.fillText('Show this code to mark your attendance', W / 2, H - FOOTER_H / 2 + 10);
  }

  function draw(regNo, name) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    drawHeader();
    drawFrame();
    drawQr(regNo);
    drawDetails(regNo, name);
    drawFooter();
  }

  // Restart a one-shot CSS animation class on an element.
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function currentValues() {
    return {
      regNo: regInput.value.trim(),
      name: nameInput.value.trim().replace(/\s+/g, ' '),
    };
  }

  function render({ showErrors = false } = {}) {
    const { regNo, name } = currentValues();
    const valid = REG_NO_PATTERN.test(regNo);

    if (!valid) {
      preview.dataset.state = 'empty';
      downloadBtn.disabled = true;
      shareBtn.disabled = true;
      setStatus('');
      if (showErrors || /\D/.test(regNo)) {
        setInvalid(regNo ? 'Register number must be 6–12 digits.' : 'Enter your register number.');
        if (showErrors) replay(regField, 'shake');
      } else {
        setInvalid(null);
      }
      return false;
    }

    setInvalid(null);
    draw(regNo, name);
    if (preview.dataset.state !== 'ready') {
      preview.dataset.state = 'ready';
      replay(preview, 'reveal');
    } else if (regNo !== lastRegNo) {
      replay(preview, 'tick');
    }
    lastRegNo = regNo;
    downloadBtn.disabled = false;
    shareBtn.disabled = false;
    setStatus(`Ready · ${regNo}.png`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ regNo, name })); } catch {}
    return true;
  }

  function toBlob() {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png');
      } catch (err) {
        reject(err);
      }
    });
  }

  async function download() {
    if (!render({ showErrors: true })) { regInput.focus(); return; }
    let blob;
    try {
      blob = await toBlob();
    } catch (err) {
      console.error(err);
      setStatus('Could not create the image. Please reload the page and try again.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentValues().regNo}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Downloaded ✓', 'ok');
    replay(downloadBtn, 'done');
  }


  async function share() {
    if (!render({ showErrors: true })) { regInput.focus(); return; }
    const { regNo } = currentValues();
    let file;
    try {
      file = new File([await toBlob()], `${regNo}.png`, { type: 'image/png' });
    } catch (err) {
      console.error(err);
      setStatus('Could not create the image. Please reload the page and try again.');
      return;
    }
    if (!canShareFiles || !navigator.canShare({ files: [file] })) { download(); return; }
    try {
      await navigator.share({ files: [file], title: `Attendance QR ${regNo}` });
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('Sharing failed — try Download instead.');
    }
  }

  downloadBtn.addEventListener('animationend', () => downloadBtn.classList.remove('done'));
  regField.addEventListener('animationend', () => regField.classList.remove('shake'));

  // Keep the field digits-only as the user types or pastes.
  regInput.addEventListener('input', () => {
    const digits = regInput.value.replace(/\D/g, '');
    if (digits !== regInput.value) regInput.value = digits;
    render();
  });
  nameInput.addEventListener('input', () => render());
  regInput.addEventListener('blur', () => { if (regInput.value) render({ showErrors: true }); });

  form.addEventListener('submit', (e) => { e.preventDefault(); download(); });
  shareBtn.addEventListener('click', share);

  // Redraw once web fonts or the logo arrive so the image uses them.
  document.fonts?.ready.then(() => render());
  document.fonts?.addEventListener('loadingdone', () => render());
  logo.addEventListener('load', () => render());

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.regNo) {
      regInput.value = saved.regNo;
      nameInput.value = saved.name || '';
    }
  } catch {}

  // Support deep links like ?reg=22370001
  const fromUrl = new URLSearchParams(location.search).get('reg');
  if (fromUrl) regInput.value = fromUrl.replace(/\D/g, '');

  render();
})();
