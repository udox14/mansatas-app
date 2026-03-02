'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// WAJIB menambahkan parameter 'prevState' agar sesuai dengan standar useFormState di Next.js 14
export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Return error message ke UI jika login gagal
    return { error: error.message }
  }

  // Bersihkan cache dan arahkan ke dashboard jika berhasil
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}