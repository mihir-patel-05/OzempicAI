export function App() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-lg)',
        background: 'var(--cream)',
        color: 'var(--espresso)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 48,
            margin: 0,
            color: 'var(--terracotta)',
          }}
        >
          OzempicAI
        </h1>
        <p style={{ color: 'var(--coffee)', marginTop: 'var(--space-sm)' }}>
          Mobile web scaffold ready.
        </p>
      </div>
    </main>
  )
}
