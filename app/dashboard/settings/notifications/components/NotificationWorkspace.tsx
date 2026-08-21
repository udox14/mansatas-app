'use client'

import { Bell, Monitor, Send } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NotificationEventDefinition } from '@/lib/notification-catalog'
import { AutomaticNotificationSettings } from './AutomaticNotificationSettings'
import { NotificationClient, type NotificationDiagnostics, type NotificationRoleOption, type NotificationUserItem } from './NotificationClient'
import { NotificationDevices } from './NotificationDevices'

type NotificationSettingRow = {
  event_key: string
  enabled: number
  title_template: string
  body_template: string
  url_template: string
  channels_json: string
  target_json: string
  reminder_json: string
  level: string
}

export function NotificationWorkspace({
  definitions,
  settings,
  roles,
  allUsers,
  diagnostics,
}: {
  definitions: NotificationEventDefinition[]
  settings: NotificationSettingRow[]
  roles: NotificationRoleOption[]
  allUsers: NotificationUserItem[]
  diagnostics: NotificationDiagnostics
}) {
  return (
    <Tabs defaultValue="automatic" className="space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-3">
        <TabsTrigger value="automatic" className="gap-2 py-2.5">
          <Bell className="h-4 w-4" />
          Otomatis
        </TabsTrigger>
        <TabsTrigger value="broadcast" className="gap-2 py-2.5">
          <Send className="h-4 w-4" />
          Broadcast
        </TabsTrigger>
        <TabsTrigger value="devices" className="gap-2 py-2.5">
          <Monitor className="h-4 w-4" />
          Perangkat
        </TabsTrigger>
      </TabsList>

      <TabsContent value="automatic" forceMount className="mt-0">
        <AutomaticNotificationSettings definitions={definitions} settings={settings} />
      </TabsContent>

      <TabsContent value="broadcast" forceMount className="mt-0">
        <NotificationClient roles={roles} allUsers={allUsers} />
      </TabsContent>

      <TabsContent value="devices" forceMount className="mt-0">
        <NotificationDevices roles={roles} allUsers={allUsers} diagnostics={diagnostics} />
      </TabsContent>
    </Tabs>
  )
}
