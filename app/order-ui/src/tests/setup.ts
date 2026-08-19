import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement ResizeObserver, but Radix primitives (e.g. Checkbox)
// use it internally. Stub it so components mounting those primitives don't
// crash in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// runs a clean after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
})
