const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');


const htmlPath = path.join(__dirname, 'plan_deberes.html');
const pdfPath = path.join(__dirname, '..', 'Plan_Semanal_Deberes_Familia_Armas.pdf');

// El plan imprimible vive en scripts/plan_deberes.html (única fuente): se edita ahí
// y este script solo lo convierte a PDF con Edge headless.
if (!fs.existsSync(htmlPath)) {
  console.error('No se encontró el HTML del plan en:', htmlPath);
  process.exit(1);
}
console.log('Usando HTML del plan:', htmlPath);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const command = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`;

console.log('Ejecutando Edge headless para generar PDF...');
try {
  execSync(command, { stdio: 'inherit' });
  console.log('PDF generado exitosamente en:', pdfPath);
} catch (err) {
  console.error('Error generando PDF con Edge:', err);
  process.exit(1);
}
