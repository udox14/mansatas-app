import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(amount: number): string {
  if (isNaN(amount)) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

export function formatNamaKelas(tingkat: string | number, nomor_kelas: string | number, kelompok?: string | null) {
  if (!tingkat || !nomor_kelas) return '-';
  const base = `${tingkat}-${nomor_kelas}`;
  if (kelompok && kelompok.toUpperCase() !== 'UMUM') {
    return `${base} ${kelompok}`.trim();
  }
  return base;
}
