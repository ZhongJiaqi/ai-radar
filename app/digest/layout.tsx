export default function DigestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .root-nav { display: none !important; }
        .root-footer { display: none !important; }
        .root-main { max-width: none !important; padding: 0 !important; margin: 0 !important; }
      `}} />
      {children}
    </>
  )
}
