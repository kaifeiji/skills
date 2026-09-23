export const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  pad: { width: 1024, height: 1366 },
  mobile: { width: 390, height: 844 },
}

export function getViewport(name = 'desktop') {
  if (name && typeof name === 'object' && Number.isFinite(name.width) && Number.isFinite(name.height)) {
    return { width: name.width, height: name.height }
  }
  const viewport = VIEWPORTS[name]
  if (!viewport) {
    throw new Error(`[viewport] Unsupported viewport "${name}". Use desktop, pad, or mobile.`)
  }
  return { ...viewport }
}
