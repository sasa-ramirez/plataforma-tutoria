/**
 * Mezcla determinística sembrada: mismo seed siempre da el mismo orden.
 * Se usa para mezclar las opciones (A/B/C/D) de cada estudiante en cada
 * pregunta sin tener que guardar nada — el seed (estudiante+pregunta) ya
 * es estable entre recargas de página.
 */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** indices[posiciónMostrada] = índiceOriginal */
export function seededShuffleIndices(seed: string, length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  let h = hashString(seed) || 1;
  for (let i = indices.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}
