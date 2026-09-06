export function formatCkhDocumentVerification(documentId: string) {
  return `Dokumen ini dicetak dari MANSATAS App • ID Dokumen: ${String(documentId || '').trim()}`
}
