import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/* /api/* 转发到本机 python3 server.py（默认 8766）：密钥只在 Python 侧读取。
   未启动代理时，工作台会提示启动方式，表单仍可正常预览。 */
const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8766',
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
