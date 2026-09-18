export type ParsedDeviceInfo = {
  type: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  platformLabel: string
  deviceBrand: string
  model: string | null
  os: string
  browser: string
  summary: string
}

const KNOWN_MODELS: Record<string, string> = {
  '23021RAA2Y': 'Xiaomi Redmi Note 12',
  '23028RN4GY': 'Xiaomi Redmi 12',
  '2201117TY': 'Xiaomi Redmi Note 11',
  '220733SI': 'Xiaomi Redmi A1',
  '23053RN02Y': 'Xiaomi Redmi 12C',
  '23129RAA4G': 'Xiaomi Redmi Note 13',
  '23117RA68G': 'Xiaomi Redmi Note 13 Pro',
  '22101316G': 'POCO X5 5G',
  '23122PCD1G': 'POCO X6 Pro',
}

function resolveAndroidBrand(model: string): string {
  const upper = model.toUpperCase().trim()
  if (KNOWN_MODELS[upper]) return KNOWN_MODELS[upper]

  if (/^SM-[A-Z0-9]+/.test(upper)) return `Samsung Galaxy (${model})`
  if (/^CPH[0-9]+/.test(upper) || upper.includes('OPPO')) return `OPPO (${model})`
  if (/^RMX[0-9]+/.test(upper) || upper.includes('REALME')) return `Realme (${model})`
  if (/^V[0-9]{4}[A-Z]*/.test(upper) || upper.includes('VIVO')) return `Vivo (${model})`
  if (/^X[0-9]{3,4}[A-Z]*/.test(upper) || upper.includes('INFINIX')) return `Infinix (${model})`
  if (/^(CK|LH|KJ)[0-9]/.test(upper) || upper.includes('TECNO')) return `Tecno (${model})`
  if (/^W[0-9]{3,4}/.test(upper) || upper.includes('ITEL')) return `itel (${model})`
  if (/^2[0-9]{4}[A-Z0-9]+/.test(upper) || upper.includes('REDMI') || upper.includes('POCO') || upper.includes('XIAOMI')) {
    return `Xiaomi / Redmi (${model})`
  }
  return `Android (${model})`
}

export function parseDeviceInfo(ua?: string | null): ParsedDeviceInfo {
  if (!ua || typeof ua !== 'string') {
    return {
      type: 'unknown',
      platformLabel: 'Perangkat tidak dikenal',
      deviceBrand: 'Tidak diketahui',
      model: null,
      os: 'Tidak diketahui',
      browser: 'Tidak diketahui',
      summary: 'Perangkat tidak diketahui',
    }
  }

  // 1. Android
  const androidMatch = ua.match(/Android\s+([0-9.]+)/i)
  if (androidMatch) {
    const os = `Android ${androidMatch[1]}`
    const isTablet = /tablet/i.test(ua) || (!/mobile/i.test(ua) && !/wv/i.test(ua))
    const type = isTablet ? 'tablet' : 'mobile'
    const platformLabel = isTablet ? 'Tablet Android' : 'Smartphone Android'

    // Ekstrak model dari blok (Linux; Android 15; MODEL Build/...)
    let model: string | null = null
    const linuxBlockMatch = ua.match(/\(([^)]+)\)/)
    if (linuxBlockMatch) {
      const parts = linuxBlockMatch[1].split(';').map(p => p.trim())
      for (const part of parts) {
        if (/Android/i.test(part) || /Linux/i.test(part) || /^wv$/i.test(part) || /arm/i.test(part)) continue
        const cleanPart = part.replace(/Build\/[A-Z0-9._-]+/i, '').trim()
        if (cleanPart.length >= 2 && !/^(U|K|en-us|id-id)$/i.test(cleanPart)) {
          model = cleanPart
          break
        }
      }
    }

    const deviceBrand = model ? resolveAndroidBrand(model) : 'Smartphone Android'
    const isWebView = /wv|Version\/[0-9.]+/i.test(ua)
    const browser = isWebView ? 'Chrome Mobile (Aplikasi / WebView)' : 'Chrome Mobile'

    return {
      type,
      platformLabel,
      deviceBrand,
      model,
      os,
      browser,
      summary: `${platformLabel} · ${deviceBrand}`,
    }
  }

  // 2. iOS - iPhone
  if (/iPhone/i.test(ua)) {
    const osMatch = ua.match(/OS\s+([0-9_]+)/i)
    const osVer = osMatch ? osMatch[1].replace(/_/g, '.') : ''
    const os = osVer ? `iOS ${osVer}` : 'iOS'
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua)
    const browser = isSafari ? 'Safari Mobile' : 'Browser iOS'

    return {
      type: 'mobile',
      platformLabel: 'Apple iPhone',
      deviceBrand: 'Apple iPhone',
      model: 'iPhone',
      os,
      browser,
      summary: `iPhone · ${os}`,
    }
  }

  // 3. iOS - iPad
  if (/iPad/i.test(ua)) {
    const osMatch = ua.match(/OS\s+([0-9_]+)/i)
    const osVer = osMatch ? osMatch[1].replace(/_/g, '.') : ''
    const os = osVer ? `iPadOS ${osVer}` : 'iPadOS'

    return {
      type: 'tablet',
      platformLabel: 'Apple iPad',
      deviceBrand: 'Apple iPad',
      model: 'iPad',
      os,
      browser: 'Safari',
      summary: `iPad · ${os}`,
    }
  }

  // 4. Windows Desktop
  if (/Windows NT/i.test(ua)) {
    let winVer = 'Windows'
    if (/Windows NT 10.0/i.test(ua)) winVer = 'Windows 10 / 11'
    else if (/Windows NT 6.3/i.test(ua)) winVer = 'Windows 8.1'
    else if (/Windows NT 6.1/i.test(ua)) winVer = 'Windows 7'

    const browser = /Edg\//i.test(ua) ? 'Microsoft Edge' : /Chrome\//i.test(ua) ? 'Google Chrome' : /Firefox\//i.test(ua) ? 'Mozilla Firefox' : 'Browser Desktop'

    return {
      type: 'desktop',
      platformLabel: 'Komputer Desktop / Laptop',
      deviceBrand: 'PC / Laptop (Windows)',
      model: null,
      os: winVer,
      browser,
      summary: `Desktop / Laptop · ${winVer}`,
    }
  }

  // 5. Mac Desktop
  if (/Macintosh|Mac OS X/i.test(ua)) {
    const browser = /Chrome\//i.test(ua) ? 'Google Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'Browser Mac'
    return {
      type: 'desktop',
      platformLabel: 'Apple Mac / MacBook',
      deviceBrand: 'Apple Mac',
      model: null,
      os: 'macOS',
      browser,
      summary: 'Mac / MacBook · macOS',
    }
  }

  // 6. Linux Desktop
  if (/Linux/i.test(ua)) {
    return {
      type: 'desktop',
      platformLabel: 'Komputer Linux',
      deviceBrand: 'PC / Laptop (Linux)',
      model: null,
      os: 'Linux',
      browser: 'Browser Linux',
      summary: 'Desktop · Linux',
    }
  }

  // Fallback
  return {
    type: 'unknown',
    platformLabel: 'Perangkat',
    deviceBrand: 'Perangkat Web',
    model: null,
    os: 'Tidak diketahui',
    browser: 'Browser Web',
    summary: 'Perangkat Web',
  }
}
