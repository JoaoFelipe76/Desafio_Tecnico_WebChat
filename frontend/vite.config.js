import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'src/web-component/index.js',
      name: 'TurboNetChatbot',
      formats: ['es', 'umd'],
      fileName: (format) => `turbonet-chatbot.${format}.js`
    }
  }
})

