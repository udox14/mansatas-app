'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

function sanitizeNumeric(raw: string, allowNegative: boolean): string {
  const trimmed = raw.trim()
  const isNeg = allowNegative && trimmed.startsWith('-')
  const digits = trimmed.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return isNeg ? '-' : ''
  return isNeg ? `-${digits}` : digits
}

export function formatRupiahDigits(raw: string | number | null | undefined, allowNegative = false): string {
  if (raw === null || raw === undefined || raw === '') return ''
  const clean = sanitizeNumeric(String(raw), allowNegative)
  if (!clean || clean === '-') return clean
  const neg = clean.startsWith('-')
  const digits = neg ? clean.slice(1) : clean
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return neg ? `-${formatted}` : formatted
}

export function parseRupiahDigits(raw: string, allowNegative = false): string {
  const clean = sanitizeNumeric(raw, allowNegative)
  return clean === '-' ? '' : clean
}

export type RupiahInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange'
> & {
  value?: string | number
  defaultValue?: string | number
  onValueChange?: (rawDigits: string, numericValue: number) => void
  allowNegative?: boolean
  showPrefix?: boolean
}

export const RupiahInput = React.forwardRef<HTMLInputElement, RupiahInputProps>(
  (
    {
      className,
      name,
      value,
      defaultValue,
      onValueChange,
      allowNegative = false,
      showPrefix = true,
      required,
      min,
      disabled,
      readOnly,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const isControlled = value !== undefined
    const [internalRaw, setInternalRaw] = React.useState<string>(() =>
      defaultValue !== undefined && defaultValue !== null && defaultValue !== ''
        ? parseRupiahDigits(String(defaultValue), allowNegative)
        : '',
    )

    const currentRaw = isControlled
      ? value === '' || value === null || value === undefined
        ? ''
        : parseRupiahDigits(String(value), allowNegative)
      : internalRaw

    const [typingNeg, setTypingNeg] = React.useState(false)
    const displayValue =
      typingNeg && !currentRaw ? '-' : formatRupiahDigits(currentRaw, allowNegative)

    const minNumber = min !== undefined ? Number(min) : undefined

    function applyValidity(target: HTMLInputElement, rawVal: string) {
      if (required && rawVal === '') {
        target.setCustomValidity('Nominal wajib diisi.')
        return
      }
      if (rawVal !== '' && minNumber !== undefined && !Number.isNaN(minNumber) && Number(rawVal) < minNumber) {
        target.setCustomValidity(
          minNumber > 0
            ? `Nominal minimal Rp ${minNumber.toLocaleString('id-ID')}.`
            : 'Nominal tidak boleh kurang dari batas minimum.',
        )
        return
      }
      target.setCustomValidity('')
    }

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      const next = sanitizeNumeric(event.target.value, allowNegative)
      event.target.setCustomValidity('')
      if (next === '-') {
        setTypingNeg(true)
        if (!isControlled) setInternalRaw('')
        onValueChange?.('', 0)
        return
      }
      setTypingNeg(false)
      if (!isControlled) setInternalRaw(next)
      onValueChange?.(next, next === '' ? 0 : Number(next))
    }

    function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
      if (typingNeg && !currentRaw) setTypingNeg(false)
      applyValidity(event.target, currentRaw)
      onBlur?.(event)
    }

    function handleInvalid(event: React.FormEvent<HTMLInputElement>) {
      applyValidity(event.currentTarget, currentRaw)
    }

    return (
      <div className="relative flex items-center">
        {name && <input type="hidden" name={name} value={currentRaw} />}
        {showPrefix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 select-none text-xs font-medium text-slate-400 dark:text-slate-500"
          >
            Rp
          </span>
        )}
        <input
          {...props}
          ref={ref}
          type="text"
          inputMode={allowNegative ? 'text' : 'numeric'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onInvalid={handleInvalid}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base tabular-nums shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            showPrefix && 'pl-8',
            className,
          )}
        />
      </div>
    )
  },
)
RupiahInput.displayName = 'RupiahInput'
