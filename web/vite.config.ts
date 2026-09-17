import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/* /api/* 转发到本机 Node 后端（server/index.ts，默认 8767）：
   由它桥接 ZCode app-server（GLM Coding Plan）并提供运行记录只读 API。
   未启动后端时，运行记录页自动回落演示数据，在线运行页会提示启动方式。 */
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
