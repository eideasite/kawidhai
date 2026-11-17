export async function requestPersistentBrowserStorage() {
  const storage = globalThis.navigator?.storage
  if (typeof storage?.persist !== 'function') return 'unsupported'

  try {
    return await storage.persist() ? 'persistent' : 'best-effort'
  } catch {
    return 'unavailable'
  }
}

export async function estimateBrowserStorage() {
  const estimate = await globalThis.navigator?.storage?.estimate?.()
  if (!Number.isFinite(estimate?.usage) || !Number.isFinite(estimate?.quota)) {
    throw new Error('Browser storage estimates are unavailable.')
  }
  return { usage: estimate.usage, quota: estimate.quota }
}
