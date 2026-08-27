import { scanBufferClamav } from '../src/utils/clamd.js';

const clean = await scanBufferClamav(Buffer.from('archivo limpio de prueba'));
const eicar = await scanBufferClamav(Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'));

console.log(JSON.stringify({ clean, eicar }, null, 2));

if (!clean.scanned || !clean.clean || eicar.clean || !eicar.scanned) {
  process.exitCode = 1;
}
