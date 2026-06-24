'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, Loader2, Smartphone, Save } from 'lucide-react'
import { House } from '@phosphor-icons/react'
import { MENU_ITEMS } from '@/config/menu'
import { getIconComponent } from '@/lib/icons'
import { cn } from '@/lib/utils'

type BottomNavConfigProps = {
  allowedFeatures: string[]
  initialConfig: string[] | null
  onSave: (selected: string[]) => Promise<{ error?: string; success?: string }>
}

export function BottomNavConfig({ allowedFeatures, initialConfig, onSave }: BottomNavConfigProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>(initialConfig || [])
  const [isSaving, setIsSaving] = useState(false)

  const availableFeatures = MENU_ITEMS.filter(item => allowedFeatures.includes(item.id) && item.id !== 'dashboard')

  const toggleFeature = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id))
    } else {
      if (selectedItems.length >= 4) {
        alert('Maksimal 4 fitur yang bisa ditambahkan ke Bottom Nav.')
        return
      }
      setSelectedItems([...selectedItems, id])
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await onSave(selectedItems)
      if (res.error) alert(res.error)
      else alert(res.success || 'Berhasil disimpan.')
    } catch (e) {
      alert('Gagal menyimpan.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone className="h-5 w-5 text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Konfigurasi Bottom Nav</h3>
      </div>
      
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Pilih maksimal 4 fitur untuk ditampilkan di menu navigasi bawah (khusus tampilan mobile). Menu HOME akan selalu berada di tengah.
      </p>

      {/* Mockup HP */}
      <div className="relative mx-auto w-[280px] h-[160px] bg-slate-100 dark:bg-slate-900 border-[6px] border-slate-800 rounded-t-[32px] overflow-hidden flex flex-col justify-end mt-4 shadow-lg">
        {/* Konten dummy HP */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent flex items-center justify-center pointer-events-none">
          <span className="text-slate-400 text-xs font-medium">Tampilan Mobile</span>
        </div>

        {/* Mockup Bottom Nav */}
        <div className="h-16 bg-white dark:bg-slate-950 border-t flex items-center justify-around px-2 relative shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          {/* Slot 1 & 2 */}
          {[0, 1].map((index) => {
            const featureId = selectedItems[index]
            const feature = featureId ? MENU_ITEMS.find(m => m.id === featureId) : null
            const Icon = feature ? getIconComponent(feature.icon) : Plus

            return (
              <div key={`left-${index}`} className="flex flex-col items-center justify-center w-12 gap-1">
                <div className={cn("flex items-center justify-center w-8 h-8 rounded-full", feature ? "text-slate-600 dark:text-slate-300" : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700")}>
                  <Icon className="w-4 h-4" />
                </div>
                {feature && <span className="text-[8px] font-medium text-center leading-tight line-clamp-2">{feature.title}</span>}
              </div>
            )
          })}

          {/* HOME TENGAAH */}
          <div className="flex flex-col items-center justify-center w-12 gap-1 relative z-10 -mt-5">
            <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white dark:border-slate-950">
              <House weight="fill" className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500">HOME</span>
          </div>

          {/* Slot 3 & 4 */}
          {[2, 3].map((index) => {
            const featureId = selectedItems[index]
            const feature = featureId ? MENU_ITEMS.find(m => m.id === featureId) : null
            const Icon = feature ? getIconComponent(feature.icon) : Plus

            return (
              <div key={`right-${index}`} className="flex flex-col items-center justify-center w-12 gap-1">
                <div className={cn("flex items-center justify-center w-8 h-8 rounded-full", feature ? "text-slate-600 dark:text-slate-300" : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700")}>
                  <Icon className="w-4 h-4" />
                </div>
                {feature && <span className="text-[8px] font-medium text-center leading-tight line-clamp-2">{feature.title}</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 border border-surface-3 rounded-lg overflow-hidden">
        <div className="max-h-[250px] overflow-y-auto p-2 bg-surface grid grid-cols-2 gap-2">
          {availableFeatures.map(feature => {
            const isSelected = selectedItems.includes(feature.id)
            const Icon = getIconComponent(feature.icon)
            return (
              <button
                key={feature.id}
                onClick={() => toggleFeature(feature.id)}
                disabled={!isSelected && selectedItems.length >= 4}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md border text-left text-xs transition-colors",
                  isSelected 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400" 
                    : "bg-surface hover:bg-surface-2 border-surface-3 opacity-90 disabled:opacity-40"
                )}
              >
                <div className={cn("p-1 rounded-sm", isSelected ? "bg-emerald-100 dark:bg-emerald-500/20" : "bg-surface-3")}>
                  <Icon className="h-3 w-3" />
                </div>
                <span className="flex-1 truncate leading-tight font-medium">{feature.title}</span>
                {isSelected ? (
                  <X className="h-3 w-3 opacity-60" />
                ) : (
                  <Plus className="h-3 w-3 opacity-60" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
        {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3 w-3 mr-1.5" />}
        Simpan Pengaturan Navigasi
      </Button>
    </div>
  )
}
