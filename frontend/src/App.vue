<template>
  <div class="page">
    <div class="chat-shell">
      <ChatWidget :apiBase="apiBase" agent-name="TurboNet" agent-avatar="https://ui-avatars.com/api/?name=TN&background=0D8ABC&color=fff" />
    </div>
  </div>
  
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
const ChatWidget = defineAsyncComponent(() => import('./components/ChatWidget.vue'))
const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3000'
</script>

<style scoped>
.page { height:100%; }
.chat-shell {
  height:100%;
}
</style>
