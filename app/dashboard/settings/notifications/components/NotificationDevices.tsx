'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Filter, Key, Monitor, Search, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataPagination } from '@/components/ui/data-pagination'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NotificationDiagnostics, NotificationRoleOption, NotificationUserItem } from './NotificationClient'
import { getRoleLabel } from './NotificationClient'

export function NotificationDevices({
  roles,
  allUsers,
  diagnostics,
}: {
  roles: NotificationRoleOption[]
  allUsers: NotificationUserItem[]
  diagnostics: NotificationDiagnostics
}) {
  const [statusTab, setStatusTab] = useState<'sudah' | 'belum'>('sudah')
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('_all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number | 'semua'>(25)

  const subscribedUserIds = useMemo(() => new Set(diagnostics.subscribedUserIds), [diagnostics.subscribedUserIds])
  const subscribedUsers = useMemo(() => allUsers.filter((user) => subscribedUserIds.has(user.id)), [allUsers, subscribedUserIds])
  const unsubscribedUsers = useMemo(() => allUsers.filter((user) => !subscribedUserIds.has(user.id)), [allUsers, subscribedUserIds])
  const statusUsers = statusTab === 'sudah' ? subscribedUsers : unsubscribedUsers

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return statusUsers.filter((user) => {
      const matchesRole = filterRole === '_all' || user.all_roles.includes(filterRole)
      const matchesSearch = !query || [
        user.nama_lengkap,
        user.role,
        getRoleLabel(user.role),
        ...user.all_roles.map(getRoleLabel),
      ].some((value) => value.toLowerCase().includes(query))
      return matchesRole && matchesSearch
    })
  }, [filterRole, search, statusUsers])

  const visibleUsers = useMemo(() => {
    if (pageSize === 'semua') return filteredUsers
    const start = (page - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, page, pageSize])

  const setSearchAndReset = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const setRoleAndReset = (value: string) => {
    setFilterRole(value)
    setPage(1)
  }

  const setStatusAndReset = (value: string) => {
    setStatusTab(value as 'sudah' | 'belum')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-surface shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total device</p>
              <p className="text-2xl font-semibold">{diagnostics.totalDevices}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-surface shadow-none">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Akun aktif</p>
              <p className="text-2xl font-semibold">{subscribedUsers.length}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {allUsers.length}</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-surface shadow-none">
          <CardContent className="flex min-w-0 items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
              <Key className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Status VAPID</p>
              <Badge variant={diagnostics.vapidKey === 'N/A' ? 'destructive' : 'secondary'} className="mt-1">
                {diagnostics.vapidKey === 'N/A' ? 'Belum dikonfigurasi' : 'Terkonfigurasi'}
              </Badge>
              <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={diagnostics.vapidKey}>
                {diagnostics.vapidKey}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-surface shadow-none">
        <CardHeader className="gap-4 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Monitor className="h-5 w-5 text-slate-600" />
              Status perangkat pengguna
            </CardTitle>
            <CardDescription className="mt-1 text-xs leading-5">
              Pantau akun yang sudah mengaktifkan push notification dan akun yang belum memiliki subscription aktif.
            </CardDescription>
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearchAndReset(event.target.value)}
                placeholder="Cari nama atau role..."
                className="pl-9"
                aria-label="Cari status perangkat"
              />
            </div>
            <Select value={filterRole} onValueChange={setRoleAndReset}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Semua role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Semua role</SelectItem>
                {roles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={statusTab} onValueChange={setStatusAndReset}>
            <TabsList className="grid h-auto w-full max-w-xl grid-cols-2">
              <TabsTrigger value="sudah" className="gap-2 py-2.5">
                <CheckCircle2 className="h-4 w-4" />
                Sudah mengaktifkan ({subscribedUsers.length})
              </TabsTrigger>
              <TabsTrigger value="belum" className="gap-2 py-2.5">
                <AlertCircle className="h-4 w-4" />
                Belum mengaktifkan ({unsubscribedUsers.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-sm text-muted-foreground">
                    Tidak ada data yang sesuai.
                  </TableCell>
                </TableRow>
              ) : visibleUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.nama_lengkap}</TableCell>
                  <TableCell className="text-muted-foreground">{getRoleLabel(user.role)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusTab === 'sudah'
                        ? 'gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}
                    >
                      {statusTab === 'sudah' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      {statusTab === 'sudah' ? 'Aktif' : 'Belum aktif'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <DataPagination
            total={filteredUsers.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            entityLabel="akun"
          />
        </CardContent>
      </Card>
    </div>
  )
}
