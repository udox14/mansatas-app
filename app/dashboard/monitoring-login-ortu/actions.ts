'use server'

import { getDB } from '@/utils/db-server'
import { requireActionAccess } from '@/lib/action-security'
import {
  queryParentLoginExportRows,
  queryParentLoginMonitoring,
  resolveParentLoginScope,
  type ParentLoginExportResult,
  type ParentLoginFilters,
  type ParentLoginMonitoringResult,
} from '@/lib/parent-login-tracking'

export async function getParentLoginMonitoringData(
  filters: ParentLoginFilters = {}
): Promise<ParentLoginMonitoringResult & { scopeMode: 'all' | 'scoped' }> {
  const actor = await requireActionAccess('monitoring-login-ortu', 'read')
  const db = await getDB()
  const scope = await resolveParentLoginScope(db, actor)
  const result = await queryParentLoginMonitoring(db, scope, filters)
  return { scopeMode: scope.mode, ...result }
}

export async function getParentLoginExportData(
  filters: ParentLoginFilters = {}
): Promise<ParentLoginExportResult> {
  const actor = await requireActionAccess('monitoring-login-ortu', 'read')
  const db = await getDB()
  const scope = await resolveParentLoginScope(db, actor)
  return queryParentLoginExportRows(db, scope, filters)
}
