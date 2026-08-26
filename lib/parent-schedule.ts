export function sanitizeParentAgenda<T extends Record<string, unknown>>(
  agenda: T | null | undefined,
  agendaDate: string,
  today: string,
) {
  if (!agenda) return null
  const safeAgenda = { ...agenda }
  if (agendaDate !== today) delete safeAgenda.foto_url
  return safeAgenda
}

