/**
 * VirtualKeyboard — randomised on-screen digit pad for OTP entry.
 * Defends against keyloggers and shoulder-surfing on sensitive actions.
 */
import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function VirtualKeyboard({ value = '', onChange, maxLength = 6, label = 'Enter OTP' }) {
  const [keys, setKeys] = useState(() => shuffle(['1','2','3','4','5','6','7','8','9','0']))

  // Reshuffle on each render of the keyboard (makes it harder to muscle-memorise)
  const reshuffle = useCallback(() => {
    setKeys(shuffle(['1','2','3','4','5','6','7','8','9','0']))
  }, [])

  // Reshuffle whenever value changes (after each digit press)
  useEffect(() => { reshuffle() }, [value, reshuffle])

  const handleDigit = (digit) => {
    if (value.length < maxLength) {
      onChange(value + digit)
    }
  }

  const handleDelete = () => {
    onChange(value.slice(0, -1))
  }

  const handleClear = () => {
    onChange('')
  }

  // Display as dots for privacy
  const display = '●'.repeat(value.length) + '·'.repeat(Math.max(0, maxLength - value.length))

  return (
    <div className="select-none">
      {label && <p className="text-sm font-medium mb-2">{label}</p>}

      {/* OTP display */}
      <div className="flex justify-center gap-2 mb-4">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`w-10 h-12 flex items-center justify-center text-2xl border-2 rounded font-mono
              ${i < value.length ? 'border-black bg-black text-white' : 'border-border bg-background text-muted'}`}
          >
            {i < value.length ? '●' : '·'}
          </div>
        ))}
      </div>

      {/* Randomised digit grid */}
      <div className="grid grid-cols-5 gap-2 max-w-xs mx-auto">
        {keys.map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            disabled={value.length >= maxLength}
            className="h-12 w-full border-2 border-black rounded bg-background hover:bg-main
                       hover:text-main-foreground active:scale-95 transition-all font-mono text-lg
                       font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {digit}
          </button>
        ))}
      </div>

      {/* Control row */}
      <div className="flex gap-2 justify-center mt-3 max-w-xs mx-auto">
        <button
          type="button"
          onClick={handleDelete}
          disabled={value.length === 0}
          className="flex-1 h-10 border-2 border-black rounded bg-background hover:bg-secondary-background
                     active:scale-95 transition-all text-sm font-bold disabled:opacity-40"
        >
          ⌫ Del
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={value.length === 0}
          className="flex-1 h-10 border-2 border-black rounded bg-background hover:bg-secondary-background
                     active:scale-95 transition-all text-sm font-bold disabled:opacity-40"
        >
          ✕ Clear
        </button>
      </div>

      <p className="text-xs text-center text-muted-foreground mt-2">
        Keys are randomised on each press for security
      </p>
    </div>
  )
}
