import { PageHeader } from '@/components/layout/page-header'
import { TahfidzNav } from './components/TahfidzNav'

export default function TahfidzLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Tahfidz Al-Qur'an"
        description="Kelola dan pantau progress hafalan Al-Qur'an santri."
      />
      <TahfidzNav />
      {children}
    </div>
  )
}
