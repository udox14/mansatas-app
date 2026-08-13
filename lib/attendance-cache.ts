import { clearMemCachePrefix } from '@/utils/mem-cache'

export function invalidateAttendanceCache() {
  clearMemCachePrefix('final-att:')
  clearMemCachePrefix('school-estimate:')
}
