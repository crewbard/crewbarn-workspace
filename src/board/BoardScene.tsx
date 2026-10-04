import { useEffect, useRef } from 'react'

import type { BoardLayout } from '@/board/boardApi'

/**
 * Something to look at behind the board.
 *
 * ── What these are, and what they are not ────────────────────────────
 *
 * Painted, not filmed. A photoreal fireplace means a video file, and a
 * video file means either licensing footage we do not own or asking
 * every shop to supply their own — plus tens of megabytes re-fetched by
 * a television that may be on shop wifi behind a microwave. These are a
 * few hundred lines of canvas that loop forever, cost nothing to ship,
 * and never buffer.
 *
 * They are stylised on purpose rather than by accident. A drawn scene
 * that is trying to be a photograph and failing looks cheap; the same
 * scene confident about being drawn looks deliberate. So: real particle
 * physics, real parallax, honest silhouettes.
 *
 * ── Why it will not slow the wall down ───────────────────────────────
 *
 * One canvas, one rAF loop, particle counts scaled to the canvas area
 * rather than fixed — a 4K panel and a 1080p one both get roughly the
 * same density instead of the 4K one getting four times the work. It
 * pauses itself when the tab is hidden, which on a TV browser happens
 * whenever the screensaver or an overlay takes over, and it stops dead
 * when the scene is 'none' so a shop that does not want this pays
 * nothing for it.
 *
 * Everything sits at opacity behind the cards. A board you cannot read
 * is not improved by weather.
 */

export type SceneName = NonNullable<BoardLayout['look']['scene']>

interface Particle {
  x: number
  y: number
  z: number // depth: drives size, speed and opacity together
  vx: number
  vy: number
  life: number
}

/** How the sky is painted, top to bottom, per scene. */
const SKY: Record<string, [string, string, string]> = {
  snow: ['#0b1622', '#16283c', '#243a52'],
  rain: ['#0a0f16', '#121b26', '#1b2836'],
  fire: ['#150b06', '#22120a', '#2e1a0e'],
  ocean: ['#04121c', '#07263a', '#0b3a55'],
  forest: ['#07140d', '#0d2416', '#143520'],
}

export function BoardScene({ scene, url }: { scene?: SceneName | null; url?: string | null }) {
  /*
   * A shop's own loop wins over anything painted.
   *
   * Muted is not a preference, it is the only way this plays at all: a
   * browser autoplays muted video with no user gesture and refuses to
   * autoplay anything with sound. An unattended wall cannot tap itself.
   *
   * The src is a short-lived signed URL, re-minted on every config call,
   * so the file never has to be public.
   */
  // A shipped backdrop and a shop's own are the same thing once the
  // config call has resolved either to a signed URL.
  if (scene === 'own' || scene === 'library') {
    if (!url) return null
    const video = /\.(mp4|webm)(\?|$)/i.test(url)
    return video ? (
      <video className="tv-backdrop" src={url} autoPlay muted loop playsInline aria-hidden="true" />
    ) : (
      <img className="tv-backdrop tv-backdrop-still" src={url} alt="" aria-hidden="true" />
    )
  }

  return <PaintedScene scene={scene} />
}

function PaintedScene({ scene }: { scene?: SceneName | null }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!scene || scene === 'none') return
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let alive = true
    let parts: Particle[] = []
    let w = 0
    let h = 0
    // Film grain, rendered once and then shifted about.
    let grain: HTMLCanvasElement | null = null

    const seed = () => {
      // offsetWidth is 0 until the element has been laid out, and a
      // canvas seeded at zero never draws and never re-seeds.
      w = canvas.width = canvas.offsetWidth || window.innerWidth
      h = canvas.height = canvas.offsetHeight || window.innerHeight
      // Density by area, so a 4K panel is not asked to do four times the
      // work of a 1080p one for the same picture.
      const n = Math.round((w * h) / 14000)
      parts = Array.from({ length: n }, () => spawn(true))

      /*
       * Grain is the single biggest reason a painted scene reads as
       * painted.
       *
       * Real footage has sensor noise; a mathematical gradient has
       * none, and the eye files perfectly smooth as fake before it can
       * say why.
       *
       * Built once at the canvas's own size, so drawing it costs a
       * single blit per frame. A small tile would be cheaper to build
       * and then cost a hundred and thirty blits a frame on a 4K panel,
       * which is the wrong way round for something that runs all day.
       */
      const g = document.createElement('canvas')
      g.width = w
      g.height = h
      const gc = g.getContext('2d')
      if (gc) {
        const img = gc.createImageData(w, h)
        for (let i = 0; i < img.data.length; i += 4) {
          const v = 120 + Math.random() * 135
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v
          img.data[i + 3] = 255
        }
        gc.putImageData(img, 0, 0)
        grain = g
      }
    }

    const spawn = (anywhere: boolean): Particle => {
      const z = 0.3 + Math.random() * 0.7
      switch (scene) {
        case 'rain':
          return {
            x: Math.random() * w,
            y: anywhere ? Math.random() * h : -20,
            z,
            vx: 0.6 * z,
            vy: (9 + Math.random() * 6) * z,
            life: 1,
          }
        case 'fire':
          // Out of the fire itself, not off the bottom edge of the
          // screen — embers that start below the logs read as rising
          // from the floor.
          return {
            x: w / 2 + (Math.random() - 0.5) * Math.min(w * 0.3, h * 0.5),
            y: h * 0.9,
            z,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -(0.6 + Math.random() * 1.4) * z,
            life: 1,
          }
        case 'ocean':
        case 'forest':
          // Drifting motes — dust in a shaft of light, spray off a swell.
          return {
            x: Math.random() * w,
            y: anywhere ? Math.random() * h : h + 8,
            z,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -(0.15 + Math.random() * 0.35) * z,
            life: 1,
          }
        default: // snow
          return {
            x: Math.random() * w,
            y: anywhere ? Math.random() * h : -10,
            z,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (0.5 + Math.random() * 1.1) * z,
            life: 1,
          }
      }
    }

    const sky = () => {
      /*
       * Clear first, always.
       *
       * The gradient below is what normally wipes the frame, but
       * createLinearGradient on a zero-height canvas paints nothing —
       * and then the hearth's 24%-alpha glow composites onto the
       * previous frame instead of a fresh one, saturating to solid
       * orange in about a second. Which is exactly what a shop wall
       * showed.
       */
      ctx.clearRect(0, 0, w, h)
      if (w === 0 || h === 0) return

      const [a, b, c] = SKY[scene] ?? SKY.snow
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, a)
      g.addColorStop(0.55, b)
      g.addColorStop(1, c)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      if (scene === 'snow' || scene === 'forest') ridges()
      if (scene === 'ocean') swell()
      if (scene === 'fire') hearth()
    }

    /** Two ranges, the far one paler — the whole trick of depth. */
    const ridges = () => {
      const far = scene === 'forest' ? '#12301d' : '#1d3047'
      const near = scene === 'forest' ? '#0a1f11' : '#101d2c'
      for (const [colour, base, amp, step] of [
        [far, 0.62, 0.13, 190],
        [near, 0.76, 0.1, 120],
      ] as Array<[string, number, number, number]>) {
        ctx.fillStyle = colour
        ctx.beginPath()
        ctx.moveTo(0, h)
        for (let x = 0; x <= w + step; x += step) {
          const y = h * base - Math.sin(x / step) * h * amp - (x % (step * 2)) * 0.05
          ctx.lineTo(x, y)
        }
        ctx.lineTo(w, h)
        ctx.closePath()
        ctx.fill()
      }
    }

    /** Slow horizontal bands. Water read from a distance is bands. */
    const swell = () => {
      const t = Date.now() / 2600
      for (let i = 0; i < 7; i++) {
        const y = h * (0.55 + i * 0.065)
        ctx.strokeStyle = `rgba(150, 210, 240, ${0.05 + i * 0.012})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let x = 0; x <= w; x += 12) {
          ctx.lineTo(x, y + Math.sin(x / 90 + t + i) * 4)
        }
        ctx.stroke()
      }
    }

    /** A warm pool at the bottom that breathes. */
    /**
     * One tongue of flame.
     *
     * A tapered bezier from a wide base to a wandering tip, filled with
     * a gradient that runs white-hot at the bottom to nothing at the
     * top. Drawn additively by the caller, so overlapping tongues brighten
     * each other the way emitted light does.
     */
    const tongue = (
      cx: number,
      baseY: number,
      wide: number,
      tall: number,
      t: number,
      seed: number,
      bright: number,
    ) => {
      // Three frequencies that do not divide into each other, so the
      // motion never visibly repeats.
      const sway =
        Math.sin(t * 1.7 + seed) * wide * 0.5 +
        Math.sin(t * 3.1 + seed * 2.3) * wide * 0.22 +
        Math.sin(t * 5.3 + seed * 0.7) * wide * 0.1
      const lick = 0.72 + Math.sin(t * 2.4 + seed * 1.9) * 0.2 + Math.sin(t * 4.1 + seed) * 0.08
      const height = tall * lick
      const tipX = cx + sway
      const tipY = baseY - height

      const g = ctx.createLinearGradient(cx, baseY, tipX, tipY)
      g.addColorStop(0, `rgba(255, 248, 214, ${0.95 * bright})`)
      g.addColorStop(0.2, `rgba(255, 196, 92, ${0.85 * bright})`)
      g.addColorStop(0.55, `rgba(247, 126, 26, ${0.5 * bright})`)
      g.addColorStop(1, 'rgba(160, 40, 0, 0)')

      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(cx - wide / 2, baseY)
      ctx.quadraticCurveTo(cx - wide * 0.62 + sway * 0.35, baseY - height * 0.58, tipX, tipY)
      ctx.quadraticCurveTo(cx + wide * 0.62 + sway * 0.35, baseY - height * 0.58, cx + wide / 2, baseY)
      ctx.closePath()
      ctx.fill()
    }

    /**
     * A rounded rectangle without ctx.roundRect.
     *
     * roundRect is Chrome 99 and Safari 16. A Fire Stick or a five-year
     * old panel may be neither, and a throw inside the animation loop
     * does not degrade the backdrop, it kills it.
     */
    const pill = (x: number, y: number, rw: number, rh: number, r: number) => {
      const rad = Math.min(r, rw / 2, rh / 2)
      ctx.beginPath()
      ctx.moveTo(x + rad, y)
      ctx.lineTo(x + rw - rad, y)
      ctx.arcTo(x + rw, y, x + rw, y + rad, rad)
      ctx.lineTo(x + rw, y + rh - rad)
      ctx.arcTo(x + rw, y + rh, x + rw - rad, y + rh, rad)
      ctx.lineTo(x + rad, y + rh)
      ctx.arcTo(x, y + rh, x, y + rh - rad, rad)
      ctx.lineTo(x, y + rad)
      ctx.arcTo(x, y, x + rad, y, rad)
      ctx.closePath()
    }

    /** A log: dark cylinder, lit along its top edge, glowing at the ends. */
    const log = (cx: number, cy: number, len: number, thick: number, tilt: number, t: number) => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(tilt)

      ctx.fillStyle = '#2a1a11'
      pill(-len / 2, -thick / 2, len, thick, thick / 2)
      ctx.fill()

      // The top edge takes the firelight; without it a log is a smudge.
      ctx.fillStyle = 'rgba(122, 78, 44, 0.85)'
      pill(-len / 2 + thick * 0.2, -thick / 2, len - thick * 0.4, thick * 0.32, thick * 0.16)
      ctx.fill()

      // Burning ends, breathing slightly out of step with the flames.
      const heat = 0.55 + Math.sin(t * 1.3 + cx) * 0.25
      for (const end of [-len / 2, len / 2]) {
        const e = ctx.createRadialGradient(end, 0, 0, end, 0, thick * 0.9)
        e.addColorStop(0, `rgba(255, 150, 50, ${heat})`)
        e.addColorStop(1, 'rgba(255, 90, 0, 0)')
        ctx.fillStyle = e
        ctx.beginPath()
        ctx.arc(end, 0, thick * 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const hearth = () => {
      const t = Date.now() / 1000
      // The fire sits on the floor of the screen, sized to it.
      const baseY = h * 0.94
      const cx = w / 2
      const span = Math.min(w * 0.42, h * 0.75)

      // The light it throws into the room, before the fire itself.
      const glow = 0.3 + Math.sin(t * 1.1) * 0.05 + Math.sin(t * 2.7) * 0.03
      const room = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, span * 2.4)
      room.addColorStop(0, `rgba(255, 146, 46, ${glow})`)
      room.addColorStop(0.45, 'rgba(190, 70, 15, 0.09)')
      room.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = room
      ctx.fillRect(0, 0, w, h)

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // Back tongues: taller, wider, dimmer — the body of the fire.
      for (let i = 0; i < 7; i++) {
        const o = (i / 6 - 0.5) * span * 0.82
        tongue(cx + o, baseY, span * 0.3, span * (0.62 + (i % 3) * 0.14), t, i * 1.31, 0.5)
      }
      ctx.restore()

      // The logs sit inside the fire, so they are drawn between the body
      // and the tongues that lick over the front of them.
      log(cx - span * 0.16, baseY - span * 0.04, span * 0.86, span * 0.13, -0.06, t)
      log(cx + span * 0.13, baseY - span * 0.12, span * 0.74, span * 0.115, 0.1, t)
      log(cx - span * 0.02, baseY - span * 0.21, span * 0.58, span * 0.1, -0.16, t)

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // The white-hot bed under and between them.
      const bed = ctx.createRadialGradient(cx, baseY - span * 0.04, 0, cx, baseY - span * 0.04, span * 0.5)
      bed.addColorStop(0, `rgba(255, 224, 150, ${0.5 + Math.sin(t * 3.3) * 0.08})`)
      bed.addColorStop(0.5, 'rgba(255, 120, 20, 0.22)')
      bed.addColorStop(1, 'rgba(255, 80, 0, 0)')
      ctx.fillStyle = bed
      ctx.beginPath()
      ctx.ellipse(cx, baseY - span * 0.04, span * 0.5, span * 0.2, 0, 0, Math.PI * 2)
      ctx.fill()

      // Front tongues: shorter, brighter, licking over the logs.
      for (let i = 0; i < 9; i++) {
        const o = (i / 8 - 0.5) * span * 0.66
        tongue(cx + o, baseY - span * 0.1, span * 0.17, span * (0.4 + (i % 4) * 0.1), t * 1.25, i * 2.17 + 5, 0.95)
      }
      ctx.restore()
    }

    const draw = () => {
      if (!alive) return
      sky()

      for (const p of parts) {
        p.x += p.vx
        p.y += p.vy
        if (scene === 'snow') p.x += Math.sin((p.y + p.z * 100) / 60) * 0.4
        if (scene === 'fire') {
          p.life -= 0.006
          p.x += Math.sin(p.y / 26) * 0.35
        }

        const gone =
          p.y > h + 20 || p.y < -30 || p.x < -30 || p.x > w + 30 || p.life <= 0
        if (gone) Object.assign(p, spawn(false))

        if (scene === 'rain') {
          ctx.strokeStyle = `rgba(175, 205, 235, ${0.1 + p.z * 0.22})`
          ctx.lineWidth = p.z * 1.3
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2)
          ctx.stroke()
        } else if (scene === 'fire') {
          ctx.fillStyle = `rgba(255, ${Math.round(120 + p.life * 110)}, 40, ${p.life * 0.75})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.z * 1.7, 0, Math.PI * 2)
          ctx.fill()
        } else {
          const tint = scene === 'forest' ? '190, 225, 190' : scene === 'ocean' ? '200, 230, 245' : '255, 255, 255'
          ctx.fillStyle = `rgba(${tint}, ${0.16 + p.z * 0.4})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.z * (scene === 'snow' ? 1.9 : 1.2), 0, Math.PI * 2)
          ctx.fill()
        }
      }

      finish()
      raf = requestAnimationFrame(draw)
    }

    /*
     * The two passes that sell depth.
     *
     * A vignette, because no lens is evenly lit edge to edge and a
     * perfectly flat frame is the other half of why a gradient reads as
     * computer-generated. Then grain over everything, shifted each
     * frame so it shimmers the way film does rather than sitting still
     * like a texture.
     */
    const finish = () => {
      const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75)
      v.addColorStop(0, 'rgba(0,0,0,0)')
      v.addColorStop(1, 'rgba(0,0,0,0.55)')
      ctx.fillStyle = v
      ctx.fillRect(0, 0, w, h)

      if (!grain) return
      ctx.save()
      ctx.globalAlpha = 0.045
      ctx.globalCompositeOperation = 'overlay'
      // Nudged a few pixels each frame so it shimmers like film rather
      // than sitting still like dirt on the screen. One blit.
      ctx.drawImage(grain, -Math.random() * 6, -Math.random() * 6)
      ctx.restore()
    }

    // A hidden tab still runs rAF on some TV browsers; stopping by hand
    // keeps a screensavered panel from burning CPU all night.
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        cancelAnimationFrame(raf)
      } else if (alive) {
        raf = requestAnimationFrame(draw)
      }
    }

    seed()
    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', seed)
    document.addEventListener('visibilitychange', visibility)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', seed)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [scene])

  if (!scene || scene === 'none') return null

  return <canvas ref={ref} className="tv-backdrop" aria-hidden="true" />
}
