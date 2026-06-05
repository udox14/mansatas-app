'use client'

import { useState, useEffect } from 'react'

interface TypingHeroProps {
  phrases?: string[]
  speed?: number
  deleteSpeed?: number
  delay?: number
}

const defaultPhrases = [
  'Satu pintu kendali layanan madrasah.',
  'Tertib, cepat, dan terukur.',
  'Portal informasi resmi orang tua.',
  'Kelola akademik, kesiswaan, dan keuangan.',
]

export default function TypingHero({
  phrases = defaultPhrases,
  speed = 80,
  deleteSpeed = 40,
  delay = 2000,
}: TypingHeroProps) {
  const [text, setText] = useState('')
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    const currentPhrase = phrases[phraseIndex]

    if (isDeleting) {
      // Deleting character
      timer = setTimeout(() => {
        setText(currentPhrase.substring(0, text.length - 1))
      }, deleteSpeed)
    } else {
      // Typing character
      timer = setTimeout(() => {
        setText(currentPhrase.substring(0, text.length + 1))
      }, speed)
    }

    // If fully typed, wait for delay and then start deleting
    if (!isDeleting && text === currentPhrase) {
      timer = setTimeout(() => setIsDeleting(true), delay)
    }

    // If fully deleted, move to the next phrase
    if (isDeleting && text === '') {
      setIsDeleting(false)
      setPhraseIndex((prev) => (prev + 1) % phrases.length)
    }

    return () => clearTimeout(timer)
  }, [text, isDeleting, phraseIndex, phrases, speed, deleteSpeed, delay])

  return (
    <span className="inline-flex items-center min-h-[1.5em]">
      <span className="text-teal-600 dark:text-teal-400 font-medium">{text}</span>
      <span className="ml-1 inline-block w-[2px] h-[1.1em] bg-teal-600 dark:bg-teal-400 animate-[blink_1s_infinite]" aria-hidden="true" />
      <style jsx global>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  )
}
