// Runs once at server startup — before any route or module is loaded.
// Fixes broken Node.js localStorage when --localstorage-file is set without a valid path.

export async function register() {
  if (typeof globalThis !== 'undefined' && typeof window === 'undefined') {
    const noop = {
      getItem: (_key: string): string | null => null,
      setItem: (_key: string, _value: string): void => {},
      removeItem: (_key: string): void => {},
      clear: (): void => {},
      key: (_index: number): string | null => null,
      length: 0,
    }

    try {
      // Test if localStorage is functional
      globalThis.localStorage?.getItem?.('__test')
    } catch {
      // Broken — replace it
      Object.defineProperty(globalThis, 'localStorage', {
        value: noop,
        writable: true,
        configurable: true,
      })
      return
    }

    // Exists but getItem isn't a function (Node --localstorage-file without valid path)
    if (
      globalThis.localStorage &&
      typeof globalThis.localStorage.getItem !== 'function'
    ) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: noop,
        writable: true,
        configurable: true,
      })
    }
  }
}
