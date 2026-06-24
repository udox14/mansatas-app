// components/dashboard/shared/DashboardSPAShell.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  House, 
  SquaresFour, 
  MagnifyingGlass,
  CaretLeft,
  Database,
  Briefcase,
  ChartLineUp,
  ClipboardText,
  Star,
  UserCircle,
  Files,
  Wallet,
  Gear,
  DotsThree,
  Clock
} from '@phosphor-icons/react'
import { MENU_ITEMS, DEFAULT_SIDEBAR_GROUPS } from '@/config/menu'
import { getIconComponent } from '@/lib/icons'
import { motion, AnimatePresence } from 'framer-motion'

interface DashboardSPAShellProps {
  children: React.ReactNode
  allowedFeatures: string[]
  featureLabels?: Record<string, string>
  heroNode?: React.ReactNode
}

const GROUP_META: Record<string, { title: string; desc: string }> = {
  'utama': { title: 'Utama', desc: 'Dasbor ringkasan' },
  'data-master': { title: 'Data Master', desc: 'Siswa, pegawai, kelas, dan plotting' },
  'tugas-harian-guru': { title: 'Operasional Harian', desc: 'Agenda, absensi, nilai, dan penugasan' },
  'monitoring-akademik': { title: 'Monitoring Akademik', desc: 'Kurikulum, kalender, analitik' },
  'monitoring-rekap': { title: 'Monitoring & Laporan', desc: 'Pantauan harian dan rekap kerja' },
  'program-khusus': { title: 'Program Khusus', desc: 'Tahfidz Qur\'an dan keagamaan' },
  'kesiswaan-bk': { title: 'Kesiswaan & BK', desc: 'Izin, kedisiplinan, bimbingan konseling' },
  'administrasi-hr': { title: 'Administrasi', desc: 'Surat, rapat, sarpras, buku tamu' },
  'keuangan': { title: 'Keuangan', desc: 'Daftar ulang, SPP, DSPT, kas, laporan' },
  'sistem': { title: 'Sistem', desc: 'Pengaturan, broadcast, log sistem' },
}

const GROUP_COLORS: Record<string, { text: string; borderHover: string }> = {
  'utama': { text: 'text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-300', borderHover: 'hover:border-emerald-200 dark:hover:border-emerald-800/50' },
  'data-master': { text: 'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300', borderHover: 'hover:border-blue-200 dark:hover:border-blue-800/50' },
  'tugas-harian-guru': { text: 'text-orange-500 dark:text-orange-400 group-hover:text-orange-600 dark:group-hover:text-orange-300', borderHover: 'hover:border-orange-200 dark:hover:border-orange-800/50' },
  'monitoring-akademik': { text: 'text-purple-500 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-purple-300', borderHover: 'hover:border-purple-200 dark:hover:border-purple-800/50' },
  'monitoring-rekap': { text: 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300', borderHover: 'hover:border-indigo-200 dark:hover:border-indigo-800/50' },
  'program-khusus': { text: 'text-rose-500 dark:text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300', borderHover: 'hover:border-rose-200 dark:hover:border-rose-800/50' },
  'kesiswaan-bk': { text: 'text-pink-500 dark:text-pink-400 group-hover:text-pink-600 dark:group-hover:text-pink-300', borderHover: 'hover:border-pink-200 dark:hover:border-pink-800/50' },
  'administrasi-hr': { text: 'text-cyan-500 dark:text-cyan-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-300', borderHover: 'hover:border-cyan-200 dark:hover:border-cyan-800/50' },
  'keuangan': { text: 'text-amber-500 dark:text-amber-400 group-hover:text-amber-600 dark:group-hover:text-amber-300', borderHover: 'hover:border-amber-200 dark:hover:border-amber-800/50' },
  'sistem': { text: 'text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300', borderHover: 'hover:border-slate-300 dark:hover:border-slate-600' },
  'lainnya': { text: 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300', borderHover: 'hover:border-gray-200 dark:hover:border-gray-800/50' },
}

const GROUP_ICONS: Record<string, any> = {
  'utama': House,
  'data-master': Database,
  'tugas-harian-guru': Briefcase,
  'monitoring-akademik': ChartLineUp,
  'monitoring-rekap': ClipboardText,
  'program-khusus': Star,
  'kesiswaan-bk': UserCircle,
  'administrasi-hr': Files,
  'keuangan': Wallet,
  'sistem': Gear,
  'lainnya': DotsThree,
}

// Framer Motion Animation Configs
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 }
  }
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    transition: { type: 'spring', stiffness: 350, damping: 25 } 
  }
} as const

export function DashboardSPAShell({
  children,
  allowedFeatures = [],
  featureLabels = {},
  heroNode,
}: DashboardSPAShellProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu'>('dashboard')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
      setTime(new Intl.DateTimeFormat('id-ID', options).format(now))
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Handle URL hash for Android Back button navigation
  useEffect(() => {
    setIsMounted(true)
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash.startsWith('#group-')) {
        setActiveGroup(hash.replace('#group-', ''))
        setActiveTab('menu')
      } else if (hash === '#menu') {
        setActiveGroup(null)
        setActiveTab('menu')
      } else {
        setActiveGroup(null)
        setActiveTab('dashboard')
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const handleSetTab = (tab: 'dashboard' | 'menu') => {
    if (tab === 'dashboard') {
      window.history.pushState(null, '', window.location.pathname + window.location.search)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    } else {
      window.location.hash = 'menu'
    }
  }

  const handleGroupClick = (groupId: string) => {
    window.location.hash = `group-${groupId}`
    setSearchQuery('')
  }

  // Map allowed features
  const allowedSet = new Set(allowedFeatures)
  const allowedMenus = MENU_ITEMS.filter(item =>
    item.id !== 'dashboard' && // Don't show dashboard in the menu list tab
    (allowedSet.has(item.id) ||
     (item.id === 'keuangan-transaksi' && allowedSet.has('keuangan-laporan')) ||
     (item.id === 'keuangan-export' && (allowedSet.has('keuangan-dspt') || allowedSet.has('keuangan-spp'))))
  )

  // Filter allowed menus based on search
  const isSearching = searchQuery.trim().length > 0
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredMenus = allowedMenus.filter(item => {
    const title = featureLabels[item.id] || item.title
    return title.toLowerCase().includes(normalizedQuery)
  })

  // Group filtered menus
  const configuredMenuIds = new Set(DEFAULT_SIDEBAR_GROUPS.flatMap(g => g.items))
  const unconfiguredMenus = allowedMenus.filter(item => !configuredMenuIds.has(item.id))

  const groupedMenus = DEFAULT_SIDEBAR_GROUPS.map(group => {
    const items = group.items
      .map(id => allowedMenus.find(item => item.id === id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
    return { ...group, items }
  }).filter(group => group.items.length > 0)

  if (unconfiguredMenus.length > 0) {
    groupedMenus.push({
      id: 'lainnya',
      label: 'Lainnya',
      items: unconfiguredMenus,
    })
  }

  const activeGroupData = activeGroup ? groupedMenus.find(g => g.id === activeGroup) : null

  // Ensure hydration match
  if (!isMounted) return null

  return (
    <div className="flex flex-col">
      {/* ── Unified Sticky Header (Hero, Tabs, Search) ────────────────────────────────── */}
      <div className="sticky -top-3 sm:-top-4 md:-top-5 z-40 bg-slate-50 dark:bg-slate-900 pt-4 sm:pt-5 md:pt-6 pb-3 shadow-sm md:shadow-none -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 border-b border-transparent -mt-3 sm:-mt-4 md:-mt-5">
        {heroNode && (
          <div className="w-full mb-3">
            {heroNode}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          {/* Jam Digital WIB (Kiri) */}
          <div className="relative inline-flex items-center gap-2 px-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-full shadow-sm border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm tracking-wide h-[44px] sm:h-[52px]">
            <Clock weight="duotone" className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <span className="font-mono tabular-nums leading-none">{time || '00:00:00'}</span>
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 dark:text-slate-500 leading-none">WIB</span>
          </div>

          {/* Tabs Navigation (Kanan) */}
          <div className="relative inline-flex p-1.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md rounded-full shadow-sm z-0 border border-slate-200/50 dark:border-slate-700/50">
            <button
              onClick={() => handleSetTab('dashboard')}
              className={`relative flex items-center gap-2.5 px-6 sm:px-8 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold tracking-wide transition-all duration-300 z-10 ${
                activeTab === 'dashboard'
                  ? 'text-emerald-900 dark:text-emerald-300'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {activeTab === 'dashboard' && (
                <motion.div
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-white dark:bg-slate-700 rounded-full shadow-md border border-slate-100 dark:border-slate-600 -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                />
              )}
              <House weight={activeTab === 'dashboard' ? 'duotone' : 'bold'} className="h-4 w-4 sm:h-5 sm:w-5" />
              Home
            </button>
            <button
              onClick={() => handleSetTab('menu')}
              className={`relative flex items-center gap-2.5 px-6 sm:px-8 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold tracking-wide transition-all duration-300 z-10 ${
                activeTab === 'menu'
                  ? 'text-emerald-900 dark:text-emerald-300'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {activeTab === 'menu' && (
                <motion.div
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-white dark:bg-slate-700 rounded-full shadow-md border border-slate-100 dark:border-slate-600 -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                />
              )}
              <SquaresFour weight={activeTab === 'menu' ? 'duotone' : 'bold'} className="h-4 w-4 sm:h-5 sm:w-5" />
              Menu
            </button>
          </div>
        </div>

        {/* Sticky Search Bar (Only shown in Menu Tab) */}
        {activeTab === 'menu' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="max-w-2xl mx-auto mt-3 px-1"
          >
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400 dark:text-slate-500">
                <MagnifyingGlass className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <input
                type="text"
                placeholder="Cari fitur sekolah..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-[11px] sm:text-xs placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:border-emerald-800 dark:focus:border-emerald-700 focus:ring-1 focus:ring-emerald-800 dark:focus:ring-emerald-700 outline-none transition-all shadow-sm"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden mt-4">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.05}
              dragDirectionLock
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.x < -50 || velocity.x < -500) {
                  handleSetTab('menu')
                }
              }}
            >
              {children}
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.05}
              dragDirectionLock
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.x > 50 || velocity.x > 500) {
                  handleSetTab('dashboard')
                }
              }}
              className="w-full space-y-6 mt-0 sm:mt-2 pb-20"
            >
              {/* Dynamic Content: Search Results | Group Drill-down | Group List */}
              {isSearching ? (
                // Search Results (Flat List)
                filteredMenus.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Tidak ada fitur yang cocok dengan pencarian Anda.
                  </div>
                ) : (
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                  >
                    {filteredMenus.map(item => {
                      const Icon = getIconComponent(item.icon)
                      const title = featureLabels[item.id] || item.title
                      // Find which group this belongs to for color styling
                      const parentGroup = groupedMenus.find(g => g.items.some(i => i.id === item.id))
                      const itemColor = GROUP_COLORS[parentGroup?.id || 'lainnya'] || GROUP_COLORS['lainnya']
                      
                      return (
                        <motion.div variants={itemVariants} key={item.id}>
                          <Link
                            href={item.href}
                            className={`group flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl shadow-sm hover:shadow-md transition-all text-left active:scale-[0.99] ${itemColor.borderHover}`}
                          >
                            <div className="shrink-0 flex items-center justify-center h-10 w-10">
                              {Icon && <Icon weight="duotone" className={`h-8 w-8 transition-colors ${itemColor.text}`} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-0.5 truncate">
                                {title}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                {item.desc || 'Akses halaman fitur ini'}
                              </p>
                            </div>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                )
              ) : activeGroupData ? (
                // Drill-down: Items in Active Group
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3 px-1 mb-2">
                    <button 
                      onClick={() => window.history.back()} 
                      className="p-2 bg-white dark:bg-slate-800 rounded-full border border-slate-100 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <CaretLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </button>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                        {GROUP_META[activeGroupData.id]?.title || activeGroupData.label}
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {GROUP_META[activeGroupData.id]?.desc}
                      </p>
                    </div>
                  </div>
                  
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                  >
                    {activeGroupData.items.map(item => {
                      const Icon = getIconComponent(item.icon)
                      const title = featureLabels[item.id] || item.title
                      const itemColor = GROUP_COLORS[activeGroupData.id] || GROUP_COLORS['lainnya']
                      
                      return (
                        <motion.div variants={itemVariants} key={item.id}>
                          <Link
                            href={item.href}
                            className={`group flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-2xl shadow-sm hover:shadow-md transition-all text-left active:scale-[0.99] ${itemColor.borderHover}`}
                          >
                            <div className="shrink-0 flex items-center justify-center h-10 w-10">
                              {Icon && <Icon weight="duotone" className={`h-8 w-8 transition-colors ${itemColor.text}`} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-0.5 truncate">
                                {title}
                              </h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                {item.desc || 'Akses halaman fitur ini'}
                              </p>
                            </div>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                </motion.div>
              ) : (
                // Group List (Default Menu View)
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                >
                  {groupedMenus.map(group => {
                    const meta = GROUP_META[group.id] || { title: group.label, desc: 'Akses cepat fitur' }
                    const groupColor = GROUP_COLORS[group.id] || GROUP_COLORS['lainnya']
                    const GroupIcon = GROUP_ICONS[group.id] || DotsThree

                    return (
                      <motion.div variants={itemVariants} key={group.id}>
                        <button
                          onClick={() => handleGroupClick(group.id)}
                          className={`w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-all text-left group active:scale-[0.99] ${groupColor.borderHover}`}
                        >
                          <GroupIcon weight="duotone" className={`shrink-0 h-8 w-8 transition-colors ${groupColor.text}`} />
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-0.5">{meta.title}</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{meta.desc}</p>
                          </div>
                        </button>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
