import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { printAttendanceDocument, reserveAttendancePrintWindow } from './attendance-print-client'

const mocks = vi.hoisted(() => ({ native: vi.fn(() => false), printNative: vi.fn(async () => true) }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }))
vi.mock('@/lib/native-print', () => ({ printHtmlNative: mocks.printNative }))

function fakeWindow(images: object[] = [], fontsReady = Promise.resolve()) {
  return {
    closed: false, focus: vi.fn(), print: vi.fn(), close: vi.fn(),
    document: { open: vi.fn(), write: vi.fn(), close: vi.fn(), title: '', body: { textContent: '' }, images, fonts: { ready: fontsReady } },
  }
}

beforeEach(() => { mocks.native.mockReturnValue(false); mocks.printNative.mockClear() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('attendance print transport', () => {
  it('reserves a browser window synchronously and reports popup blocking', () => {
    const target = fakeWindow()
    const open = vi.fn().mockReturnValueOnce(target).mockReturnValueOnce(null)
    vi.stubGlobal('window', { open })
    expect(reserveAttendancePrintWindow()).toBe(target)
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(() => reserveAttendancePrintWindow()).toThrow('Popup diblokir')
  })

  it('writes the freshly supplied document and waits for fonts before printing', async () => {
    let ready!: () => void
    const fonts = new Promise<void>(resolve => { ready = resolve })
    const target = fakeWindow([], fonts)
    const job = printAttendanceDocument('<html>fresh report</html>', target as unknown as Window)
    await Promise.resolve()
    expect(target.document.write).toHaveBeenCalledWith('<html>fresh report</html>')
    expect(target.print).not.toHaveBeenCalled()
    ready()
    await job
    expect(target.print).toHaveBeenCalledOnce()
  })

  it('waits for the letterhead load event', async () => {
    const image = Object.assign(new EventTarget(), { complete: false, naturalWidth: 0 })
    const target = fakeWindow([image])
    const job = printAttendanceDocument('<html/>', target as unknown as Window)
    expect(target.print).not.toHaveBeenCalled()
    image.dispatchEvent(new Event('load'))
    await job
    expect(target.print).toHaveBeenCalledOnce()
  })

  it('closes the temporary window and does not print when letterhead fails', async () => {
    const image = Object.assign(new EventTarget(), { complete: true, naturalWidth: 0 })
    const target = fakeWindow([image])
    await expect(printAttendanceDocument('<html/>', target as unknown as Window)).rejects.toThrow('kop surat gagal')
    expect(target.close).toHaveBeenCalledOnce()
    expect(target.print).not.toHaveBeenCalled()
  })

  it('uses the native bridge without opening a browser popup', async () => {
    mocks.native.mockReturnValue(true)
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    vi.stubGlobal('DOMParser', class { parseFromString() { return { images: [], title: 'Native attendance' } } })
    expect(reserveAttendancePrintWindow()).toBeNull()
    await printAttendanceDocument('<html/>', null)
    expect(mocks.printNative).toHaveBeenCalledWith('<html/>', 'Native attendance')
    expect(open).not.toHaveBeenCalled()
  })
})
