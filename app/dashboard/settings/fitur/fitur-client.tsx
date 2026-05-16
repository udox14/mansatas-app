'use client'

import { useState, useTransition, useCallback } from 'react'
import { DEFAULT_SIDEBAR_GROUPS, MENU_ITEMS, type SidebarGroupConfig } from '@/config/menu'
import { toggleRoleFeature, createCustomRole, editCustomRole, deleteCustomRole, setRoleMobileNav, setRoleSidebarConfig, setFeatureDisplayTitle, setRoleFeaturePermission, type CrudPermission } from './actions'
import { cn } from '@/lib/utils'
import {
  Shield, Layers, Check, Loader2, Search, Info,
  PlusCircle, Pencil, Trash2, X, Tag, AlertCircle, Smartphone, Plus,
  PanelLeft, Folder, ArrowUp, ArrowDown, RotateCcw, KeyRound
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type ViewMode = 'per-fitur' | 'per-role' | 'crud' | 'roles' | 'navbar' | 'sidebar'
type CrudAction = keyof CrudPermission
type MasterRole = { value: string; label: string; is_custom: number; mobile_nav_links: string; sidebar_config?: string }

const ROLE_COLORS_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  super_admin: { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500' },
  admin_tu:   { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500' },
  kepsek:     { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  wakamad:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500' },
  guru:       { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
  guru_bk:    { bg: 'bg-cyan-50',   text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500' },
  guru_piket: { bg: 'bg-teal-50',   text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500' },
  wali_kelas: { bg: 'bg-indigo-50', text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-500' },
  resepsionis:{ bg: 'bg-pink-50',   text: 'text-pink-700',    border: 'border-pink-200',    dot: 'bg-pink-500' },
  guru_ppl:   { bg: 'bg-lime-50',   text: 'text-lime-700',    border: 'border-lime-200',    dot: 'bg-lime-500' },
  guru_tahfidz:{ bg: 'bg-amber-50',  text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  satpam:     { bg: 'bg-stone-50',  text: 'text-stone-700',   border: 'border-stone-200',   dot: 'bg-stone-500' },
  pramubakti: { bg: 'bg-yellow-50', text: 'text-yellow-700',  border: 'border-yellow-200',  dot: 'bg-yellow-500' },
  operator:   { bg: 'bg-sky-50',    text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-500' },
  bendahara_komite: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', dot: 'bg-fuchsia-500' },
}
const DEFAULT_COLOR = { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800', dot: 'bg-slate-500' }
const CUSTOM_COLOR  = { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' }

const LOCKED_FEATURES = new Set(['dashboard', 'settings', 'settings-fitur'])

interface FiturClientProps {
  initialMatrix: Record<string, string[]>
  initialPermissions: Record<string, Record<string, CrudPermission>>
  initialRoles: MasterRole[]
  initialFeatureLabels: Record<string, string>
}

export function FiturClient({ initialMatrix, initialPermissions, initialRoles, initialFeatureLabels }: FiturClientProps) {
  const [matrix, setMatrix] = useState(initialMatrix)
  const [permissions, setPermissions] = useState(initialPermissions)
  const [roles, setRoles] = useState(initialRoles)
  const [featureLabels, setFeatureLabels] = useState(initialFeatureLabels)
  const [viewMode, setViewMode] = useState<ViewMode>('per-fitur')
  const [searchTerm, setSearchTerm] = useState('')
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  const features = MENU_ITEMS.filter(item =>
    (featureLabels[item.id] || item.title).toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleToggle = useCallback(async (role: string, featureId: string, currentEnabled: boolean) => {
    if (role === 'super_admin' && LOCKED_FEATURES.has(featureId) && currentEnabled) return
    const key = `${role}:${featureId}`
    setPendingKeys(prev => new Set(prev).add(key))

    setMatrix(prev => {
      const next = { ...prev }
      const arr = [...(next[role] || [])]
      next[role] = currentEnabled ? arr.filter(f => f !== featureId) : [...arr, featureId]
      return next
    })

    startTransition(async () => {
      const res = await toggleRoleFeature(role, featureId, !currentEnabled)
      if (res?.error) {
        setMatrix(prev => {
          const next = { ...prev }
          const arr = [...(next[role] || [])]
          next[role] = !currentEnabled ? arr.filter(f => f !== featureId) : [...arr, featureId]
          return next
        })
        alert(res.error)
      }
      setPendingKeys(prev => { const s = new Set(prev); s.delete(key); return s })
    })
  }, [startTransition])

  const getEnabledCount = (featureId: string) =>
    roles.filter(r => matrix[r.value]?.includes(featureId)).length

  const getFeatureCount = (role: string) =>
    (matrix[role] || []).length

  const rolesTotalLabel = `${roles.length} role (${roles.filter(r => r.is_custom).length} custom)`

  return (
    <div className="space-y-3">
      {/* TOOLBAR */}
      <div className="bg-surface border border-surface rounded-xl p-3 flex flex-wrap gap-2 items-center">
        {(viewMode === 'per-fitur' || viewMode === 'per-role') && (
          <div className="relative flex-1 min-w-0" style={{ minWidth: '160px' }}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Cari fitur..."
              className="pl-8 h-8 text-sm rounded-md"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        )}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 rounded-lg p-0.5">
          {([
            { id: 'per-fitur', label: 'Per Fitur', icon: Layers },
            { id: 'per-role',  label: 'Per Role',  icon: Shield },
            { id: 'crud',      label: 'Hak CRUD',  icon: KeyRound },
            { id: 'roles',     label: 'Kelola Role', icon: Tag },
            { id: 'sidebar',   label: 'Sidebar', icon: PanelLeft },
            { id: 'navbar',    label: 'Bottom Nav', icon: Smartphone },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === id
                  ? 'bg-white dark:bg-slate-900 dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Info bar */}
      {viewMode !== 'roles' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg">
          <Info className="h-3.5 w-3.5 text-violet-500 shrink-0" />
          <p className="text-[11px] text-violet-700 dark:text-violet-300">
            {viewMode === 'per-fitur' && `Klik toggle untuk mengaktifkan/menonaktifkan fitur untuk role. ${rolesTotalLabel}.`}
            {viewMode === 'per-role' && `Pilih role lalu atur fitur mana saja yang bisa diakses. Perubahan langsung tersimpan.`}
            {viewMode === 'crud' && `Atur Create, Read, Update, Delete untuk fitur yang sudah diizinkan pada tiap role.`}
            {viewMode === 'sidebar' && `Atur susunan group dan urutan menu sidebar per role tanpa mengubah kode.`}
            {viewMode === 'navbar' && `Atur jalan pintas layar HP per role. Perubahan langsung tersimpan.`}
          </p>
        </div>
      )}

      {/* CONTENT */}
      {viewMode === 'per-fitur' && (
        <PerFiturView features={features} matrix={matrix} roles={roles} pendingKeys={pendingKeys} onToggle={handleToggle} getEnabledCount={getEnabledCount} featureLabels={featureLabels} setFeatureLabels={setFeatureLabels} />
      )}
      {viewMode === 'per-role' && (
        <PerRoleView features={features} matrix={matrix} roles={roles} pendingKeys={pendingKeys} onToggle={handleToggle} getFeatureCount={getFeatureCount} setMatrix={setMatrix} featureLabels={featureLabels} />
      )}
      {viewMode === 'crud' && (
        <CrudPermissionView features={features} matrix={matrix} setMatrix={setMatrix} permissions={permissions} setPermissions={setPermissions} roles={roles} featureLabels={featureLabels} />
      )}
      {viewMode === 'roles' && (
        <RoleManagerView roles={roles} setRoles={setRoles} matrix={matrix} setMatrix={setMatrix} />
      )}
      {viewMode === 'navbar' && (
        <NavbarView roles={roles} setRoles={setRoles} matrix={matrix} featureLabels={featureLabels} />
      )}
      {viewMode === 'sidebar' && (
        <SidebarView roles={roles} setRoles={setRoles} matrix={matrix} featureLabels={featureLabels} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// SHARED: Role toggle button
// ════════════════════════════════════════════════════════
function RoleToggleBtn({ role, featureId, enabled, loading, locked, onToggle }: {
  role: MasterRole; featureId: string; enabled: boolean; loading: boolean; locked: boolean
  onToggle: () => void
}) {
  const colors = ROLE_COLORS_MAP[role.value] || (role.is_custom ? CUSTOM_COLOR : DEFAULT_COLOR)
  return (
    <button
      onClick={() => !locked && onToggle()}
      disabled={loading || locked}
      className={cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all duration-150',
        enabled ? cn(colors.bg, colors.border) : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:border-slate-700 opacity-50 hover:opacity-80',
        locked && 'cursor-not-allowed',
        !locked && !loading && 'hover:shadow-sm'
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 shrink-0" />
      ) : enabled ? (
        <div className={cn('h-4 w-4 rounded flex items-center justify-center shrink-0', colors.dot)}>
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      ) : (
        <div className="h-4 w-4 rounded border-2 border-slate-300 dark:border-slate-700 dark:border-slate-600 shrink-0" />
      )}
      <span className={cn('text-xs font-medium truncate', enabled ? colors.text : 'text-slate-400 dark:text-slate-500')}>
        {role.label}
      </span>
      {role.is_custom === 1 && (
        <span className="text-[8px] font-bold text-orange-500 bg-orange-100 px-1 rounded shrink-0">NEW</span>
      )}
    </button>
  )
}

// ════════════════════════════════════════════════════════
// VIEW: Per Fitur
// ════════════════════════════════════════════════════════
function FeatureTitleEditor({ feature, featureLabels, setFeatureLabels }: {
  feature: typeof MENU_ITEMS[number]
  featureLabels: Record<string, string>
  setFeatureLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(featureLabels[feature.id] || feature.title)
  const [isSaving, setIsSaving] = useState(false)
  const displayTitle = featureLabels[feature.id] || feature.title

  const save = async () => {
    const nextTitle = draft.trim()
    if (!nextTitle || nextTitle === displayTitle) { setEditing(false); return }
    setIsSaving(true)
    const res = await setFeatureDisplayTitle(feature.id, nextTitle)
    setIsSaving(false)
    if (res?.error) { alert(res.error); return }
    setFeatureLabels(prev => {
      const next = { ...prev }
      if (nextTitle === feature.title) delete next[feature.id]
      else next[feature.id] = nextTitle
      return next
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setDraft(displayTitle); setEditing(false) }
          }}
          className="h-8 text-sm font-semibold rounded-md"
          autoFocus
        />
        <Button size="sm" onClick={save} disabled={isSaving || !draft.trim()} className="h-8 text-xs rounded-md">
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Simpan'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate">{displayTitle}</p>
      <button
        onClick={() => { setDraft(displayTitle); setEditing(true) }}
        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-violet-600 shrink-0"
        title="Rename fitur"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function PerFiturView({ features, matrix, roles, pendingKeys, onToggle, getEnabledCount, featureLabels, setFeatureLabels }: {
  features: typeof MENU_ITEMS; matrix: Record<string, string[]>; roles: MasterRole[]
  pendingKeys: Set<string>; onToggle: (role: string, featureId: string, enabled: boolean) => void
  getEnabledCount: (featureId: string) => number
  featureLabels: Record<string, string>
  setFeatureLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  return (
    <div className="space-y-2">
      {features.map(feature => {
        const Icon = feature.icon
        const count = getEnabledCount(feature.id)
        return (
          <div key={feature.id} className="bg-surface border border-surface rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-2">
              <div className="p-1.5 rounded-md bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800">
                <Icon className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <FeatureTitleEditor feature={feature} featureLabels={featureLabels} setFeatureLabels={setFeatureLabels} />
                <p className="text-[10px] text-slate-400">{feature.href}</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {count}/{roles.length} role
              </span>
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
              {roles.map(role => {
                const enabled = matrix[role.value]?.includes(feature.id) ?? false
                const key = `${role.value}:${feature.id}`
                const locked = role.value === 'super_admin' && LOCKED_FEATURES.has(feature.id) && enabled
                return (
                  <RoleToggleBtn
                    key={role.value} role={role} featureId={feature.id}
                    enabled={enabled} loading={pendingKeys.has(key)} locked={locked}
                    onToggle={() => onToggle(role.value, feature.id, enabled)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// VIEW: Per Role
// ════════════════════════════════════════════════════════
function PerRoleView({ features, matrix, roles, pendingKeys, onToggle, getFeatureCount, setMatrix, featureLabels }: {
  features: typeof MENU_ITEMS; matrix: Record<string, string[]>; roles: MasterRole[]
  pendingKeys: Set<string>; onToggle: (role: string, featureId: string, enabled: boolean) => void
  getFeatureCount: (role: string) => number; setMatrix: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  featureLabels: Record<string, string>
}) {
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.value ?? '')
  const count = getFeatureCount(selectedRole)
  const selectedRoleData = roles.find(r => r.value === selectedRole)
  const colors = ROLE_COLORS_MAP[selectedRole] || (selectedRoleData?.is_custom ? CUSTOM_COLOR : DEFAULT_COLOR)

  return (
    <div className="space-y-3">
      {/* Role selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {roles.map(role => {
          const rc = ROLE_COLORS_MAP[role.value] || (role.is_custom ? CUSTOM_COLOR : DEFAULT_COLOR)
          const isSelected = selectedRole === role.value
          return (
            <button
              key={role.value}
              onClick={() => setSelectedRole(role.value)}
              className={cn(
                'flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border transition-all duration-150',
                isSelected ? cn(rc.bg, rc.border, 'shadow-sm ring-2 ring-offset-1 ring-slate-300') : 'bg-surface border-surface hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <div className={cn('h-2 w-2 rounded-full shrink-0', rc.dot)} />
                <span className={cn('text-xs font-semibold truncate', isSelected ? rc.text : 'text-slate-600 dark:text-slate-400 dark:text-slate-300')}>
                  {role.label}
                </span>
                {role.is_custom === 1 && <span className="text-[8px] font-bold text-orange-500 ml-auto">★</span>}
              </div>
              <span className="text-[10px] text-slate-400 pl-4">{getFeatureCount(role.value)} fitur</span>
            </button>
          )
        })}
      </div>

      {selectedRole && (
        <div className="bg-surface border border-surface rounded-xl overflow-hidden">
          <div className={cn('flex items-center gap-3 px-4 py-3 border-b', colors.border, colors.bg)}>
            <div className={cn('h-3 w-3 rounded-full shrink-0', colors.dot)} />
            <div className="flex-1">
              <p className={cn('text-sm font-semibold', colors.text)}>
                {selectedRoleData?.label ?? selectedRole}
                {selectedRoleData?.is_custom === 1 && <span className="ml-2 text-[9px] font-bold text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded">CUSTOM</span>}
              </p>
              <p className="text-[10px] text-slate-400">{count} dari {MENU_ITEMS.length} fitur aktif · ID: <code className="font-mono">{selectedRole}</code></p>
            </div>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {features.map(feature => {
              const enabled = matrix[selectedRole]?.includes(feature.id) ?? false
              const key = `${selectedRole}:${feature.id}`
              const locked = selectedRole === 'super_admin' && LOCKED_FEATURES.has(feature.id) && enabled
              const Icon = feature.icon
              return (
                <button
                  key={feature.id}
                  onClick={() => !locked && onToggle(selectedRole, feature.id, enabled)}
                  disabled={pendingKeys.has(key) || locked}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all duration-150 text-left',
                    enabled ? 'bg-emerald-50 dark:bg-emerald-950/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:border-slate-700 opacity-60 hover:opacity-90',
                    locked && 'cursor-not-allowed'
                  )}
                >
                  <div className={cn('p-1 rounded shrink-0', enabled ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800')}>
                    <Icon className={cn('h-3.5 w-3.5', enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-medium truncate', enabled ? 'text-slate-800 dark:text-slate-200 dark:text-slate-100' : 'text-slate-400')}>{featureLabels[feature.id] || feature.title}</p>
                  </div>
                  {pendingKeys.has(key) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 shrink-0" />
                  ) : (
                    <div className={cn(
                      'h-[18px] w-[18px] rounded-full flex items-center justify-center shrink-0',
                      enabled ? 'bg-emerald-500' : 'border-2 border-slate-300 dark:border-slate-700 dark:border-slate-600'
                    )}>
                      {enabled && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// VIEW: Kelola Role
// ════════════════════════════════════════════════════════
function getCrudPermission(
  permissions: Record<string, Record<string, CrudPermission>>,
  role: string,
  featureId: string,
  enabled: boolean
): CrudPermission {
  return permissions[role]?.[featureId] || {
    create: enabled,
    read: enabled,
    update: enabled,
    delete: enabled,
  }
}

function CrudPermissionView({ features, matrix, setMatrix, permissions, setPermissions, roles, featureLabels }: {
  features: typeof MENU_ITEMS
  matrix: Record<string, string[]>
  setMatrix: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  permissions: Record<string, Record<string, CrudPermission>>
  setPermissions: React.Dispatch<React.SetStateAction<Record<string, Record<string, CrudPermission>>>>
  roles: MasterRole[]
  featureLabels: Record<string, string>
}) {
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.value ?? '')
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const selectedRoleData = roles.find(r => r.value === selectedRole)
  const colors = ROLE_COLORS_MAP[selectedRole] || (selectedRoleData?.is_custom ? CUSTOM_COLOR : DEFAULT_COLOR)
  const actionLabels: Array<{ action: CrudAction; label: string; title: string }> = [
    { action: 'create', label: 'C', title: 'Create / tambah data' },
    { action: 'read', label: 'R', title: 'Read / akses fitur' },
    { action: 'update', label: 'U', title: 'Update / edit data' },
    { action: 'delete', label: 'D', title: 'Delete / hapus data' },
  ]

  const updateLocalPermission = (role: string, featureId: string, patch: Partial<CrudPermission>) => {
    setPermissions(prev => {
      const featureEnabled = matrix[role]?.includes(featureId) ?? false
      const current = getCrudPermission(prev, role, featureId, featureEnabled)
      return {
        ...prev,
        [role]: {
          ...(prev[role] || {}),
          [featureId]: { ...current, ...patch },
        },
      }
    })
  }

  const togglePermission = async (featureId: string, action: CrudAction) => {
    const featureEnabled = matrix[selectedRole]?.includes(featureId) ?? false
    const current = getCrudPermission(permissions, selectedRole, featureId, featureEnabled)
    const nextEnabled = !current[action]
    const key = `${selectedRole}:${featureId}:${action}`
    setPendingKeys(prev => new Set(prev).add(key))

    if (action === 'read') {
      setMatrix(prev => {
        const next = { ...prev }
        const arr = [...(next[selectedRole] || [])]
        next[selectedRole] = nextEnabled ? Array.from(new Set([...arr, featureId])) : arr.filter(id => id !== featureId)
        return next
      })
      updateLocalPermission(selectedRole, featureId, nextEnabled
        ? { read: true, create: true, update: true, delete: true }
        : { read: false, create: false, update: false, delete: false }
      )
    } else {
      if (!featureEnabled) {
        setPendingKeys(prev => { const s = new Set(prev); s.delete(key); return s })
        return
      }
      updateLocalPermission(selectedRole, featureId, { [action]: nextEnabled })
    }

    const res = await setRoleFeaturePermission(selectedRole, featureId, action, nextEnabled)
    if (res?.error) {
      alert(res.error)
      if (action === 'read') {
        setMatrix(prev => {
          const next = { ...prev }
          const arr = [...(next[selectedRole] || [])]
          next[selectedRole] = featureEnabled ? Array.from(new Set([...arr, featureId])) : arr.filter(id => id !== featureId)
          return next
        })
        updateLocalPermission(selectedRole, featureId, current)
      } else {
        updateLocalPermission(selectedRole, featureId, { [action]: current[action] })
      }
    }
    setPendingKeys(prev => { const s = new Set(prev); s.delete(key); return s })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {roles.map(role => {
          const rc = ROLE_COLORS_MAP[role.value] || (role.is_custom ? CUSTOM_COLOR : DEFAULT_COLOR)
          const isSelected = selectedRole === role.value
          const activeCount = matrix[role.value]?.length || 0
          return (
            <button
              key={role.value}
              onClick={() => setSelectedRole(role.value)}
              className={cn(
                'flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border transition-all duration-150',
                isSelected ? cn(rc.bg, rc.border, 'shadow-sm ring-2 ring-offset-1 ring-slate-300') : 'bg-surface border-surface hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <div className={cn('h-2 w-2 rounded-full shrink-0', rc.dot)} />
                <span className={cn('text-xs font-semibold truncate', isSelected ? rc.text : 'text-slate-600 dark:text-slate-400')}>
                  {role.label}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 pl-4">{activeCount} fitur aktif</span>
            </button>
          )
        })}
      </div>

      {selectedRole && (
        <div className="bg-surface border border-surface rounded-xl overflow-hidden">
          <div className={cn('flex items-center gap-3 px-4 py-3 border-b', colors.border, colors.bg)}>
            <KeyRound className={cn('h-4 w-4 shrink-0', colors.text)} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', colors.text)}>Hak CRUD: {selectedRoleData?.label ?? selectedRole}</p>
              <p className="text-[10px] text-slate-500">R adalah akses fitur/menu. Jika R dimatikan, C/U/D ikut tidak aktif.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-surface-2 bg-slate-50 dark:bg-slate-800/60">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">Fitur</th>
                  {actionLabels.map(({ action, label, title }) => (
                    <th key={action} className="px-2 py-2.5 text-center text-[11px] font-semibold text-slate-500" title={title}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map(feature => {
                  const enabled = matrix[selectedRole]?.includes(feature.id) ?? false
                  const permission = getCrudPermission(permissions, selectedRole, feature.id, enabled)
                  const Icon = feature.icon
                  return (
                    <tr key={feature.id} className={cn('border-b border-surface-2 last:border-0', enabled ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'bg-slate-50/40 dark:bg-slate-900/30 opacity-75')}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('p-1.5 rounded-md border shrink-0', enabled ? 'bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800' : 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700')}>
                            <Icon className={cn('h-3.5 w-3.5', enabled ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400')} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{featureLabels[feature.id] || feature.title}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{feature.id}</p>
                          </div>
                        </div>
                      </td>
                      {actionLabels.map(({ action, label, title }) => {
                        const active = action === 'read' ? enabled : enabled && permission[action]
                        const disabled = action !== 'read' && !enabled
                        const key = `${selectedRole}:${feature.id}:${action}`
                        return (
                          <td key={action} className="px-2 py-2.5 text-center">
                            <button
                              onClick={() => togglePermission(feature.id, action)}
                              disabled={pendingKeys.has(key) || disabled}
                              title={title}
                              className={cn(
                                'mx-auto h-8 w-8 rounded-lg border text-[11px] font-black transition-all flex items-center justify-center',
                                active ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300',
                                disabled && 'cursor-not-allowed opacity-40',
                                action === 'read' && active && 'bg-blue-600 border-blue-700'
                              )}
                            >
                              {pendingKeys.has(key) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : label}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function RoleManagerView({ roles, setRoles, matrix, setMatrix }: {
  roles: MasterRole[]
  setRoles: React.Dispatch<React.SetStateAction<MasterRole[]>>
  matrix: Record<string, string[]>
  setMatrix: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
}) {
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Auto-generate slug from label
  const handleLabelChange = (val: string) => {
    setNewLabel(val)
    setNewValue(val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  }

  const handleCreate = () => {
    if (!newLabel.trim() || !newValue.trim()) return
    setError(''); setSuccessMsg('')
    startTransition(async () => {
      const res = await createCustomRole(newLabel, newValue)
      if (res?.error) { setError(res.error); return }
      const newRole: MasterRole = { value: res.slug!, label: newLabel.trim(), is_custom: 1, mobile_nav_links: '[]', sidebar_config: '' }
      setRoles(prev => [...prev, newRole])
      setMatrix(prev => ({ ...prev, [res.slug!]: [] }))
      setNewLabel(''); setNewValue('')
      setSuccessMsg(`Role "${newLabel}" berhasil dibuat!`)
    })
  }

  const handleEdit = (roleValue: string) => {
    setError(''); setSuccessMsg('')
    startTransition(async () => {
      const res = await editCustomRole(roleValue, editLabel)
      if (res?.error) { setError(res.error); return }
      setRoles(prev => prev.map(r => r.value === roleValue ? { ...r, label: editLabel } : r))
      setEditingRole(null)
      setSuccessMsg('Label berhasil diperbarui.')
    })
  }

  const handleDelete = (role: MasterRole) => {
    if (!confirm(`Hapus role "${role.label}"?\n\nSemua mapping fitur untuk role ini juga akan dihapus.`)) return
    setError(''); setSuccessMsg('')
    startTransition(async () => {
      const res = await deleteCustomRole(role.value)
      if (res?.error) { setError(res.error); return }
      setRoles(prev => prev.filter(r => r.value !== role.value))
      setMatrix(prev => { const next = { ...prev }; delete next[role.value]; return next })
      setSuccessMsg(`Role "${role.label}" berhasil dihapus.`)
    })
  }

  const defaultRoles = roles.filter(r => r.is_custom === 0)
  const customRoles  = roles.filter(r => r.is_custom === 1)

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg">
        <Info className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-violet-700 dark:text-violet-300">
          Buat role baru sesuai kebutuhan madrasah. Setelah dibuat, atur fiturnya di tab <strong>Per Role</strong>, lalu assign ke pegawai di halaman <strong>Guru & Pegawai</strong>.
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-400 text-xs">
          <Check className="h-3.5 w-3.5 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Tambah Role Baru */}
      <div className="bg-surface border border-surface rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2 bg-orange-50/50 dark:bg-orange-950/10">
          <PlusCircle className="h-4 w-4 text-orange-500 shrink-0" />
          <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">Buat Role Baru</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Nama Role</label>
              <Input
                placeholder="contoh: Kepala Perpustakaan"
                value={newLabel}
                onChange={e => handleLabelChange(e.target.value)}
                className="h-9 text-sm rounded-lg"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                ID Role <span className="text-slate-400 font-normal">(otomatis, bisa diedit)</span>
              </label>
              <div className="relative">
                <Input
                  placeholder="kepala_perpustakaan"
                  value={newValue}
                  onChange={e => setNewValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  className="h-9 text-sm rounded-lg font-mono"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                {newValue && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">slug</span>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={handleCreate}
            disabled={isPending || !newLabel.trim() || !newValue.trim()}
            className="h-9 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Buat Role
          </Button>
        </div>
      </div>

      {/* Custom Roles */}
      {customRoles.length > 0 && (
        <div className="bg-surface border border-surface rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">Role Custom ({customRoles.length})</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Role yang dibuat oleh admin. Dapat diedit atau dihapus.</p>
          </div>
          <div className="divide-y divide-surface-2">
            {customRoles.map(role => (
              <div key={role.value} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <Tag className="h-3.5 w-3.5 text-orange-600" />
                </div>
                {editingRole === role.value ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="h-8 text-sm flex-1 rounded-md"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(role.value); if (e.key === 'Escape') setEditingRole(null) }}
                    />
                    <Button size="sm" onClick={() => handleEdit(role.value)} disabled={isPending} className="h-8 text-xs bg-emerald-600 text-white rounded-md px-3">
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Simpan'}
                    </Button>
                    <button onClick={() => setEditingRole(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-400">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{role.label}</p>
                      <p className="text-[10px] font-mono text-slate-400">{role.value} · {matrix[role.value]?.length ?? 0} fitur aktif</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingRole(role.value); setEditLabel(role.label) }}
                        className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-600 transition-colors"
                        title="Edit nama"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(role)}
                        className="p-1.5 rounded hover:bg-rose-50 text-rose-500 transition-colors"
                        title="Hapus role"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Default Roles */}
      <div className="bg-surface border border-surface rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">Role Default ({defaultRoles.length})</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Role bawaan sistem. Nama bisa diedit, namun tidak bisa dihapus.</p>
        </div>
        <div className="divide-y divide-surface-2">
          {defaultRoles.map(role => {
            const colors = ROLE_COLORS_MAP[role.value] || DEFAULT_COLOR
            return (
              <div key={role.value} className="flex items-center gap-3 px-4 py-3">
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', colors.bg)}>
                  <div className={cn('h-3 w-3 rounded-full', colors.dot)} />
                </div>
                {editingRole === role.value ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="h-8 text-sm flex-1 rounded-md"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(role.value); if (e.key === 'Escape') setEditingRole(null) }}
                    />
                    <Button size="sm" onClick={() => handleEdit(role.value)} disabled={isPending} className="h-8 text-xs bg-emerald-600 text-white rounded-md px-3">
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Simpan'}
                    </Button>
                    <button onClick={() => setEditingRole(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-400">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold', colors.text)}>{role.label}</p>
                      <p className="text-[10px] font-mono text-slate-400">{role.value} · {matrix[role.value]?.length ?? 0} fitur aktif</p>
                    </div>
                    <button
                      onClick={() => { setEditingRole(role.value); setEditLabel(role.label) }}
                      className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-600 transition-colors shrink-0"
                      title="Edit nama tampil"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// VIEW: Konfigurasi Bottom Nav (Mobile)
// ════════════════════════════════════════════════════════
function parseSidebarConfig(raw?: string): SidebarGroupConfig[] {
  if (!raw) return DEFAULT_SIDEBAR_GROUPS
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {}
  return DEFAULT_SIDEBAR_GROUPS
}

function SidebarView({ roles, setRoles, matrix, featureLabels }: {
  roles: MasterRole[]
  setRoles: React.Dispatch<React.SetStateAction<MasterRole[]>>
  matrix: Record<string, string[]>
  featureLabels: Record<string, string>
}) {
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.value ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const selectedRoleData = roles.find(r => r.value === selectedRole)
  const groups = parseSidebarConfig(selectedRoleData?.sidebar_config)
  const allowedFeatures = matrix[selectedRole] ?? []
  const configuredIds = new Set(groups.flatMap(group => group.items))
  const availableItems = MENU_ITEMS.filter(item => allowedFeatures.includes(item.id) && !configuredIds.has(item.id))

  const saveGroups = async (nextGroups: SidebarGroupConfig[]) => {
    if (!selectedRoleData) return
    setIsSaving(true)
    const res = await setRoleSidebarConfig(selectedRole, nextGroups)
    setIsSaving(false)
    if (res?.error) { alert(res.error); return }
    setRoles(prev => prev.map(role => role.value === selectedRole ? { ...role, sidebar_config: res.groupsJson } : role))
  }

  const swapGroups = (index: number, offset: -1 | 1) => {
    const target = index + offset
    if (target < 0 || target >= groups.length) return
    const next = [...groups]
    ;[next[index], next[target]] = [next[target], next[index]]
    saveGroups(next)
  }

  const updateGroup = (groupId: string, patch: Partial<SidebarGroupConfig>) => {
    saveGroups(groups.map(group => group.id === groupId ? { ...group, ...patch } : group))
  }

  const moveItem = (fromGroupId: string, itemId: string, direction: 'up' | 'down') => {
    const next = groups.map(group => ({ ...group, items: [...group.items] }))
    const groupIndex = next.findIndex(group => group.id === fromGroupId)
    if (groupIndex < 0) return
    const itemIndex = next[groupIndex].items.indexOf(itemId)
    if (itemIndex < 0) return

    if (direction === 'up') {
      if (itemIndex > 0) {
        const items = next[groupIndex].items
        ;[items[itemIndex - 1], items[itemIndex]] = [items[itemIndex], items[itemIndex - 1]]
      } else if (groupIndex > 0) {
        next[groupIndex].items.splice(itemIndex, 1)
        next[groupIndex - 1].items.push(itemId)
      }
    } else if (itemIndex < next[groupIndex].items.length - 1) {
      const items = next[groupIndex].items
      ;[items[itemIndex], items[itemIndex + 1]] = [items[itemIndex + 1], items[itemIndex]]
    } else if (groupIndex < next.length - 1) {
      next[groupIndex].items.splice(itemIndex, 1)
      next[groupIndex + 1].items.unshift(itemId)
    }
    saveGroups(next)
  }

  const removeItem = (groupId: string, itemId: string) => {
    saveGroups(groups.map(group => group.id === groupId ? { ...group, items: group.items.filter(id => id !== itemId) } : group))
  }

  const addItem = (groupId: string, itemId: string) => {
    if (!itemId || itemId === '__empty') return
    saveGroups(groups.map(group => group.id === groupId ? { ...group, items: [...group.items, itemId] } : group))
  }

  const addGroup = () => {
    const label = newGroupLabel.trim()
    if (!label) return
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group'
    saveGroups([...groups, { id: `${slug}-${Date.now().toString(36)}`, label, items: [] }])
    setNewGroupLabel('')
  }

  const resetToDefault = () => {
    if (!confirm('Kembalikan susunan sidebar role ini ke default?')) return
    saveGroups(DEFAULT_SIDEBAR_GROUPS)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        <div className="md:col-span-1 space-y-2">
          {roles.map(role => {
            const isSelected = selectedRole === role.value
            const configuredCount = parseSidebarConfig(role.sidebar_config).flatMap(group => group.items).length
            return (
              <button
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left',
                  isSelected ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-100' : 'bg-surface border-surface-2 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                <span className={cn('text-xs font-semibold', isSelected ? 'text-violet-700' : 'text-slate-600 dark:text-slate-400')}>{role.label}</span>
                <span className="text-[10px] text-slate-400">{configuredCount}</span>
              </button>
            )
          })}
        </div>

        {selectedRoleData && (
          <div className="md:col-span-3 bg-surface border border-surface rounded-xl overflow-hidden p-4 space-y-4 relative">
            {isSaving && (
              <div className="absolute inset-0 z-10 bg-white dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedRoleData.label}</p>
                <p className="text-[10px] text-slate-400">Menu yang dicabut izinnya tetap tersimpan, tapi tidak muncul ke user.</p>
              </div>
              <Button variant="outline" size="sm" onClick={resetToDefault} className="h-8 text-xs rounded-lg gap-2">
                <RotateCcw className="h-3.5 w-3.5" /> Default
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={newGroupLabel}
                onChange={e => setNewGroupLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGroup()}
                placeholder="Nama group baru..."
                className="h-9 text-sm rounded-lg"
              />
              <Button onClick={addGroup} disabled={!newGroupLabel.trim()} className="h-9 text-sm rounded-lg gap-2">
                <PlusCircle className="h-4 w-4" /> Tambah Group
              </Button>
            </div>

            <div className="space-y-3">
              {groups.map((group, groupIndex) => (
                <div key={group.id} className="border border-surface-2 rounded-xl overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-surface-2">
                    <Folder className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    <Input
                      defaultValue={group.label}
                      onBlur={e => {
                        const nextLabel = e.target.value.trim()
                        if (nextLabel && nextLabel !== group.label) updateGroup(group.id, { label: nextLabel })
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                      className="h-7 text-xs font-semibold rounded-md max-w-[240px]"
                    />
                    <span className="text-[10px] text-slate-400 mr-auto">{group.items.length} menu</span>
                    <button onClick={() => swapGroups(groupIndex, -1)} disabled={groupIndex === 0} className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-900 disabled:opacity-30" title="Naikkan group">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => swapGroups(groupIndex, 1)} disabled={groupIndex === groups.length - 1} className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-900 disabled:opacity-30" title="Turunkan group">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => saveGroups(groups.filter(g => g.id !== group.id))} className="p-1.5 rounded hover:bg-rose-50 text-rose-500" title="Hapus group">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="p-3 space-y-2">
                    {group.items.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Group kosong.</p>
                    ) : (
                      group.items.map(itemId => {
                        const item = MENU_ITEMS.find(menu => menu.id === itemId)
                        const isRevoked = !allowedFeatures.includes(itemId)
                        if (!item) return null
                        const Icon = item.icon
                        return (
                          <div key={itemId} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border', isRevoked ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900')}>
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs font-medium truncate flex-1">{featureLabels[item.id] || item.title}</span>
                            {isRevoked && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                            <button onClick={() => moveItem(group.id, itemId, 'up')} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Naik">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => moveItem(group.id, itemId, 'down')} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" title="Turun">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => removeItem(group.id, itemId)} className="p-1 rounded hover:bg-rose-50 text-rose-500" title="Lepas dari sidebar">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })
                    )}

                    <Select onValueChange={(itemId) => addItem(group.id, itemId)} value="">
                      <SelectTrigger className="w-full sm:w-[320px] h-8 text-xs bg-surface border-surface-2 rounded-lg">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Plus className="h-3.5 w-3.5" /> Tambah menu ke group ini
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {availableItems.map(item => (
                          <SelectItem key={item.id} value={item.id} className="text-xs">{featureLabels[item.id] || item.title}</SelectItem>
                        ))}
                        {availableItems.length === 0 && (
                          <SelectItem value="__empty" disabled className="text-xs text-slate-400">Tidak ada fitur tersisa</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NavbarView({ roles, setRoles, matrix, featureLabels }: {
  roles: MasterRole[]
  setRoles: React.Dispatch<React.SetStateAction<MasterRole[]>>
  matrix: Record<string, string[]>
  featureLabels: Record<string, string>
}) {
  const [selectedRole, setSelectedRole] = useState<string>(roles[0]?.value ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const selectedRoleData = roles.find(r => r.value === selectedRole)
  const navLinksStr = selectedRoleData?.mobile_nav_links || '[]'
  let currentNavLinks: string[] = []
  try { currentNavLinks = JSON.parse(navLinksStr) } catch {}

  const allowedFeatures = matrix[selectedRole] ?? []

  const updateNavLinks = async (newLinks: string[]) => {
    if (!selectedRoleData) return
    setIsSaving(true)
    const res = await setRoleMobileNav(selectedRole, newLinks)
    setIsSaving(false)
    if (res?.error) { alert(res.error); return }
    const updatedStr = JSON.stringify(newLinks)
    setRoles(prev => prev.map(r => r.value === selectedRole ? { ...r, mobile_nav_links: updatedStr } : r))
  }

  const addNavLink = (id: string) => {
    if (currentNavLinks.length >= 5) {
      alert("Maksimal 5 menu navigasi agar tidak padat di layar mobile.")
      return
    }
    if (!currentNavLinks.includes(id)) {
      updateNavLinks([...currentNavLinks, id])
    }
  }

  const removeNavLink = (id: string) => {
    updateNavLinks(currentNavLinks.filter(l => l !== id))
  }

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg">
        <Info className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-violet-700 dark:text-violet-300">
          Atur jalan pintas (shortcut) untuk tampilan layar HP tiap peran/role (Maksimal 5). Pengguna ini hanya bisa melihat fitur yang diizinkan saja. Jika dikosongkan, Navbar tidak akan muncul sama sekali.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        {/* Role Selector list */}
        <div className="md:col-span-1 space-y-2">
          {roles.map(role => {
            const isSelected = selectedRole === role.value
            return (
              <button
                key={role.value}
                onClick={() => setSelectedRole(role.value)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left',
                  isSelected ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-100' : 'bg-surface border-surface-2 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                <span className={cn('text-xs font-semibold', isSelected ? 'text-violet-700' : 'text-slate-600 dark:text-slate-400')}>{role.label}</span>
                {JSON.parse(role.mobile_nav_links || '[]').length > 0 && (
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* Manager */}
        {selectedRoleData && (
          <div className="md:col-span-3 bg-surface border border-surface rounded-xl overflow-hidden p-5 space-y-4 relative">
             {isSaving && (
               <div className="absolute inset-0 z-10 bg-white dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
               </div>
             )}

             <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Urutan Menu Aktif ({currentNavLinks.length}/5)</p>
             <div className="flex flex-wrap gap-2 mb-4">
               {currentNavLinks.length === 0 ? (
                 <p className="text-xs text-slate-400 italic">Belum ada jalan pintas yang dipilih.</p>
               ) : (
                 currentNavLinks.map((id, index) => {
                   const mMenu = MENU_ITEMS.find(m => m.id === id)
                   // Jika admin revoke fitur padahal sebelumnya ada di nav, beri styling alert
                   const isRevoked = !allowedFeatures.includes(id)

                   return (
                     <div key={id} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border", isRevoked ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-blue-800")}>
                       <span className="text-[10px] font-bold opacity-50 w-3">{index + 1}.</span>
                       <span className="text-xs font-medium">{mMenu ? (featureLabels[mMenu.id] || mMenu.title) : id}</span>
                       {isRevoked && <span title="Izin fitur dicabut"><AlertCircle className="h-3 w-3" /></span>}
                       <button onClick={() => removeNavLink(id)} className="ml-1 text-slate-400 hover:text-rose-500">
                         <X className="h-3 w-3" />
                       </button>
                     </div>
                   )
                 })
               )}
             </div>

             <div className="pt-2 border-t border-surface-2 mt-4 space-y-2">
               <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tambahkan Jalan Pintas</p>
               <Select onValueChange={addNavLink} value="" disabled={currentNavLinks.length >= 5}>
                 <SelectTrigger className="w-[300px] h-9 text-xs bg-surface border-surface-2 rounded-lg">
                   <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                     <Plus className="h-3.5 w-3.5" /> {currentNavLinks.length >= 5 ? "Kapasitas penuh (maks 5)" : "Pilih dari fitur yang diizinkan..."}
                   </div>
                 </SelectTrigger>
                 <SelectContent>
                   {MENU_ITEMS.filter(m => allowedFeatures.includes(m.id) && !currentNavLinks.includes(m.id)).map(m => (
                     <SelectItem key={m.id} value={m.id} className="text-xs">
                       {featureLabels[m.id] || m.title}
                     </SelectItem>
                   ))}
                   {MENU_ITEMS.filter(m => allowedFeatures.includes(m.id) && !currentNavLinks.includes(m.id)).length === 0 && (
                     <SelectItem value="__empty" disabled className="text-xs text-slate-400">Tidak ada fitur tersisa yg bisa ditambah</SelectItem>
                   )}
                 </SelectContent>
               </Select>
               <p className="text-[10px] text-slate-400">
                 Hanya fitur yang dicentang pada tab <strong>Per Role</strong> yang akan muncul di dropdown ini.
               </p>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}
