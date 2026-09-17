<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSession } from '../composables/session'

/* 登录弹窗：手机号验证码（演示环境任意验证码可登录）+ 微信扫码占位 */
const { loginOpen, closeLogin, loginWithPhone } = useSession()

const tab = ref<'phone' | 'wechat'>('phone')
const phone = ref('')
const code = ref('')
const countdown = ref(0)
const sent = ref(false)
const error = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const phoneOk = computed(() => /^1\d{10}$/.test(phone.value.trim()))
const codeOk = computed(() => /^\d{4,6}$/.test(code.value.trim()))
const canSubmit = computed(() => phoneOk.value && codeOk.value && sent.value)

function sendCode() {
  if (!phoneOk.value || countdown.value > 0) return
  sent.value = true
  error.value = ''
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) { clearInterval(timer); timer = null }
  }, 1000)
}

function submit() {
  if (!phoneOk.value) { error.value = '请输入正确的 11 位手机号'; return }
  if (!sent.value) { error.value = '请先点击"获取验证码"'; return }
  if (!codeOk.value) { error.value = '请输入 4-6 位数字验证码'; return }
  loginWithPhone(phone.value.trim())
}

watch(loginOpen, open => {
  if (open) {
    tab.value = 'phone'
    error.value = ''
  } else {
    phone.value = ''
    code.value = ''
    sent.value = false
    countdown.value = 0
    error.value = ''
    if (timer) { clearInterval(timer); timer = null }
  }
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && loginOpen.value) closeLogin()
}
</script>

<template>
  <Teleport to="body">
    <div class="login-mask" v-if="loginOpen" @click.self="closeLogin" @keydown="onKeydown">
      <div class="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button type="button" class="login-close" aria-label="关闭登录" @click="closeLogin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>

        <div class="login-brand" aria-hidden="true"><img src="/logo.png" alt=""></div>
        <h2 class="login-title" id="login-title">登录</h2>
        <p class="login-sub">同步你的 SKILL 收藏与使用记录</p>

        <div class="login-tabs" role="tablist" aria-label="登录方式">
          <button type="button" class="chip" :class="{ 'is-on': tab === 'phone' }" role="tab" :aria-selected="tab === 'phone'" @click="tab = 'phone'">验证码登录</button>
          <button type="button" class="chip" :class="{ 'is-on': tab === 'wechat' }" role="tab" :aria-selected="tab === 'wechat'" @click="tab = 'wechat'">微信扫码</button>
        </div>

        <form v-if="tab === 'phone'" class="login-form" @submit.prevent="submit">
          <label class="login-field">
            <span class="vh">手机号</span>
            <input v-model="phone" type="tel" inputmode="numeric" maxlength="11" placeholder="手机号" autocomplete="tel">
          </label>
          <div class="login-code-row">
            <label class="login-field login-code-field">
              <span class="vh">验证码</span>
              <input v-model="code" type="text" inputmode="numeric" maxlength="6" placeholder="验证码" autocomplete="one-time-code">
            </label>
            <button type="button" class="login-send" :disabled="!phoneOk || countdown > 0" @click="sendCode">
              {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
            </button>
          </div>
          <p v-if="error" class="login-error" role="alert">{{ error }}</p>
          <button type="submit" class="login-submit" :disabled="!canSubmit">登录</button>
          <p class="login-note">演示环境：点击"获取验证码"后，输入任意 4-6 位数字即可登录。</p>
        </form>

        <div v-else class="login-wechat">
          <div class="login-qr" aria-label="微信登录二维码（示意）">
            <svg viewBox="0 0 21 21" width="132" height="132" shape-rendering="crispEdges" aria-hidden="true">
              <rect width="21" height="21" fill="#fff"/>
              <path fill="#17181C" d="M1 1h6v6H1zM14 1h6v6h-6zM1 14h6v6H1z"/>
              <path fill="#fff" d="M3 3h2v2H3zM16 3h2v2h-2zM3 16h2v2H3z"/>
              <path fill="#17181C" d="M9 2h1v1H9zM11 1h1v2h-1zM10 4h2v1h-2zM9 6h1v1H9zM12 5h1v1h-1zM2 9h1v1H2zM4 8h2v1H4zM1 11h2v1H1zM5 10h1v2H5zM8 9h2v2H8zM11 8h1v1h-1zM13 10h2v1h-2zM16 9h1v2h-1zM19 11h1v1h-1zM9 12h1v2H9zM11 11h2v1h-2zM14 13h1v1h-1zM16 12h2v2h-2zM2 13h1v2H2zM6 14h1v1H6zM9 15h2v1H9zM12 14h1v2h-1zM15 15h2v1h-2zM19 14h1v1h-1zM8 17h1v2H8zM10 19h2v1h-2zM13 17h1v2h-1zM17 16h1v2h-1zM19 18h1v2h-1zM6 17h1v1H6zM4 19h1v1H4zM12 17h1v1h-1z"/>
            </svg>
          </div>
          <p class="login-wechat-tip">使用微信扫一扫登录<span class="login-wechat-demo">（示意二维码 · 演示环境暂不可扫）</span></p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
