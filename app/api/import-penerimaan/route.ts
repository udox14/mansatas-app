// app/api/import-penerimaan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { importPenerimaanFromData } from '@/app/dashboard/penerimaan-pt/actions'

export async function POST(req: NextRequest) {
  try {
    const { data, taId } = await req.json()
    const result = await importPenerimaanFromData(data, taId)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}