export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        body > nav, body > footer { display: none !important; }
        body > main { max-width: none !important; padding: 0 !important; margin: 0 !important; }
      `}</style>
      {children}
    </>
  )
}
