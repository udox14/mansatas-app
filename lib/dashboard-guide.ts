import { MENU_ITEMS } from '@/config/menu'

export type DashboardGuideTarget =
  | 'page-title'
  | 'page-content'
  | 'tabs'
  | 'tab-content'
  | 'filters'
  | 'results'
  | 'actions'
  | 'dashboard-favorites'
  | 'dashboard-widgets'

export type DashboardGuideStep = {
  target: DashboardGuideTarget
  title: string
  description: string
  activateTabControlsId?: string
}

export type DashboardGuide = {
  id: string
  title: string
  description: string
}

const STAFF_MENU_ITEMS = MENU_ITEMS.filter(item =>
  item.href.startsWith('/dashboard/') && item.id !== 'portal-ortu'
)

function normalizePath(pathname: string) {
  const clean = pathname.split('?')[0].split('#')[0]
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1)
  return clean || '/dashboard'
}

function titleFromPath(pathname: string) {
  const segment = normalizePath(pathname).split('/').filter(Boolean).at(-1) || 'dashboard'
  return decodeURIComponent(segment)
    .replace(/\[[^\]]+\]/g, 'detail')
    .split('-')
    .map(word => word.length <= 3 ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

export function getDashboardGuide(pathname: string): DashboardGuide {
  const path = normalizePath(pathname)
  if (path === '/dashboard') {
    return {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'Beranda merangkum informasi dan menu yang tersedia sesuai peran Anda.',
    }
  }

  const exactMatch = STAFF_MENU_ITEMS.find(item => normalizePath(item.href) === path)
  const parentMatch = STAFF_MENU_ITEMS
    .filter(item => path.startsWith(`${normalizePath(item.href)}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
  const firstSegment = path.split('/').filter(Boolean)[1]
  const sectionMatch = STAFF_MENU_ITEMS.find(item => item.href.split('/').filter(Boolean)[1] === firstSegment)
  const feature = exactMatch || parentMatch || sectionMatch

  return {
    id: feature?.id || path.replace(/^\/dashboard\/?/, '').replaceAll('/', '-').replaceAll(/\[[^\]]+\]/g, 'detail') || 'dashboard-page',
    title: feature?.title || titleFromPath(path),
    description: feature?.desc
      ? path === normalizePath(feature.href)
        ? feature.desc
        : `Halaman ini merupakan bagian dari ${feature.title}. ${feature.desc}.`
      : `Gunakan halaman ${titleFromPath(path)} untuk meninjau informasi dan menjalankan pekerjaan yang tersedia sesuai hak akses Anda.`,
  }
}

const COMMON_STEPS: DashboardGuideStep[] = [
  {
    target: 'page-title',
    title: 'Mengenal halaman',
    description: '',
  },
  {
    target: 'tabs',
    title: 'Bagian halaman',
    description: 'Gunakan tab ini untuk berpindah bagian. Isi halaman akan mengikuti tab yang sedang dipilih.',
  },
  {
    target: 'tab-content',
    title: 'Isi bagian aktif',
    description: 'Bagian ini menampilkan informasi pada tab yang sedang dipilih.',
  },
  {
    target: 'results',
    title: 'Data utama',
    description: 'Tinjau data yang tampil di sini. Detail dan jumlah data mengikuti konteks serta akses akun Anda.',
  },
  {
    target: 'actions',
    title: 'Aksi halaman',
    description: 'Aksi yang tersedia mengikuti hak akses Anda. Periksa kembali pilihan sebelum menyimpan perubahan.',
  },
]

const HOME_STEPS: DashboardGuideStep[] = [
  {
    target: 'page-title',
    title: 'Beranda dashboard',
    description: 'Ringkasan ini menampilkan identitas dan konteks kerja Anda.',
  },
  {
    target: 'dashboard-favorites',
    title: 'Menu favorit',
    description: 'Buka menu favorit untuk menuju fitur yang sering digunakan. Gunakan Semua menu untuk melihat fitur lain yang tersedia.',
  },
  {
    target: 'dashboard-widgets',
    title: 'Ringkasan dan informasi',
    description: 'Widget di bagian ini menampilkan informasi yang relevan dengan peran Anda.',
  },
]

export function buildDashboardGuideSteps(
  guide: DashboardGuide,
  pageTitle: string,
  availableTargets: ReadonlySet<DashboardGuideTarget>,
  tabSteps: DashboardGuideStep[] = [],
): DashboardGuideStep[] {
  const candidates = guide.id === 'dashboard'
    ? HOME_STEPS
    : [
        COMMON_STEPS[0],
        ...(tabSteps.length > 0
          ? [COMMON_STEPS[1], ...tabSteps]
          : COMMON_STEPS.slice(1, 2)),
        ...(availableTargets.has('filters') ? [{
          target: 'filters' as const,
          title: 'Pencarian dan filter',
          description: 'Gunakan pencarian atau pilihan filter untuk mempersempit data sebelum meninjau hasilnya.',
        }] : []),
        ...COMMON_STEPS.slice(2),
      ]
  const steps = candidates
    .filter(step => availableTargets.has(step.target))
    .map(step => step.target === 'page-title'
      ? {
          ...step,
          title: guide.id === 'dashboard' ? step.title : (pageTitle || guide.title),
          description: guide.description,
        }
      : step)

  if (steps.length > 0) return steps.slice(0, 6)

  return [{
    target: 'page-content',
    title: pageTitle || guide.title,
    description: guide.description,
  }]
}
