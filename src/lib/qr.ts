/** Genera un código QR como data URL (PNG). Import dinámico: la librería
 * solo se descarga cuando de verdad hace falta mostrar un QR. */
export async function makeQrDataUrl(text: string): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(text, { width: 260, margin: 1 });
}
