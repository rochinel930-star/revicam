// Génère les PDF factices de démonstration dans /public/epreuves-demo/.
// Usage : node scripts/make-demo-pdf.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makePdf(lines) {
  const content =
    'BT /F1 16 Tf 60 780 Td 22 TL\n' +
    lines.map((l) => `(${l.replace(/[()\\]/g, '')}) Tj T*`).join('\n') +
    '\nET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const outDir = path.join(__dirname, '..', 'public', 'epreuves-demo');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'probatoire-d-2024-physique-demo.pdf'),
  makePdf([
    'PDF DE DEMONSTRATION - ReviCam',
    '',
    'Probatoire D 2024 - Epreuve de Physique',
    '',
    'Ce fichier est un exemple technique.',
    'Les vraies epreuves seront deposees via le',
    'pipeline d import : voir content/README.md',
  ])
);
fs.writeFileSync(
  path.join(outDir, 'sequence1-2024-physique-demo.pdf'),
  makePdf([
    'PDF DE DEMONSTRATION - ReviCam',
    '',
    'Sequence n 1 2024 - Physique, Premiere D',
    'College Vogt',
    '',
    'Ce fichier est un exemple technique.',
  ])
);
console.log('PDF de demonstration generes dans public/epreuves-demo/');
