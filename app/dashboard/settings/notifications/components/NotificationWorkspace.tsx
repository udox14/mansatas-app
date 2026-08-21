'use client'

import { useState } from 'react'
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
  const [activeTab, setActiveTab] = useState('automatic')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 space-y-4">
      <TabsList aria-label="Bagian pengaturan notifikasi" className="grid h-auto w-full grid-cols-3 p-1">
        <TabsTrigger value="automatic" className="min-w-0 gap-1.5 px-2 py-2.5 sm:gap-2 sm:px-3">
          <Bell className="h-4 w-4" />
          <span className="truncate">Otomatis</span>
        </TabsTrigger>
        <TabsTrigger value="broadcast" className="min-w-0 gap-1.5 px-2 py-2.5 sm:gap-2 sm:px-3">
          <Send className="h-4 w-4" />
          <span className="truncate">Broadcast</span>
        </TabsTrigger>
        <TabsTrigger value="devices" className="min-w-0 gap-1.5 px-2 py-2.5 sm:gap-2 sm:px-3">
          <Monitor className="h-4 w-4" />
          <span className="truncate">Perangkat</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="automatic" className="min-w-0 mt-0">
        <AutomaticNotificationSettings definitions={definitions} settings={settings} />
      </TabsContent>

      <TabsContent value="broadcast" className="min-w-0 mt-0">
        <NotificationClient roles={roles} allUsers={allUsers} />
      </TabsContent>

      <TabsContent value="devices" className="min-w-0 mt-0">
        <NotificationDevices roles={roles} allUsers={allUsers} diagnostics={diagnostics} />
      </TabsContent>
    </Tabs>
  )
}
