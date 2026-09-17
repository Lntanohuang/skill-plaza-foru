import type { Directive } from 'vue'

/* 滚动入场：元素进入视口时淡入上移（一次性）。
   binding.value = 延迟毫秒数，用于同组元素的 stagger 错峰。
   入场动画播完后会摘掉 reveal 类——否则 transition 会覆盖元素自身
   （如 .card）的悬停过渡与 transition-delay，导致悬停迟钝。
   prefers-reduced-motion 或不支持 IO 时直接显示。 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

export const vReveal: Directive<HTMLElement & { __revealIO?: IntersectionObserver; __revealTimer?: number }, number | undefined> = {
  mounted(el, binding) {
    el.classList.add('reveal')
    if (binding.value) el.style.setProperty('--reveal-delay', `${binding.value}ms`)

    if (reduced.matches || !('IntersectionObserver' in window)) {
      el.classList.add('is-inview')
      return
    }
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          el.classList.add('is-inview')
          /* 入场过渡结束后还原元素自身 transition（悬停不再受 stagger 延迟影响） */
          el.__revealTimer = window.setTimeout(() => {
            el.classList.remove('reveal', 'is-inview')
            el.style.removeProperty('--reveal-delay')
          }, (binding.value || 0) + 700)
          io.disconnect()
          delete el.__revealIO
          break
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' })
    io.observe(el)
    el.__revealIO = io
  },
  unmounted(el) {
    el.__revealIO?.disconnect()
    delete el.__revealIO
    clearTimeout(el.__revealTimer)
  },
}
