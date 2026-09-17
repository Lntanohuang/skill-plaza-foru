import { ref } from 'vue'

/* 演示级会话：仅前端状态 + localStorage 持久化，无真实后端 */
export interface SessionUser {
  phone: string
  nickname: string
}

const KEY = 'skill-plaza:user'
const user = ref<SessionUser | null>(null)
const loginOpen = ref(false)

try {
  const raw = localStorage.getItem(KEY)
  if (raw) user.value = JSON.parse(raw)
} catch { /* 忽略损坏数据 */ }

export function useSession() {
  function openLogin() { loginOpen.value = true }
  function closeLogin() { loginOpen.value = false }

  function loginWithPhone(phone: string) {
    user.value = { phone, nickname: `用户${phone.slice(-4)}` }
    try { localStorage.setItem(KEY, JSON.stringify(user.value)) } catch { /* 忽略 */ }
    loginOpen.value = false
  }

  function logout() {
    user.value = null
    try { localStorage.removeItem(KEY) } catch { /* 忽略 */ }
  }

  return { user, loginOpen, openLogin, closeLogin, loginWithPhone, logout }
}
