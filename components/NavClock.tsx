'use client'

import { useState, useEffect } from 'react'

export default function NavClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      setTime(
        `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="font-mono text-xs text-[#999] tracking-wide">
      {time}
    </span>
  )
}
