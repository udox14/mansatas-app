import { PARENT_ATTENDANCE_HELP as copy } from '@/lib/parent-attendance-presentation'

export function AttendanceHelp() {
  return <details className="rounded-xl border border-[#D8D4CC] bg-white p-4 text-sm text-slate-600">
    <summary className="cursor-pointer font-semibold text-slate-900">Cara membaca kehadiran anak</summary>
    <div className="mt-3 space-y-3 leading-6">
      <h3 className="font-semibold text-slate-900">{copy.title}</h3><p>{copy.intro}</p>
      <ul className="list-disc space-y-1 pl-5">{copy.rules.map(rule=><li key={rule}>{rule}</li>)}</ul>
      <p>{copy.example}</p><h3 className="font-semibold text-slate-900">{copy.permissionTitle}</h3>
      <p>{copy.permission}</p><p>{copy.correction}</p>
    </div>
  </details>
}
