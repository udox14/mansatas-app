'use client'

import { useActionState, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { AlertCircle, CheckCircle2, Filter, Search, Send, Users } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DataPagination } from '@/components/ui/data-pagination'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { sendBroadcast, sendCustomNotification } from '../actions'

export type NotificationUserItem = {
  id: string
  nama_lengkap: string
  role: string
  all_roles: string[]
}

export type NotificationRoleOption = {
  value: string
  label: string
}

export type NotificationDiagnostics = {
  totalDevices: number
  vapidKey: string
  subscribedUserIds: string[]
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin_tu: 'Admin TU',
  kepsek: 'Kepala Madrasah',
  wakamad: 'Wakamad',
  guru: 'Guru',
  guru_bk: 'Guru BK',
  guru_piket: 'Guru Piket',
  wali_kelas: 'Wali Kelas',
  resepsionis: 'Resepsionis',
  guru_ppl: 'Guru PPL',
  guru_tahfidz: 'Guru Tahfidz',
}

export function getRoleLabel(role: string) {
  return ROLE_LABEL[role] || role
}

function SubmitBtn() {
  return (
    <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700">
      <Send className="h-4 w-4" />
      Kirim Broadcast Notifikasi
    </Button>
  )
}

function BroadcastSubmitBtn() {
  return (
    <Button type="submit" className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
      <Send className="h-4 w-4" />
      Kirim Broadcast ke Audience
    </Button>
  )
}

function ActionFeedback({ state }: { state: any }) {
  const message = state?.error || state?.success
  if (!message) return null

  const error = Boolean(state?.error)
  return (
    <Alert variant={error ? 'destructive' : 'default'} className={error ? '' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'}>
      {error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function RecipientTable({
  allUsers,
  roles,
  selectedIds,
  setSelectedIds,
}: {
  allUsers: NotificationUserItem[]
  roles: NotificationRoleOption[]
  selectedIds: Set<string>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
}) {
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('_all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number | 'semua'>(25)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allUsers.filter((user) => {
      const matchesRole = filterRole === '_all' || user.all_roles.includes(filterRole)
      const matchesSearch = !query || [
        user.nama_lengkap,
        user.role,
        getRoleLabel(user.role),
        ...user.all_roles.map(getRoleLabel),
      ].some((value) => value.toLowerCase().includes(query))
      return matchesRole && matchesSearch
    })
  }, [allUsers, filterRole, search])

  const visibleUsers = useMemo(() => {
    if (pageSize === 'semua') return filtered
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const allFilteredIds = filtered.map((user) => user.id)
  const allChecked = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id))
  const someChecked = allFilteredIds.some((id) => selectedIds.has(id))

  const toggleAll = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (allChecked) {
        allFilteredIds.forEach((id) => next.delete(id))
      } else {
        allFilteredIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const toggle = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const updateRole = (value: string) => {
    setFilterRole(value)
    setPage(1)
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/10 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Cari nama atau role..."
            className="pl-9"
            aria-label="Cari penerima broadcast"
          />
        </div>
        <Select value={filterRole} onValueChange={updateRole}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Semua role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Semua role</SelectItem>
            {roles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <label className="flex items-center gap-2 font-medium">
          <Checkbox
            checked={allChecked ? true : someChecked ? 'indeterminate' : false}
            onCheckedChange={toggleAll}
            aria-label="Pilih semua penerima hasil filter"
          />
          Pilih semua hasil filter ({filtered.length})
        </label>
        <span>{selectedIds.size} penerima dipilih</span>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Nama</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-20 text-center text-sm text-muted-foreground">
                  Tidak ada pengguna yang sesuai.
                </TableCell>
              </TableRow>
            ) : visibleUsers.map((user) => (
              <TableRow key={user.id} data-state={selectedIds.has(user.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(user.id)}
                    onCheckedChange={() => toggle(user.id)}
                    aria-label={`Pilih ${user.nama_lengkap}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{user.nama_lengkap}</TableCell>
                <TableCell className="text-muted-foreground">{getRoleLabel(user.role)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DataPagination
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        entityLabel="pengguna"
      />
    </div>
  )
}

export function NotificationClient({ roles = [], allUsers = [] }: {
  roles: NotificationRoleOption[]
  allUsers: NotificationUserItem[]
}) {
  const [state, action] = useActionState(sendCustomNotification, {} as any)
  const [bcState, bcAction] = useActionState(sendBroadcast, {} as any)
  const [targetType, setTargetType] = useState('all')
  const [targetRole, setTargetRole] = useState(roles[0]?.value || '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(allUsers.map((user) => user.id)))

  const handleTargetTypeChange = (value: string) => {
    setTargetType(value)
    if (value === 'all') {
      setSelectedIds(new Set(allUsers.map((user) => user.id)))
    } else if (value === 'role') {
      setSelectedIds(new Set(allUsers.filter((user) => user.all_roles.includes(targetRole)).map((user) => user.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleTargetRoleChange = (value: string) => {
    setTargetRole(value)
    setSelectedIds(new Set(allUsers.filter((user) => user.all_roles.includes(value)).map((user) => user.id)))
  }

  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="grid h-auto w-full max-w-xl grid-cols-2">
        <TabsTrigger value="general" className="gap-2 py-2.5">
          <Send className="h-4 w-4" />
          Broadcast umum
        </TabsTrigger>
        <TabsTrigger value="staff" className="gap-2 py-2.5">
          <Users className="h-4 w-4" />
          Broadcast pegawai
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" forceMount className="mt-0">
        <Card className="border-surface shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-5 w-5 text-emerald-600" />
              Broadcast umum
            </CardTitle>
            <CardDescription className="text-xs leading-5">
              Kirim ke pegawai, orang tua, atau keduanya. Pegawai memakai VAPID + FCM; orang tua memakai FCM dan tetap mendapat fallback di portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={bcAction} className="space-y-5" encType="multipart/form-data">
              <ActionFeedback state={bcState} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="broadcast-title">Judul</Label>
                  <Input id="broadcast-title" name="title" required placeholder="Contoh: Libur semester" />
                </div>
                <div className="space-y-2">
                  <Label>Penerima</Label>
                  <Select name="audience" defaultValue="all">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua (Pegawai + Orang Tua)</SelectItem>
                      <SelectItem value="staff">Pegawai saja</SelectItem>
                      <SelectItem value="parents">Orang Tua saja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="broadcast-body">Isi pesan</Label>
                <Textarea id="broadcast-body" name="body" required rows={5} placeholder="Tulis pesan..." className="resize-y" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="broadcast-url">URL tujuan</Label>
                  <Input id="broadcast-url" name="url" defaultValue="/dashboard" placeholder="/dashboard" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="broadcast-image">Gambar (opsional, maks. 2MB)</Label>
                  <Input id="broadcast-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="file:text-xs" />
                </div>
              </div>

              <BroadcastSubmitBtn />
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="staff" forceMount className="mt-0">
        <Card className="border-surface shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-blue-600" />
              Broadcast pegawai
            </CardTitle>
            <CardDescription className="text-xs leading-5">
              Pilih semua pegawai, berdasarkan role, atau tentukan penerima secara manual. Daftar penerima menggunakan pagination agar halaman tidak memiliki scroll ganda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={(formData) => {
                // Backend menerima targetUserIds sebagai sumber kebenaran untuk mode targeted.
                formData.set('targetType', 'custom')
                formData.set('targetUserIds', JSON.stringify([...selectedIds]))
                return action(formData)
              }}
              className="space-y-5"
            >
              <ActionFeedback state={state} />

              <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,220px)_1fr]">
                <div className="space-y-2">
                  <Label>Preset target</Label>
                  <Select value={targetType} onValueChange={handleTargetTypeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua pegawai</SelectItem>
                      <SelectItem value="role">Berdasarkan role</SelectItem>
                      <SelectItem value="custom">Pilih manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {targetType === 'role' && (
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={targetRole} onValueChange={handleTargetRoleChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className={cn('flex items-end pb-1 text-sm text-muted-foreground', targetType !== 'role' && 'md:col-span-2')}>
                  <span>{selectedIds.size} penerima dipilih</span>
                </div>
              </div>

              <RecipientTable
                allUsers={allUsers}
                roles={roles}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="targeted-broadcast-title">Judul notifikasi</Label>
                  <Input id="targeted-broadcast-title" name="title" required placeholder="Contoh: Pengumuman rapat dinas" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="targeted-broadcast-body">Isi pesan</Label>
                  <Textarea id="targeted-broadcast-body" name="body" required rows={5} placeholder="Tulis pesan lengkap..." className="resize-y" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="targeted-broadcast-url">URL tujuan (internal path)</Label>
                  <Input id="targeted-broadcast-url" name="url" defaultValue="/dashboard" placeholder="/dashboard" />
                </div>
              </div>

              <SubmitBtn />
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
