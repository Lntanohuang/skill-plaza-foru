import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/* /api/* 转发到本机 Node 后端（server/index.ts，默认 8767）：
   由它桥接 ZCode app-server（GLM Coding Plan），密钥与 CLI 都不进前端。
   未启动后端时，工作台会提示启动方式，表单仍可正常预览。 */
const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8767',
    changeOrigin: false,
  },
}

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 4188,
    proxy: apiProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 4188,
    proxy: apiProxy,
  },
})
