import source from './assets/observabr-icon.svg?raw'
import './observa-eye.css'

// Geometry comes from the supplied, local brand asset. Only the inner group moves.
class ObservaEye extends HTMLElement {
  connectedCallback() {
    if (this.controller) return
    if (!this.svg) {
      this.svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
      this.svg.removeAttribute('role')
      this.svg.removeAttribute('aria-label')
      this.svg.setAttribute('aria-hidden', 'true')
      this.svg.setAttribute('focusable', 'false')
      this.svg.querySelector('rect').remove()
      this.svg.querySelector('path').setAttribute('stroke', 'currentColor')
      this.iris = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      this.iris.setAttribute('data-eye-iris', '')
      const circles = [...this.svg.querySelectorAll('circle')]
      circles[0].setAttribute('stroke', 'currentColor')
      this.iris.append(...circles)
      this.svg.append(this.iris)
      this.replaceChildren(this.svg)
    }
    this.controller = new AbortController()
    const options = {signal:this.controller.signal, passive:true}
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const fine = matchMedia('(any-pointer: fine)')
    let frame = 0, previous = 0, x = 0, y = 0, tx = 0, ty = 0, pointer = null
    const allowed = () => !reduced.matches && fine.matches && !navigator.maxTouchPoints
    const paint = () => {
      if (x || y) this.iris.setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)})`)
      else this.iris.removeAttribute('transform')
    }
    const render = time => {
      frame = 0
      if (pointer) {
        const rect = this.svg.getBoundingClientRect()
        const dx = pointer.x - rect.left - rect.width / 2
        const dy = pointer.y - rect.top - rect.height / 2
        const distance = Math.hypot(dx, dy) || 1
        const intensity = Math.min(distance / 140, 1)
        tx = dx / distance * 5 * intensity
        ty = dy / distance * 3.2 * intensity
      }
      const elapsed = previous ? Math.min(time - previous, 64) : 16.67
      const easing = 1 - Math.exp(-elapsed / 84)
      previous = time
      x += (tx - x) * easing
      y += (ty - y) * easing
      const moving = Math.abs(tx - x) + Math.abs(ty - y) > .01
      if (!moving) { x = tx; y = ty }
      paint()
      if (moving) frame = requestAnimationFrame(render)
      else previous = 0
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render) }
    const reset = (immediate = false) => {
      pointer = null
      tx = ty = 0
      if (immediate || !allowed()) {
        cancelAnimationFrame(frame)
        frame = previous = x = y = 0
        paint()
      } else schedule()
    }
    window.addEventListener('pointermove', event => {
      if (!allowed() || event.pointerType === 'touch') { reset(true); return }
      pointer = {x:event.clientX, y:event.clientY}
      schedule()
    }, options)
    window.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') reset(true)
    }, options)
    document.documentElement.addEventListener('pointerleave', () => reset(), options)
    window.addEventListener('blur', () => reset(), options)
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(true) }, options)
    reduced.addEventListener('change', () => reset(true), options)
    fine.addEventListener('change', () => reset(true), options)
    const reposition = () => { if (pointer && allowed()) schedule() }
    window.addEventListener('resize', reposition, options)
    window.addEventListener('scroll', reposition, {...options, capture:true})
    this.cleanup = () => reset(true)
  }

  disconnectedCallback() {
    this.controller?.abort()
    this.cleanup?.()
    this.controller = null
  }
}

customElements.define('observa-eye', ObservaEye)
