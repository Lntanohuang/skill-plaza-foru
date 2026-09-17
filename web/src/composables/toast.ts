import { reactive } from 'vue'

/* 全局 toast：沿用原版样式（.toast / .toast-host） */
interface ToastState {
  message: string
  id: number
}

export const toasts = reactive<ToastState[]>([])
let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined

export function toast(message: string) {
  const id = ++seq
  toasts.length = 0
  toasts.push({ message, id })
  clearTimeout(timer)
  timer = setTimeout(() => {
    toasts.length = 0
  }, 2600)
}
