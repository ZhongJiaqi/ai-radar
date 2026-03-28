'use client'

import { useState, useEffect } from 'react'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function NavClock() {
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      setDateStr(`${MONTH_ABBR[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="text-xs text-gray-400 font-medium tracking-wide">
      {dateStr}
    </span>
  )
}
