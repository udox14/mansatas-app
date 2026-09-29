export function StudentAttendanceLabel({ filled }: { filled: boolean }) {
  return <span className={`text-xs font-medium ${filled ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
    {filled ? 'Sudah diisi' : 'Belum diisi'}
  </span>
}
