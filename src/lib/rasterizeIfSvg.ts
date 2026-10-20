import DOMPurify from 'dompurify'
import { looksLikeSvg, pictureSize, pixels, pngName } from './svgPicture'

export const SVG_NOT_DRAWN = "That SVG couldn't be turned into a picture. Save it as a PNG or JPG and try again."

/**
 * CrewBarn doesn't take SVG files: a script can hide in one (security plan
 * 2026-10-19, batch C), and the server refuses them. When someone picks one
 * anyway, the browser draws it as a PNG first, cleaned of scripts and
 * outside links, and that is what gets uploaded. Any other file comes back
 * as it was.
 *
 * Throws SVG_NOT_DRAWN when the SVG can't be drawn (a broken file, or a
 * gzipped .svgz).
 */
export async function rasterizeIfSvg(file: File, sides: { min?: number; max?: number } = {}): Promise<File> {
  const head = await file.slice(0, 4096).text()
  if (!looksLikeSvg(file.name, file.type, head)) return file
  if (/\.svgz$/i.test(file.name)) throw new Error(SVG_NOT_DRAWN)

  const body = DOMPurify.sanitize(await file.text(), {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Pictures from elsewhere and HTML inside the drawing: they would stop the canvas from being saved.
    FORBID_TAGS: ['foreignObject', 'image', 'a'],
    RETURN_DOM: true,
  }) as HTMLElement
  const svg = body.querySelector('svg')
  if (!svg) throw new Error(SVG_NOT_DRAWN)

  const width = svg.getAttribute('width')
  const height = svg.getAttribute('height')
  const size = pictureSize(width, height, svg.getAttribute('viewBox'), sides.min, sides.max)
  // A drawing with a size but no viewBox would be cut off, not scaled, when it's drawn bigger.
  if (!svg.getAttribute('viewBox') && pixels(width) && pixels(height)) {
    svg.setAttribute('viewBox', `0 0 ${pixels(width)} ${pixels(height)}`)
  }
  svg.setAttribute('width', String(size.width))
  svg.setAttribute('height', String(size.height))

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(SVG_NOT_DRAWN))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(SVG_NOT_DRAWN)
    ctx.drawImage(img, 0, 0, size.width, size.height)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error(SVG_NOT_DRAWN)
    return new File([png], pngName(file.name), { type: 'image/png' })
  } catch {
    throw new Error(SVG_NOT_DRAWN)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * rasterizeIfSvg, or the file as it was when it can't be drawn: the upload
 * then gets the server's own plain answer ("SVG files can't be uploaded…").
 * For pickers that have no error line of their own.
 */
export async function asPicture(file: File): Promise<File> {
  try {
    return await rasterizeIfSvg(file)
  } catch {
    return file
  }
}
