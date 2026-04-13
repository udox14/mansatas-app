import { getCurrentUser } from '@/utils/auth/server';
import { redirect } from 'next/navigation';
import { NotificationClient } from './components/NotificationClient';
import { checkFeatureAccess } from '@/lib/features';
import { getDB } from '@/utils/db';
import { ALL_ROLES } from '@/config/menu';
import { PageHeader } from '@/components/layout/page-header';
import { getAllUsersForCheckbox } from '@/app/dashboard/rapat/actions';

export const dynamic = 'force-dynamic'

export default async function AdminNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const db = await getDB();
  const allowed = await checkFeatureAccess(db, user.id, 'settings-notifications');
  
  if (!allowed) {
    redirect('/dashboard');
  }

  const totalDevicesQuery = await db.prepare('SELECT COUNT(*) as count FROM web_push_subscriptions').first<{count: number}>() || {count: 0};
  const subscriptions = await db.prepare('SELECT DISTINCT user_id FROM web_push_subscriptions').all<{user_id: string}>();
  const subscribedUserIds = (subscriptions.results || []).map(r => r.user_id);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'N/A';
  const allUsers = await getAllUsersForCheckbox();

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Broadcast Notifikasi"
        description="Kirim pemberitahuan push langsung ke perangkat pengguna."
      />

      <NotificationClient 
        roles={[...ALL_ROLES]}
        allUsers={allUsers}
        diagnostics={{
          totalDevices: totalDevicesQuery.count,
          subscribedUserIds: subscribedUserIds,
          vapidKey: vapidKey
        }}
      />
    </div>
  );
}
