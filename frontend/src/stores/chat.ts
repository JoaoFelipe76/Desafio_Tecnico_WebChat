import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export type ChatMessage = { role: 'user' | 'ai'; content: string }

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const online = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const sessionId = ref<string>(localStorage.getItem('turbonet_session') || '')

  const canSend = computed(() => !loading.value && online.value)

  function addMessage(m: ChatMessage) { messages.value.push(m) }
  function setLoading(v: boolean) { loading.value = v }
  function setOnline(v: boolean) { online.value = v }
  function setSession(id: string) { sessionId.value = id; localStorage.setItem('turbonet_session', id) }
  function clear() { messages.value = [] }

  return { messages, loading, online, sessionId, canSend, addMessage, setLoading, setOnline, setSession, clear }
})


