import { permanentRedirect } from 'next/navigation'

export default function LegacyCutiGuruPage() {
  permanentRedirect('/dashboard/cuti-guru')
}
