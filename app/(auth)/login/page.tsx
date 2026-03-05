'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { login } from './actions'

const initialState = {
  error: null as string | null,
}

// Komponen tombol terpisah untuk menggunakan useFormStatus (loading state)
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
    >
      {pending ? 'Memproses...' : 'Sign in'}
    </button>
  )
}

export default function LoginPage() {
  // Hook useFormState untuk menangkap return data { error } dari actions.ts
  const [state, formAction] = useActionState(login, initialState)

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            MANSATAS App
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sistem Informasi Manajemen MAN 1 Tasikmalaya
          </p>
        </div>
        
        {/* Gunakan formAction dari useFormState, BUKAN memanggil action langsung */}
        <form className="mt-8 space-y-6" action={formAction}>
          
          {/* Tampilkan pesan error warna merah jika login gagal */}
          {state?.error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm text-center">
              {state.error}
            </div>
          )}

          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  )
}