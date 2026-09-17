import { ref } from 'vue'
import { toast } from './toast'

/* 移植原 copyText：成功提示已复制；失败自动选中对应 pre 文本，提示手动复制 */
export function useCopy() {
  const copied = ref(false)
  const failed = ref(false)

  async function copy(text: string, message: string, preEl?: HTMLElement | null) {
    let area: HTMLTextAreaElement | undefined
    try {
      if (navigator.clipboard && isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        area = document.createElement('textarea')
        area.value = text
        area.style.cssText = 'position:fixed;opacity:0;left:0;top:0'
        document.body.append(area)
        area.select()
        if (!document.execCommand('copy')) throw new Error('copy rejected')
      }
      copied.value = true
      failed.value = false
      toast(message)
    } catch {
      copied.value = false
      failed.value = true
      const pre = preEl
      if (pre) {
        const range = document.createRange()
        range.selectNodeContents(pre)
        const selection = getSelection()
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }
      toast('没能自动复制，已经把文字选中，请手动复制。')
    } finally {
      area?.remove()
      setTimeout(() => {
        copied.value = false
        failed.value = false
      }, 2200)
    }
  }

  return { copied, failed, copy }
}
