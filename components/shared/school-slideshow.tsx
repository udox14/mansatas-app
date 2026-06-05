'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

const photos = [
  { src: '/school_exterior.png', alt: 'Gedung MAN 1 Tasikmalaya' },
  { src: '/school_classroom.png', alt: 'Ruang Kelas Modern MANSATAS' },
]

export default function SchoolSlideshow() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % photos.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative w-full h-24 sm:h-32 md:h-36 overflow-hidden z-10 pointer-events-none mt-auto shrink-0 select-none">
      {/* Soft gradient overlays to create a 'frameless' look that blends into the background */}
      <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[#fafcfa] to-transparent z-20" />
      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#fafcfa] to-transparent z-20" />
      <div className="absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-[#fafcfa] to-transparent z-20" />
      <div className="absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-[#fafcfa] to-transparent z-20" />

      {/* Crossfading slides */}
      {photos.map((photo, i) => (
        <div
          key={photo.src}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 0.22 : 0 }}
        >
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            className="object-cover object-center"
            priority={i === 0}
            sizes="100vw"
          />
        </div>
      ))}
    </div>
  )
}
