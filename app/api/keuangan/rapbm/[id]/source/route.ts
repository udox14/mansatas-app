import { RapbmAccessError, requireRapbmAccess } from '@/lib/rapbm-access'
import { readRapbmSource } from '@/lib/rapbm-storage'

export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) {
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
  try {
    const {db,canManage}=await requireRapbmAccess()
    const {id}=await params
    const row=await db.prepare('SELECT status,r2_key,original_filename FROM fin_rapbm_versions WHERE id=?').bind(id)
      .first<{status:string;r2_key:string;original_filename:string}>()
    if (!row || (row.status==='draft' && !canManage)) return new Response('Not Found',{status:404,headers})
    const file=await readRapbmSource(row.r2_key)
    if (!file) return new Response('Sumber Excel belum tersedia. Silakan hubungi pengelola.',{status:404,headers})
    return new Response(file.body as ReadableStream,{headers:{...headers,
      'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':`attachment; filename="RAPBM.xlsx"; filename*=UTF-8''${encodeURIComponent(row.original_filename).replace(/'/g,'%27')}`,
    }})
  } catch(error) {
    if (error instanceof RapbmAccessError) return new Response(error.message,{status:error.status,headers})
    console.error('Unduh sumber RAPBM gagal',error)
    return new Response('Sumber Excel tidak dapat diunduh saat ini.',{status:503,headers})
  }
}
