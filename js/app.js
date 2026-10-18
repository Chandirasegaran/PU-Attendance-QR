// Attendance QR generator. The QR payload is just the register number,
// matching the PNGs this project used to ship in assets/.
(() => {
  'use strict';

  const REG_NO_PATTERN = /^\d{6,12}$/;
  const STORAGE_KEY = 'pu-attendance-qr:last';

  // Output image geometry (px). Width x height must match the canvas in index.html.
  const W = 600;
  const H = 720;
  const QR_BOX = 520;
  const QR_TOP = 30;

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

  function draw(regNo, name) {
    const qr = qrcode(0, 'M');
    qr.addData(regNo, 'Byte');
    qr.make();

    const modules = qr.getModuleCount();
    const cell = Math.floor(QR_BOX / modules);
    const size = cell * modules;
    const x0 = Math.round((W - size) / 2);
    const y0 = QR_TOP + Math.round((QR_BOX - size) / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#000000';
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000000';
    const labelTop = QR_TOP + QR_BOX;

    fitText(regNo, W - 60, 44, 600, '"JetBrains Mono", ui-monospace, monospace');
    ctx.fillText(regNo, W / 2, labelTop + (name ? 62 : 92));

    if (name) {
      ctx.fillStyle = '#333333';
      fitText(name, W - 60, 32, 500, 'Inter, system-ui, sans-serif');
      ctx.fillText(name, W / 2, labelTop + 120);
    }
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
      } else {
        setInvalid(null);
      }
      return false;
    }

    setInvalid(null);
    draw(regNo, name);
    preview.dataset.state = 'ready';
    downloadBtn.disabled = false;
    shareBtn.disabled = false;
    setStatus(`Ready · ${regNo}.png`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ regNo, name })); } catch {}
    return true;
  }

  function toBlob() {
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png'));
  }

  async function download() {
    if (!render({ showErrors: true })) { regInput.focus(); return; }
    const blob = await toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentValues().regNo}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Downloaded ✓', 'ok');
  }

  async function share() {
    if (!render({ showErrors: true })) { regInput.focus(); return; }
    const { regNo } = currentValues();
    const file = new File([await toBlob()], `${regNo}.png`, { type: 'image/png' });
    if (!canShareFiles || !navigator.canShare({ files: [file] })) { download(); return; }
    try {
      await navigator.share({ files: [file], title: `Attendance QR ${regNo}` });
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('Sharing failed — try Download instead.');
    }
  }

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

  // Redraw once web fonts arrive so the label uses them.
  document.fonts?.ready.then(() => render());

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
