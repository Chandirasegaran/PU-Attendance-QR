# PU Attendance QR

A small static web app for students of the Department of Computer Science, Pondicherry University, to generate and download their attendance QR code.

**Live:** https://chandirasegaran.github.io/PU-Attendance-QR/

## Features

- Generates the QR in the browser for any register number (6–12 digits). Nothing is uploaded.
- The QR encodes only the register number, the same payload as the PNGs this repo used to store.
- Optional name printed under the QR.
- Download as PNG (`<register-number>.png`), or share on phones that support it.
- Remembers your last register number on that device.
- Deep link: `?reg=22370001` pre-fills the form.
- Responsive, dark-mode aware, keyboard accessible.
- No build step or framework. The only dependency is [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT), vendored in `vendor/`.

## Project layout

```
index.html        page markup
css/style.css     styles
js/app.js         QR generation, download/share logic
vendor/           qrcode-generator 1.4.4
assets/           logo and favicon
indexa.html, indexaa.html   redirects for old links
```

## Run locally

Any static file server works:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Credits

Original styles by @mLokadev.
