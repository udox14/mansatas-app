'use client'

import { useMemo, useState, useTransition, type Dispatch, type SetStateAction } from 'react'
import {
  DEFAULT_SIDEBAR_GROUPS,
  MENU_ITEMS,
  normalizeSidebarRoleOverride,
  parseSidebarRoleOverride,
  resolveSidebarGroups,
  type SidebarGroupConfig,
  type SidebarRoleOverrideConfig,
} from '@/config/menu'
import {
  createCustomRole,
  deleteCustomRole,
  editCustomRole,
  setFeatureDisplayTitle,
  setRoleFeaturePermission,
  setRoleMobileNav,
  setRoleSidebarConfig,
  setSidebarTemplateConfig,
  type CrudPermission,
} from './actions'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Folder,
  KeyRound,
  Layers,
  Loader2,
  PanelLeft,
  Pencil,
  Plus,
  PlusCircle,
  RotateCcw,
  Search,
  Shield,
  Smartphone,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

type ViewMode = 'access' | 'sidebar-template' | 'roles-nav'
type CrudAction = keyof CrudPermission
type MasterRole = { value: string; label: string; is_custom: number; mobile_nav_links: string; sidebar_config?: string }

const LOCKED_FEATURES = new Set(['dashboard', 'settings', 'settings-fitur'])
const CRUD_ACTIONS: Array<{ action: CrudAction; label: string; title: string }> = [
  { action: 'read', label: 'R', title: 'Read / akses fitur dan menu' },
  { action: 'create', label: 'C', title: 'Create / tambah data' },
  { action: 'update', label: 'U', title: 'Update / edit data' },
  { action: 'delete', label: 'D', title: 'Delete / hapus data' },
]

const ROLE_COLORS_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  super_admin: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  admin_tu: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  kepsek: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  wakamad: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  guru: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
  guru_bk: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  guru_piket: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  wali_kelas: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  resepsionis: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500' },
  guru_ppl: { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200', dot: 'bg-lime-500' },
  guru_tahfidz: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  satpam: { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-200', dot: 'bg-stone-500' },
  pramubakti: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  operator: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  bendahara_komite: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', dot: 'bg-fuchsia-500' },
}
const DEFAULT_COLOR = { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800', dot: 'bg-slate-500' }
const CUSTOM_COLOR = { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' }

interface FiturClientProps {
  initialMatrix: Record<string, string[]>
  initialPermissions: Record<string, Record<string, CrudPermission>>
  initialRoles: MasterRole[]
  initialFeatureLabels: Record<string, string>
  initialSidebarTemplate: SidebarGroupConfig[]
}

export function FiturClient({
  initialMatrix,
  initialPermissions,
  initialRoles,
  initialFeatureLabels,
  initialSidebarTemplate,
}: FiturClientProps) {
  const [matrix, setMatrix] = useState(initialMatrix)
  const [permissions, setPermissions] = useState(initialPermissions)
  const [roles, setRoles] = useState(initialRoles)
  const [featureLabels, setFeatureLabels] = useState(initialFeatureLabels)
  const [sidebarTemplate, setSidebarTemplate] = useState(initialSidebarTemplate)
  const [viewMode, setViewMode] = useState<ViewMode>('access')
  const [searchTerm, setSearchTerm] = useState('')

  const features = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return MENU_ITEMS
    return MENU_ITEMS.filter(item =>
      (featureLabels[item.id] || item.title).toLowerCase().includes(term) ||
      item.id.toLowerCase().includes(term) ||
      item.href.toLowerCase().includes(term)
    )
  }, [featureLabels, searchTerm])

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-surface rounded-xl p-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder={viewMode === 'sidebar-template' ? 'Cari menu di template...' : 'Cari fitur...'}
            className="pl-8 h-8 text-sm rounded-md"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {([
            { id: 'access', label: 'Akses Role', icon: Shield },
            { id: 'sidebar-template', label: 'Template Sidebar', icon: PanelLeft },
            { id: 'roles-nav', label: 'Role & Navigasi', icon: Smartphone },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                viewMode === id
                  ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'access' && (
        <AccessRoleView
          features={features}
          matrix={matrix}
          setMatrix={setMatrix}
          permissions={permissions}
          setPermissions={setPermissions}
          roles={roles}
          featureLabels={featureLabels}
          setFeatureLabels={setFeatureLabels}
        />
      )}
      {viewMode === 'sidebar-template' && (
        <TemplateSidebarView
          features={features}
          sidebarTemplate={sidebarTemplate}
          setSidebarTemplate={setSidebarTemplate}
          featureLabels={featureLabels}
        />
      )}
      {viewMode === 'roles-nav' && (
        <RoleAndNavigationView
          roles={roles}
          setRoles={setRoles}
          matrix={matrix}
          setMatrix={setMatrix}
          sidebarTemplate={sidebarTemplate}
          featureLabels={featureLabels}
        />
      )}
    </div>
  )
}

function roleColors(role?: MasterRole | null) {
  if (!role) return DEFAULT_COLOR
  return ROLE_COLORS_MAP[role.value] || (role.is_custom ? CUSTOM_COLOR : DEFAULT_COLOR)
}

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

function parseNavLinks(raw?: string) {
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function FeatureTitleEditor({
  feature,
  featureLabels,
  setFeatureLabels,
}: {
  feature: typeof MENU_ITEMS[number]
  featureLabels: Record<string, string>
  setFeatureLabels: Dispatch<SetStateAction<Record<string, string>>>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(featureLabels[feature.id] || feature.title)
  const [isSaving, setIsSaving] = useState(false)
  const displayTitle = featureLabels[feature.id] || feature.title

  const save = async () => {
    const nextTitle = draft.trim()
    if (!nextTitle || nextTitle === displayTitle) {
      setEditing(false)
      return
    }
    setIsSaving(true)
    const res = await setFeatureDisplayTitle(feature.id, nextTitle)
    setIsSaving(false)
    if (res?.error) {
      alert(res.error)
      return
    }
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
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') save()
            if (event.key === 'Escape') {
              setDraft(displayTitle)
              setEditing(false)
            }
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
      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{displayTitle}</p>
      <button
        onClick={() => {
          setDraft(displayTitle)
          setEditing(true)
        }}
        className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-slate-800"
        title="Rename fitur"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function RolePicker({
  roles,
  matrix,
  selectedRole,
  onSelect,
}: {
  roles: MasterRole[]
  matrix: Record<string, string[]>
  selectedRole: string
  onSelect: (role: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {roles.map(role => {
        const colors = roleColors(role)
        const selected = selectedRole === role.value
        return (
          <button
            key={role.value}
            onClick={() => onSelect(role.value)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all',
              selected ? cn(colors.bg, colors.border, 'shadow-sm ring-2 ring-slate-300') : 'bg-surface border-surface hover:border-slate-300 dark:hover:border-slate-700'
            )}
          >
            <span className="flex w-full items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', colors.dot)} />
              <span className={cn('truncate text-xs font-semibold', selected ? colors.text : 'text-slate-600 dark:text-slate-300')}>{role.label}</span>
            </span>
            <span className="pl-4 text-[10px] text-slate-400">{matrix[role.value]?.length || 0} fitur aktif</span>
          </button>
        )
      })}
    </div>
  )
}

function AccessRoleView({
  features,
  matrix,
  setMatrix,
  permissions,
  setPermissions,
  roles,
  featureLabels,
  setFeatureLabels,
}: {
  features: typeof MENU_ITEMS
  matrix: Record<string, string[]>
  setMatrix: Dispatch<SetStateAction<Record<string, string[]>>>
  permissions: Record<string, Record<string, CrudPermission>>
  setPermissions: Dispatch<SetStateAction<Record<string, Record<string, CrudPermission>>>>
  roles: MasterRole[]
  featureLabels: Record<string, string>
  setFeatureLabels: Dispatch<SetStateAction<Record<string, string>>>
}) {
  const [selectedRole, setSelectedRole] = useState(roles[0]?.value ?? '')
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const selectedRoleData = roles.find(role => role.value === selectedRole)
  const colors = roleColors(selectedRoleData)

  const updateLocalPermission = (role: string, featureId: string, patch: Partial<CrudPermission>) => {
    setPermissions(prev => {
      const enabled = matrix[role]?.includes(featureId) ?? false
      const current = getCrudPermission(prev, role, featureId, enabled)
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
    const locked = selectedRole === 'super_admin' && LOCKED_FEATURES.has(featureId) && action === 'read' && featureEnabled
    if (locked) return

    const key = `${selectedRole}:${featureId}:${action}`
    setPendingKeys(prev => new Set(prev).add(key))

    if (action === 'read') {
      setMatrix(prev => {
        const next = { ...prev }
        const currentFeatures = [...(next[selectedRole] || [])]
        next[selectedRole] = nextEnabled
          ? Array.from(new Set([...currentFeatures, featureId]))
          : currentFeatures.filter(id => id !== featureId)
        return next
      })
      updateLocalPermission(selectedRole, featureId, nextEnabled
        ? { read: true, create: true, update: true, delete: true }
        : { read: false, create: false, update: false, delete: false }
      )
    } else {
      if (!featureEnabled) {
        setPendingKeys(prev => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
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
          const currentFeatures = [...(next[selectedRole] || [])]
          next[selectedRole] = featureEnabled
            ? Array.from(new Set([...currentFeatures, featureId]))
            : currentFeatures.filter(id => id !== featureId)
          return next
        })
        updateLocalPermission(selectedRole, featureId, current)
      } else {
        updateLocalPermission(selectedRole, featureId, { [action]: current[action] })
      }
    }
    setPendingKeys(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <RolePicker roles={roles} matrix={matrix} selectedRole={selectedRole} onSelect={setSelectedRole} />

      <div className="overflow-hidden rounded-xl border border-surface bg-surface">
        <div className={cn('flex items-center gap-3 border-b px-4 py-3', colors.bg, colors.border)}>
          <KeyRound className={cn('h-4 w-4 shrink-0', colors.text)} />
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-semibold', colors.text)}>Akses Role: {selectedRoleData?.label ?? selectedRole}</p>
            <p className="text-[10px] text-slate-500">R mengatur akses/menu. Jika R mati, C/U/D ikut mati.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-surface-2 bg-slate-50 dark:bg-slate-800/60">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500">Fitur</th>
                {CRUD_ACTIONS.map(({ action, label, title }) => (
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
                  <tr key={feature.id} className={cn('border-b border-surface-2 last:border-0', enabled ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'bg-slate-50/40 opacity-75 dark:bg-slate-900/30')}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('shrink-0 rounded-md border p-1.5', enabled ? 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40' : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800')}>
                          <Icon className={cn('h-3.5 w-3.5', enabled ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400')} />
                        </div>
                        <div className="min-w-0">
                          <FeatureTitleEditor feature={feature} featureLabels={featureLabels} setFeatureLabels={setFeatureLabels} />
                          <p className="font-mono text-[10px] text-slate-400">{feature.id}</p>
                        </div>
                      </div>
                    </td>
                    {CRUD_ACTIONS.map(({ action, label, title }) => {
                      const active = action === 'read' ? enabled : enabled && permission[action]
                      const disabled = action !== 'read' && !enabled
                      const key = `${selectedRole}:${feature.id}:${action}`
                      const locked = selectedRole === 'super_admin' && LOCKED_FEATURES.has(feature.id) && action === 'read' && enabled
                      return (
                        <td key={action} className="px-2 py-2.5 text-center">
                          <button
                            onClick={() => togglePermission(feature.id, action)}
                            disabled={pendingKeys.has(key) || disabled || locked}
                            title={locked ? 'Akses inti super admin tidak bisa dimatikan' : title}
                            className={cn(
                              'mx-auto flex h-8 w-8 items-center justify-center rounded-lg border text-[11px] font-black transition-all',
                              active ? 'border-emerald-700 bg-emerald-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900',
                              action === 'read' && active && 'border-blue-700 bg-blue-600',
                              (disabled || locked) && 'cursor-not-allowed opacity-45'
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
    </div>
  )
}

function TemplateSidebarView({
  features,
  sidebarTemplate,
  setSidebarTemplate,
  featureLabels,
}: {
  features: typeof MENU_ITEMS
  sidebarTemplate: SidebarGroupConfig[]
  setSidebarTemplate: Dispatch<SetStateAction<SidebarGroupConfig[]>>
  featureLabels: Record<string, string>
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const configuredIds = new Set(sidebarTemplate.flatMap(group => group.items))
  const availableItems = features.filter(item => !configuredIds.has(item.id))

  const saveTemplate = async (nextGroups: SidebarGroupConfig[]) => {
    setIsSaving(true)
    const res = await setSidebarTemplateConfig(nextGroups)
    setIsSaving(false)
    if (res?.error) {
      alert(res.error)
      return
    }
    setSidebarTemplate(res.groups || nextGroups)
  }

  const swapGroups = (index: number, offset: -1 | 1) => {
    const target = index + offset
    if (target < 0 || target >= sidebarTemplate.length) return
    const next = sidebarTemplate.map(group => ({ ...group, items: [...group.items] }))
    ;[next[index], next[target]] = [next[target], next[index]]
    saveTemplate(next)
  }

  const updateGroup = (groupId: string, patch: Partial<SidebarGroupConfig>) => {
    saveTemplate(sidebarTemplate.map(group => group.id === groupId ? { ...group, ...patch } : group))
  }

  const moveItem = (groupId: string, itemId: string, direction: 'up' | 'down') => {
    const next = sidebarTemplate.map(group => ({ ...group, items: [...group.items] }))
    const groupIndex = next.findIndex(group => group.id === groupId)
    if (groupIndex < 0) return
    const itemIndex = next[groupIndex].items.indexOf(itemId)
    if (itemIndex < 0) return

    if (direction === 'up') {
      if (itemIndex > 0) {
        ;[next[groupIndex].items[itemIndex - 1], next[groupIndex].items[itemIndex]] = [next[groupIndex].items[itemIndex], next[groupIndex].items[itemIndex - 1]]
      } else if (groupIndex > 0) {
        next[groupIndex].items.splice(itemIndex, 1)
        next[groupIndex - 1].items.push(itemId)
      }
    } else if (itemIndex < next[groupIndex].items.length - 1) {
      ;[next[groupIndex].items[itemIndex], next[groupIndex].items[itemIndex + 1]] = [next[groupIndex].items[itemIndex + 1], next[groupIndex].items[itemIndex]]
    } else if (groupIndex < next.length - 1) {
      next[groupIndex].items.splice(itemIndex, 1)
      next[groupIndex + 1].items.unshift(itemId)
    }
    saveTemplate(next)
  }

  const addGroup = () => {
    const label = newGroupLabel.trim()
    if (!label) return
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group'
    saveTemplate([...sidebarTemplate, { id: `${slug}-${Date.now().toString(36)}`, label, items: [] }])
    setNewGroupLabel('')
  }

  const resetToDefault = () => {
    if (!confirm('Kembalikan template sidebar global ke default bawaan?')) return
    saveTemplate(DEFAULT_SIDEBAR_GROUPS)
  }

  return (
    <div className="relative space-y-4 rounded-xl border border-surface bg-surface p-4">
      {isSaving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm dark:bg-slate-900/60">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Template Sidebar Global</p>
          <p className="text-[11px] text-slate-500">Ini sumber kebenaran sidebar. Role mengikuti template ini, lalu override role diterapkan setelahnya.</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetToDefault} className="h-8 rounded-lg text-xs gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Default
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={newGroupLabel}
          onChange={event => setNewGroupLabel(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && addGroup()}
          placeholder="Nama group baru..."
          className="h-9 rounded-lg text-sm"
        />
        <Button onClick={addGroup} disabled={!newGroupLabel.trim()} className="h-9 rounded-lg text-sm gap-2">
          <PlusCircle className="h-4 w-4" /> Tambah Group
        </Button>
      </div>

      <div className="space-y-3">
        {sidebarTemplate.map((group, groupIndex) => (
          <div key={group.id} className="overflow-hidden rounded-xl border border-surface-2">
            <div className="flex flex-wrap items-center gap-2 border-b border-surface-2 bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
              <Folder className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              <Input
                defaultValue={group.label}
                onBlur={event => {
                  const nextLabel = event.target.value.trim()
                  if (nextLabel && nextLabel !== group.label) updateGroup(group.id, { label: nextLabel })
                }}
                onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
                className="h-7 max-w-[240px] rounded-md text-xs font-semibold"
              />
              <span className="mr-auto text-[10px] text-slate-400">{group.items.length} menu</span>
              <IconButton title="Naikkan group" disabled={groupIndex === 0} onClick={() => swapGroups(groupIndex, -1)} icon={ArrowUp} />
              <IconButton title="Turunkan group" disabled={groupIndex === sidebarTemplate.length - 1} onClick={() => swapGroups(groupIndex, 1)} icon={ArrowDown} />
              <IconButton title="Hapus group" danger onClick={() => saveTemplate(sidebarTemplate.filter(item => item.id !== group.id))} icon={Trash2} />
            </div>
            <div className="space-y-2 p-3">
              {group.items.length === 0 ? (
                <p className="text-xs italic text-slate-400">Group kosong.</p>
              ) : group.items.map(itemId => {
                const item = MENU_ITEMS.find(menu => menu.id === itemId)
                if (!item) return null
                const Icon = item.icon
                return (
                  <div key={itemId} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{featureLabels[item.id] || item.title}</span>
                    <IconButton title="Naik" onClick={() => moveItem(group.id, itemId, 'up')} icon={ArrowUp} />
                    <IconButton title="Turun" onClick={() => moveItem(group.id, itemId, 'down')} icon={ArrowDown} />
                    <IconButton title="Lepas dari template" danger onClick={() => updateGroup(group.id, { items: group.items.filter(id => id !== itemId) })} icon={X} />
                  </div>
                )
              })}

              <Select onValueChange={itemId => itemId !== '__empty' && updateGroup(group.id, { items: [...group.items, itemId] })} value="">
                <SelectTrigger className="h-8 w-full rounded-lg border-surface-2 bg-surface text-xs sm:w-[320px]">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Plus className="h-3.5 w-3.5" /> Tambah menu ke group ini
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableItems.map(item => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">{featureLabels[item.id] || item.title}</SelectItem>
                  ))}
                  {availableItems.length === 0 && <SelectItem value="__empty" disabled className="text-xs text-slate-400">Tidak ada menu tersisa</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IconButton({
  title,
  onClick,
  icon: Icon,
  disabled,
  danger,
}: {
  title: string
  onClick: () => void
  icon: typeof ArrowUp
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded p-1 transition-colors hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800',
        danger && 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function RoleAndNavigationView({
  roles,
  setRoles,
  matrix,
  setMatrix,
  sidebarTemplate,
  featureLabels,
}: {
  roles: MasterRole[]
  setRoles: Dispatch<SetStateAction<MasterRole[]>>
  matrix: Record<string, string[]>
  setMatrix: Dispatch<SetStateAction<Record<string, string[]>>>
  sidebarTemplate: SidebarGroupConfig[]
  featureLabels: Record<string, string>
}) {
  const [selectedRole, setSelectedRole] = useState(roles[0]?.value ?? '')
  const selectedRoleData = roles.find(role => role.value === selectedRole)

  return (
    <div className="space-y-4">
      <RolePicker roles={roles} matrix={matrix} selectedRole={selectedRole} onSelect={setSelectedRole} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RoleManagerPanel roles={roles} setRoles={setRoles} matrix={matrix} setMatrix={setMatrix} />
        {selectedRoleData && (
          <MobileNavPanel
            selectedRole={selectedRoleData}
            setRoles={setRoles}
            allowedFeatures={matrix[selectedRole] || []}
            featureLabels={featureLabels}
          />
        )}
      </div>
      {selectedRoleData && (
        <RoleSidebarOverridePanel
          selectedRole={selectedRoleData}
          setRoles={setRoles}
          allowedFeatures={matrix[selectedRole] || []}
          sidebarTemplate={sidebarTemplate}
          featureLabels={featureLabels}
        />
      )}
    </div>
  )
}

function RoleManagerPanel({
  roles,
  setRoles,
  matrix,
  setMatrix,
}: {
  roles: MasterRole[]
  setRoles: Dispatch<SetStateAction<MasterRole[]>>
  matrix: Record<string, string[]>
  setMatrix: Dispatch<SetStateAction<Record<string, string[]>>>
}) {
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleLabelChange = (value: string) => {
    setNewLabel(value)
    setNewValue(value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  }

  const handleCreate = () => {
    if (!newLabel.trim() || !newValue.trim()) return
    setError('')
    setMessage('')
    startTransition(async () => {
      const res = await createCustomRole(newLabel, newValue)
      if (res?.error) {
        setError(res.error)
        return
      }
      const newRole: MasterRole = { value: res.slug!, label: newLabel.trim(), is_custom: 1, mobile_nav_links: '[]', sidebar_config: '' }
      setRoles(prev => [...prev, newRole])
      setMatrix(prev => ({ ...prev, [res.slug!]: [] }))
      setNewLabel('')
      setNewValue('')
      setMessage(`Role "${newRole.label}" berhasil dibuat.`)
    })
  }

  const handleEdit = (roleValue: string) => {
    setError('')
    setMessage('')
    startTransition(async () => {
      const res = await editCustomRole(roleValue, editLabel)
      if (res?.error) {
        setError(res.error)
        return
      }
      setRoles(prev => prev.map(role => role.value === roleValue ? { ...role, label: editLabel.trim() } : role))
      setEditingRole(null)
      setMessage('Label role berhasil diperbarui.')
    })
  }

  const handleDelete = (role: MasterRole) => {
    if (!confirm(`Hapus role "${role.label}"?\n\nSemua mapping fitur untuk role ini juga akan dihapus.`)) return
    setError('')
    setMessage('')
    startTransition(async () => {
      const res = await deleteCustomRole(role.value)
      if (res?.error) {
        setError(res.error)
        return
      }
      setRoles(prev => prev.filter(item => item.value !== role.value))
      setMatrix(prev => {
        const next = { ...prev }
        delete next[role.value]
        return next
      })
      setMessage(`Role "${role.label}" berhasil dihapus.`)
    })
  }

  return (
    <div className="rounded-xl border border-surface bg-surface">
      <div className="flex items-center gap-2 border-b border-surface-2 px-4 py-3">
        <Tag className="h-4 w-4 text-violet-500" />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Kelola Role</p>
          <p className="text-[10px] text-slate-400">{roles.length} role tersedia</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {error && <StatusMessage error text={error} />}
        {message && <StatusMessage text={message} />}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input value={newLabel} onChange={event => handleLabelChange(event.target.value)} placeholder="Nama role baru" className="h-9 rounded-lg text-sm" />
          <Input value={newValue} onChange={event => setNewValue(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="id_role" className="h-9 rounded-lg font-mono text-sm" />
        </div>
        <Button onClick={handleCreate} disabled={isPending || !newLabel.trim() || !newValue.trim()} className="h-9 rounded-lg text-sm gap-2">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />} Buat Role
        </Button>
        <div className="max-h-[320px] overflow-y-auto rounded-lg border border-surface-2">
          {roles.map(role => (
            <div key={role.value} className="flex items-center gap-3 border-b border-surface-2 px-3 py-2.5 last:border-0">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', roleColors(role).dot)} />
              {editingRole === role.value ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Input value={editLabel} onChange={event => setEditLabel(event.target.value)} className="h-8 rounded-md text-sm" autoFocus />
                  <Button size="sm" onClick={() => handleEdit(role.value)} disabled={isPending || !editLabel.trim()} className="h-8 rounded-md text-xs">Simpan</Button>
                  <IconButton title="Batal" onClick={() => setEditingRole(null)} icon={X} />
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{role.label}</p>
                    <p className="truncate font-mono text-[10px] text-slate-400">{role.value} · {matrix[role.value]?.length || 0} fitur</p>
                  </div>
                  <IconButton title="Edit nama" onClick={() => { setEditingRole(role.value); setEditLabel(role.label) }} icon={Pencil} />
                  {role.is_custom === 1 && <IconButton title="Hapus role" danger onClick={() => handleDelete(role)} icon={Trash2} />}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusMessage({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs', error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
      {error ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <Check className="h-3.5 w-3.5 shrink-0" />}
      {text}
    </div>
  )
}

function MobileNavPanel({
  selectedRole,
  setRoles,
  allowedFeatures,
  featureLabels,
}: {
  selectedRole: MasterRole
  setRoles: Dispatch<SetStateAction<MasterRole[]>>
  allowedFeatures: string[]
  featureLabels: Record<string, string>
}) {
  const [isSaving, setIsSaving] = useState(false)
  const currentNavLinks = parseNavLinks(selectedRole.mobile_nav_links)
  const allowedSet = new Set(allowedFeatures)

  const updateNavLinks = async (nextLinks: string[]) => {
    setIsSaving(true)
    const res = await setRoleMobileNav(selectedRole.value, nextLinks)
    setIsSaving(false)
    if (res?.error) {
      alert(res.error)
      return
    }
    setRoles(prev => prev.map(role => role.value === selectedRole.value ? { ...role, mobile_nav_links: JSON.stringify(nextLinks) } : role))
  }

  const addNavLink = (featureId: string) => {
    if (featureId === '__empty') return
    if (currentNavLinks.length >= 5) {
      alert('Maksimal 5 menu navigasi agar tidak padat di layar mobile.')
      return
    }
    if (!currentNavLinks.includes(featureId)) updateNavLinks([...currentNavLinks, featureId])
  }

  return (
    <div className="relative rounded-xl border border-surface bg-surface">
      {isSaving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm dark:bg-slate-900/60">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-surface-2 px-4 py-3">
        <Smartphone className="h-4 w-4 text-violet-500" />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bottom Nav: {selectedRole.label}</p>
          <p className="text-[10px] text-slate-400">Maksimal 5 jalan pintas layar HP.</p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {currentNavLinks.length === 0 ? (
            <p className="text-xs italic text-slate-400">Belum ada jalan pintas.</p>
          ) : currentNavLinks.map((id, index) => {
            const item = MENU_ITEMS.find(menu => menu.id === id)
            const revoked = !allowedSet.has(id)
            return (
              <div key={id} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5', revoked ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-blue-200 bg-blue-50 text-blue-800')}>
                <span className="w-3 text-[10px] font-bold opacity-50">{index + 1}.</span>
                <span className="text-xs font-medium">{item ? (featureLabels[item.id] || item.title) : id}</span>
                {revoked && <AlertCircle className="h-3 w-3" />}
                <button onClick={() => updateNavLinks(currentNavLinks.filter(link => link !== id))} className="ml-1 text-slate-400 hover:text-rose-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
        <Select onValueChange={addNavLink} value="" disabled={currentNavLinks.length >= 5}>
          <SelectTrigger className="h-9 w-full rounded-lg border-surface-2 bg-surface text-xs sm:w-[320px]">
            <div className="flex items-center gap-2 text-slate-500">
              <Plus className="h-3.5 w-3.5" /> {currentNavLinks.length >= 5 ? 'Kapasitas penuh' : 'Pilih fitur yang diizinkan'}
            </div>
          </SelectTrigger>
          <SelectContent>
            {MENU_ITEMS.filter(item => allowedSet.has(item.id) && !currentNavLinks.includes(item.id)).map(item => (
              <SelectItem key={item.id} value={item.id} className="text-xs">{featureLabels[item.id] || item.title}</SelectItem>
            ))}
            {MENU_ITEMS.filter(item => allowedSet.has(item.id) && !currentNavLinks.includes(item.id)).length === 0 && (
              <SelectItem value="__empty" disabled className="text-xs text-slate-400">Tidak ada fitur tersisa</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function RoleSidebarOverridePanel({
  selectedRole,
  setRoles,
  allowedFeatures,
  sidebarTemplate,
  featureLabels,
}: {
  selectedRole: MasterRole
  setRoles: Dispatch<SetStateAction<MasterRole[]>>
  allowedFeatures: string[]
  sidebarTemplate: SidebarGroupConfig[]
  featureLabels: Record<string, string>
}) {
  const [isSaving, setIsSaving] = useState(false)
  const override = parseSidebarRoleOverride(selectedRole.sidebar_config)
  const effectiveGroups = resolveSidebarGroups(sidebarTemplate, selectedRole.sidebar_config, allowedFeatures)
  const visibleIds = new Set(effectiveGroups.flatMap(group => group.items))
  const hiddenIds = new Set(override.hiddenItemIds || [])

  const saveOverride = async (nextOverride: SidebarRoleOverrideConfig) => {
    setIsSaving(true)
    const cleanOverride = normalizeSidebarRoleOverride(nextOverride)
    const res = await setRoleSidebarConfig(selectedRole.value, cleanOverride)
    setIsSaving(false)
    if (res?.error) {
      alert(res.error)
      return
    }
    setRoles(prev => prev.map(role => role.value === selectedRole.value ? { ...role, sidebar_config: res.groupsJson } : role))
  }

  const setGroupLabel = (groupId: string, label: string) => {
    saveOverride({
      ...override,
      groupLabels: {
        ...(override.groupLabels || {}),
        [groupId]: label,
      },
    })
  }

  const moveItem = (groupId: string, itemId: string, direction: 'up' | 'down') => {
    const nextGroups = effectiveGroups.map(group => ({ ...group, items: [...group.items] }))
    const groupIndex = nextGroups.findIndex(group => group.id === groupId)
    if (groupIndex < 0) return
    const itemIndex = nextGroups[groupIndex].items.indexOf(itemId)
    if (itemIndex < 0) return
    if (direction === 'up') {
      if (itemIndex > 0) {
        ;[nextGroups[groupIndex].items[itemIndex - 1], nextGroups[groupIndex].items[itemIndex]] = [nextGroups[groupIndex].items[itemIndex], nextGroups[groupIndex].items[itemIndex - 1]]
      } else if (groupIndex > 0) {
        nextGroups[groupIndex].items.splice(itemIndex, 1)
        nextGroups[groupIndex - 1].items.push(itemId)
      }
    } else if (itemIndex < nextGroups[groupIndex].items.length - 1) {
      ;[nextGroups[groupIndex].items[itemIndex], nextGroups[groupIndex].items[itemIndex + 1]] = [nextGroups[groupIndex].items[itemIndex + 1], nextGroups[groupIndex].items[itemIndex]]
    } else if (groupIndex < nextGroups.length - 1) {
      nextGroups[groupIndex].items.splice(itemIndex, 1)
      nextGroups[groupIndex + 1].items.unshift(itemId)
    }
    saveOverride({
      ...override,
      groupOrder: nextGroups.map(group => group.id),
      groupLabels: {
        ...Object.fromEntries(nextGroups.map(group => [group.id, group.label])),
        ...(override.groupLabels || {}),
      },
      itemPlacements: Object.fromEntries(nextGroups.map(group => [group.id, group.items])),
    })
  }

  const toggleHiddenItem = (itemId: string) => {
    const nextHidden = hiddenIds.has(itemId)
      ? (override.hiddenItemIds || []).filter(id => id !== itemId)
      : [...(override.hiddenItemIds || []), itemId]
    saveOverride({ ...override, hiddenItemIds: nextHidden })
  }

  const clearOverride = () => {
    if (!confirm(`Hapus semua override sidebar untuk role "${selectedRole.label}" dan ikuti template global sepenuhnya?`)) return
    saveOverride({})
  }

  return (
    <div className="relative rounded-xl border border-surface bg-surface p-4">
      {isSaving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm dark:bg-slate-900/60">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Override Sidebar: {selectedRole.label}</p>
          <p className="text-[11px] text-slate-500">Role ini tetap mengikuti template global. Perubahan di sini hanya pengecualian role.</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearOverride} className="h-8 rounded-lg text-xs gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Ikuti Template
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {effectiveGroups.map(group => (
            <div key={group.id} className="overflow-hidden rounded-xl border border-surface-2">
              <div className="flex flex-wrap items-center gap-2 border-b border-surface-2 bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
                <Folder className="h-3.5 w-3.5 text-violet-500" />
                <Input
                  defaultValue={group.label}
                  onBlur={event => {
                    const label = event.target.value.trim()
                    if (label && label !== group.label) setGroupLabel(group.id, label)
                  }}
                  onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
                  className="h-7 max-w-[240px] rounded-md text-xs font-semibold"
                />
                <span className="text-[10px] text-slate-400">{group.items.length} menu</span>
              </div>
              <div className="space-y-2 p-3">
                {group.items.map(itemId => {
                  const item = MENU_ITEMS.find(menu => menu.id === itemId)
                  if (!item) return null
                  const Icon = item.icon
                  return (
                    <div key={itemId} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{featureLabels[item.id] || item.title}</span>
                      <IconButton title="Naik" onClick={() => moveItem(group.id, itemId, 'up')} icon={ArrowUp} />
                      <IconButton title="Turun" onClick={() => moveItem(group.id, itemId, 'down')} icon={ArrowDown} />
                      <IconButton title="Sembunyikan untuk role ini" danger onClick={() => toggleHiddenItem(itemId)} icon={X} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-surface-2 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Menu tersembunyi role ini</p>
          <div className="space-y-2">
            {allowedFeatures.filter(id => hiddenIds.has(id)).length === 0 ? (
              <p className="text-xs italic text-slate-400">Tidak ada menu yang disembunyikan.</p>
            ) : allowedFeatures.filter(id => hiddenIds.has(id)).map(id => {
              const item = MENU_ITEMS.find(menu => menu.id === id)
              return (
                <button key={id} onClick={() => toggleHiddenItem(id)} className="flex w-full items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-left text-xs text-rose-700">
                  <span className="truncate">{item ? (featureLabels[item.id] || item.title) : id}</span>
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                </button>
              )
            })}
          </div>
          <div className="mt-4 border-t border-surface-2 pt-3">
            <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Allowed tapi tidak tampil</p>
            <div className="space-y-2">
              {allowedFeatures.filter(id => !visibleIds.has(id) && !hiddenIds.has(id)).length === 0 ? (
                <p className="text-xs italic text-slate-400">Tidak ada.</p>
              ) : allowedFeatures.filter(id => !visibleIds.has(id) && !hiddenIds.has(id)).map(id => {
                const item = MENU_ITEMS.find(menu => menu.id === id)
                return (
                  <button key={id} onClick={() => toggleHiddenItem(id)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-2.5 py-2 text-left text-xs">
                    <span className="truncate">{item ? (featureLabels[item.id] || item.title) : id}</span>
                    <X className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
