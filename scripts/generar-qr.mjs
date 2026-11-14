// Genera los QR fijos de cada furgón y una hoja A4 para imprimir.
//
//   BASE_URL=https://tu-app.vercel.app npm run qr
//
// Salida: qr/furgon-1.png, qr/furgon-2.png, qr/furgon-3.png y qr/hoja-impresion.html

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const FURGONES = [1, 2, 3];

const baseUrl = (process.env.BASE_URL ?? "").trim().replace(/\/+$/, "");

if (!/^https?:\/\//.test(baseUrl)) {
  console.error(
    "Falta BASE_URL. Ejemplo:\n  BASE_URL=https://tu-app.vercel.app npm run qr",
  );
  process.exit(1);
}

const carpeta = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "qr");
await mkdir(carpeta, { recursive: true });

const opciones = {
  errorCorrectionLevel: "H", // aguanta suciedad y rayones en el adhesivo
  margin: 2,
  width: 1000,
  color: { dark: "#000000", light: "#ffffff" },
};

const tarjetas = [];

for (const n of FURGONES) {
  const url = `${baseUrl}/f/furgon-${n}`;
  const archivo = `furgon-${n}.png`;
  await QRCode.toFile(path.join(carpeta, archivo), url, opciones);
  tarjetas.push({ n, url, archivo });
  console.log(`qr/${archivo}  →  ${url}`);
}

const html = `<!doctype html>
<html lang="es-CL">
<head>
<meta charset="utf-8">
<title>QR de furgones ProTerm</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    font-family: "Arial Narrow", "Helvetica Neue", Arial, sans-serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .hoja {
    width: 186mm;
    height: 268mm;
    margin: 0 auto;
    display: grid;
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: 6mm;
  }
  .tarjeta {
    display: grid;
    grid-template-columns: 74mm 1fr;
    align-items: center;
    gap: 10mm;
    padding: 4mm 8mm;
    border: 1.2mm solid #000;
    border-radius: 5mm;
    break-inside: avoid;
  }
  .tarjeta img { width: 74mm; height: 74mm; display: block; }
  .etiqueta { font-size: 17mm; font-weight: 700; line-height: 1; white-space: nowrap; }
  .etiqueta span { display: block; font-size: 28mm; line-height: 0.95; }
  .instruccion { margin-top: 4mm; font-size: 7.5mm; line-height: 1.2; }
  .url { margin-top: 4mm; font-size: 3.4mm; word-break: break-all; }
  @media screen {
    body { background: #e9ecef; padding: 10mm 0; }
    .hoja { background: #fff; padding: 0; outline: 12mm solid #fff; }
  }
</style>
</head>
<body>
<div class="hoja">
${tarjetas
  .map(
    (t) => `  <section class="tarjeta">
    <img src="${t.archivo}" alt="Código QR del furgón ${t.n}">
    <div>
      <div class="etiqueta">FURGÓN <span>${t.n}</span></div>
      <div class="instruccion">Escanea para registrar tu salida</div>
      <div class="url">${t.url}</div>
    </div>
  </section>`,
  )
  .join("\n")}
</div>
</body>
</html>
`;

await writeFile(path.join(carpeta, "hoja-impresion.html"), html, "utf8");
console.log("qr/hoja-impresion.html  →  abrir en el navegador e imprimir en A4");
