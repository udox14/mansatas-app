import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { readFileSync } from 'node:fs'

const runtime = vi.hoisted(() => ({ db:null as unknown as D1Database,userId:'wali',roles:['wali_kelas'] }))
vi.mock('./schema-guard', () => ({ensureSchemaOnce:async (_key:string,ensure:()=>Promise<unknown>)=>ensure()}))
vi.mock('@/utils/db-server', () => ({getDB:async()=>runtime.db}))
vi.mock('@/utils/auth/server', () => ({getCurrentUser:async()=>runtime.userId ? {id:runtime.userId} : null}))
vi.mock('@/lib/features', () => ({getUserRoles:async()=>runtime.roles}))
vi.mock('next/cache', () => ({revalidatePath:vi.fn()}))
vi.mock('next/navigation', () => ({redirect:(url:string)=>{throw new Error(`redirect:${url}`)}}))
import { getStaffInbox, getUnreadStaffNotificationCount, readStaffNotification, staffNotificationHref, writeStaffNotifications } from './staff-notification-inbox'
import { openStaffNotification } from '@/app/dashboard/kelas-binaan/notifikasi/actions'
import { ATTENDANCE_CORRECTION_RESULT_EVENT, KELAS_BINAAN_NOTIFICATION_EVENTS, LEGACY_KELAS_BINAAN_NOTIFICATION_EVENTS } from './notification-catalog'

let sqlite: DatabaseSync
beforeEach(() => {
  runtime.userId='wali'; runtime.roles=['wali_kelas']
  sqlite=new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE "user" (id TEXT PRIMARY KEY); INSERT INTO "user" VALUES (\'wali\'),(\'other\');')
  function prepared(sql:string,args:SQLInputValue[]=[]):any {
    return {bind:(...values:SQLInputValue[])=>prepared(sql,values),run:async()=>sqlite.prepare(sql).run(...args),
      all:async()=>({results:sqlite.prepare(sql).all(...args)}),first:async()=>sqlite.prepare(sql).get(...args) || null,
      execute:()=>sqlite.prepare(sql).run(...args)}
  }
  runtime.db={prepare:prepared,batch:async(statements:any[])=>{sqlite.exec('BEGIN');try{const rows=statements.map(s=>s.execute());sqlite.exec('COMMIT');return rows}catch(error){sqlite.exec('ROLLBACK');throw error}}} as unknown as D1Database
})
afterEach(()=>sqlite.close())
const url='/dashboard/kelas-binaan/koreksi?siswa=s&tanggal=2026-10-06&penugasan=math'
const write=(source='session',ids=['wali'])=>writeStaffNotifications(runtime.db,ids,'attendance_homeroom_alert',source,'Catatan kehadiran','Belum hadir pada sesi ini',url,'info')

describe('durable staff notification inbox',()=>{
  it('includes every student/homeroom event but excludes teacher reminders from lists, counts and open actions',async()=>{
    for(const event of KELAS_BINAAN_NOTIFICATION_EVENTS) {
      await writeStaffNotifications(runtime.db,['wali'],event,event,'Laporan siswa','Catatan siswa',url,'info')
    }
    for(const event of ['kbm_teaching_reminder','attendance_missing_reminder','grade_incomplete_reminder','meeting_invitation','komite_review_pending_reminder','homeroom_unknown_event']) {
      // A misleading class URL or title must not classify an unrelated event.
      await writeStaffNotifications(runtime.db,['wali'],event,event,'Laporan siswa','Agenda guru',url,'info')
    }
    const inbox=await getStaffInbox(runtime.db,'wali')
    expect(inbox.items.map(item=>item.event_key).sort()).toEqual([...KELAS_BINAAN_NOTIFICATION_EVENTS].sort())
    expect(inbox.unreadCount).toBe(KELAS_BINAAN_NOTIFICATION_EVENTS.length)
    expect(await getUnreadStaffNotificationCount(runtime.db,'wali')).toBe(inbox.unreadCount)
    expect((await getStaffInbox(runtime.db,'wali',{unread:true})).items).toHaveLength(inbox.unreadCount)
    const unrelated=sqlite.prepare('SELECT id FROM staff_notifications WHERE event_key=?').get('kbm_teaching_reminder')!
    expect(await readStaffNotification(runtime.db,'wali',String(unrelated.id))).toBeNull()
    const form=new FormData();form.set('id',String(unrelated.id))
    await expect(openStaffNotification(form)).rejects.toThrow('redirect:/dashboard/kelas-binaan/notifikasi')
    expect(sqlite.prepare('SELECT read_at FROM staff_notifications WHERE id=?').get(unrelated.id as string)?.read_at).toBeNull()
  })

  it('filters before pagination so unrelated records do not hide student reports',async()=>{
    for(let i=0;i<24;i++) {
      await write(`student-${i}`)
      await writeStaffNotifications(runtime.db,['wali'],'kbm_teaching_reminder',`teacher-${i}`,'Agenda','Isi agenda','/dashboard/agenda','info')
    }
    const first=await getStaffInbox(runtime.db,'wali')
    const last=await getStaffInbox(runtime.db,'wali',{before:first.nextCursor!})
    expect(first.items).toHaveLength(20);expect(last.items).toHaveLength(4)
    expect(first.unreadCount).toBe(24)
    expect(new Set([...first.items,...last.items].map(item=>item.id)).size).toBe(24)
    expect(last.nextCursor).toBeNull()
  })

  it('adds in-app to class event settings without touching teacher reminders, templates or history',async()=>{
    sqlite.exec(readFileSync(new URL('../migrations/0086_add_notification_engine.sql',import.meta.url),'utf8'))
    for(const event of [...KELAS_BINAAN_NOTIFICATION_EVENTS,'kbm_teaching_reminder']) {
      sqlite.prepare('INSERT INTO notification_event_settings (event_key,title_template,body_template,channels_json) VALUES (?,?,?,?)')
        .run(event,'Judul custom','Isi custom','["fcm"]')
    }
    const migration=readFileSync(new URL('../migrations/0119_kelas_binaan_notification_channels.sql',import.meta.url),'utf8')
    sqlite.exec(migration);sqlite.exec(migration)
    for(const event of LEGACY_KELAS_BINAAN_NOTIFICATION_EVENTS) {
      expect(sqlite.prepare('SELECT title_template,body_template,channels_json FROM notification_event_settings WHERE event_key=?').get(event))
        .toMatchObject({title_template:'Judul custom',body_template:'Isi custom',channels_json:'["fcm","in_app"]'})
    }
    expect(sqlite.prepare('SELECT channels_json FROM notification_event_settings WHERE event_key=?').get('kbm_teaching_reminder')?.channels_json).toBe('["fcm"]')
    expect(sqlite.prepare('SELECT channels_json FROM notification_event_settings WHERE event_key=?').get(ATTENDANCE_CORRECTION_RESULT_EVENT)?.channels_json).toBe('["fcm"]')
  })
  it('deduplicates retries and keeps read state and original message intact',async()=>{
    await Promise.all([write(),write(),write()])
    const inbox=await getStaffInbox(runtime.db,'wali')
    expect(inbox.items).toHaveLength(1);expect(inbox.unreadCount).toBe(1)
    const id=inbox.items[0].id
    expect(await readStaffNotification(runtime.db,'wali',id)).toEqual({url})
    await writeStaffNotifications(runtime.db,['wali'],'attendance_homeroom_alert','session','Judul lain','Isi lain',url,'info')
    expect((await getStaffInbox(runtime.db,'wali')).items[0]).toMatchObject({title:'Catatan kehadiran',message:'Belum hadir pada sesi ini',read_at:expect.any(String)})
    expect(await getUnreadStaffNotificationCount(runtime.db,'wali')).toBe(0)
    expect((await getStaffInbox(runtime.db,'wali',{unread:true})).items).toHaveLength(0)
  })
  it('scopes reads and updates to the recipient even if another user knows the id',async()=>{
    await write('one',['wali','other'])
    const own=(await getStaffInbox(runtime.db,'wali')).items[0]
    expect((await getStaffInbox(runtime.db,'other')).items[0].id).not.toBe(own.id)
    expect(await readStaffNotification(runtime.db,'other',own.id)).toBeNull()
    expect(await getUnreadStaffNotificationCount(runtime.db,'wali')).toBe(1)
  })
  it('paginates stable timestamps without skips or duplicate items and caps each page',async()=>{
    for(let i=0;i<43;i++) await write(`session-${i}`)
    const first=await getStaffInbox(runtime.db,'wali')
    const second=await getStaffInbox(runtime.db,'wali',{before:first.nextCursor!})
    const last=await getStaffInbox(runtime.db,'wali',{before:second.nextCursor!})
    expect([first.items.length,second.items.length,last.items.length]).toEqual([20,20,3])
    expect(new Set([...first.items,...second.items,...last.items].map(item=>item.id)).size).toBe(43)
    expect(last.nextCursor).toBeNull()
    expect((await getStaffInbox(runtime.db,'wali',{before:"x' OR 1=1"})).items).toHaveLength(20)
  })
  it('applies the migration repeatedly without changing existing channels or inbox history',async()=>{
    sqlite.exec(readFileSync(new URL('../migrations/0086_add_notification_engine.sql',import.meta.url),'utf8'))
    sqlite.prepare(`INSERT INTO notification_event_settings (event_key,title_template,body_template,channels_json) VALUES (?,?,?,?)`)
      .run('attendance_homeroom_alert','Judul custom','Isi custom','["fcm"]')
    const migration=readFileSync(new URL('../migrations/0118_staff_notification_inbox.sql',import.meta.url),'utf8')
    sqlite.exec(migration); await write();sqlite.exec(migration)
    expect(sqlite.prepare('SELECT title_template,body_template,channels_json FROM notification_event_settings').get()).toMatchObject({title_template:'Judul custom',body_template:'Isi custom',channels_json:'["fcm","in_app"]'})
    expect((await getStaffInbox(runtime.db,'wali')).items).toHaveLength(1)
  })
  it('limits stored links to internal dashboard routes',()=>{
    for(const bad of ['https://evil.example','//evil.example','javascript:alert(1)','/dashboard/\\evil','/dashboard/\nX']) expect(staffNotificationHref(bad)).toBe('/dashboard/kelas-binaan')
    expect(staffNotificationHref(url)).toBe(url)
  })
})

describe('open inbox server action',()=>{
  it('marks only the current recipient item read and opens its stored correction link',async()=>{
    await write()
    const item=(await getStaffInbox(runtime.db,'wali')).items[0]
    const form=new FormData();form.set('id',item.id);form.set('url','https://evil.example')
    await expect(openStaffNotification(form)).rejects.toThrow(`redirect:${url}`)
    expect(await getUnreadStaffNotificationCount(runtime.db,'wali')).toBe(0)
    runtime.userId='other'
    await expect(openStaffNotification(form)).rejects.toThrow('redirect:/dashboard/kelas-binaan/notifikasi')
  })
  it.each([['','wali_kelas','/login'],['wali','guru','/dashboard']])('rejects unauthorized account %s',async(user,role,path)=>{
    runtime.userId=user;runtime.roles=[role]
    await expect(openStaffNotification(new FormData())).rejects.toThrow(`redirect:${path}`)
  })
})
