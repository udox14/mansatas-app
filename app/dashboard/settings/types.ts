// Lokasi: app/dashboard/settings/types.ts
// Shared types & constants — bisa dipakai di client maupun server

export type SlotJam = {
  id: number
  nama: string
  mulai: string
  selesai: string
}

export type PolaJam = {
  id: string
  nama: string
  hari: number[]   // 1=Senin..6=Sabtu
  slots: SlotJam[]
}

// Default 4 pola MAN 1 Tasikmalaya
export const DEFAULT_POLA_JAM: PolaJam[] = [
  {
    id: 'pola1',
    nama: 'Senin',
    hari: [1],
    slots: [
      { id: 1, nama: 'Jam 1', mulai: '08:00', selesai: '08:40' },
      { id: 2, nama: 'Jam 2', mulai: '08:40', selesai: '09:20' },
      { id: 3, nama: 'Jam 3', mulai: '09:20', selesai: '10:00' },
      { id: 4, nama: 'Jam 4', mulai: '10:15', selesai: '10:50' },
      { id: 5, nama: 'Jam 5', mulai: '10:50', selesai: '11:25' },
      { id: 6, nama: 'Jam 6', mulai: '11:25', selesai: '12:00' },
      { id: 7, nama: 'Jam 7', mulai: '12:30', selesai: '13:05' },
      { id: 8, nama: 'Jam 8', mulai: '13:05', selesai: '13:40' },
    ],
  },
  {
    id: 'pola2',
    nama: 'Selasa & Rabu',
    hari: [2, 3],
    slots: [
      { id: 1,  nama: 'Jam 1',  mulai: '07:15', selesai: '07:50' },
      { id: 2,  nama: 'Jam 2',  mulai: '07:50', selesai: '08:25' },
      { id: 3,  nama: 'Jam 3',  mulai: '08:25', selesai: '09:00' },
      { id: 4,  nama: 'Jam 4',  mulai: '09:00', selesai: '09:35' },
      { id: 5,  nama: 'Jam 5',  mulai: '09:50', selesai: '10:25' },
      { id: 6,  nama: 'Jam 6',  mulai: '10:25', selesai: '11:00' },
      { id: 7,  nama: 'Jam 7',  mulai: '11:00', selesai: '11:35' },
      { id: 8,  nama: 'Jam 8',  mulai: '11:35', selesai: '12:05' },
      { id: 9,  nama: 'Jam 9',  mulai: '12:35', selesai: '13:10' },
      { id: 10, nama: 'Jam 10', mulai: '13:10', selesai: '13:45' },
    ],
  },
  {
    id: 'pola3',
    nama: 'Jumat',
    hari: [5],
    slots: [
      { id: 1, nama: 'Jam 1', mulai: '07:20', selesai: '07:50' },
      { id: 2, nama: 'Jam 2', mulai: '07:50', selesai: '08:20' },
      { id: 3, nama: 'Jam 3', mulai: '08:20', selesai: '08:50' },
      { id: 4, nama: 'Jam 4', mulai: '08:50', selesai: '09:20' },
      { id: 5, nama: 'Jam 5', mulai: '09:20', selesai: '09:50' },
      { id: 6, nama: 'Jam 6', mulai: '09:50', selesai: '10:20' },
    ],
  },
  {
    id: 'pola4',
    nama: 'Kamis & Sabtu',
    hari: [4, 6],
    slots: [
      { id: 1, nama: 'Jam 1', mulai: '07:20', selesai: '07:55' },
      { id: 2, nama: 'Jam 2', mulai: '07:55', selesai: '08:30' },
      { id: 3, nama: 'Jam 3', mulai: '08:30', selesai: '09:05' },
      { id: 4, nama: 'Jam 4', mulai: '09:05', selesai: '09:40' },
      { id: 5, nama: 'Jam 5', mulai: '09:55', selesai: '10:30' },
      { id: 6, nama: 'Jam 6', mulai: '10:30', selesai: '11:05' },
      { id: 7, nama: 'Jam 7', mulai: '11:05', selesai: '11:40' },
      { id: 8, nama: 'Jam 8', mulai: '11:40', selesai: '12:15' },
    ],
  },
]
