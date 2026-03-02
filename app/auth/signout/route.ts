import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient()

  // Mengecek apakah ada session aktif
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    await supabase.auth.signOut()
  }

  revalidatePath('/', 'layout')
  
  // Menggunakan request URL agar absolute redirect bisa dilakukan
  return NextResponse.redirect(new URL('/login', req.url), {
    status: 302,
  })
}