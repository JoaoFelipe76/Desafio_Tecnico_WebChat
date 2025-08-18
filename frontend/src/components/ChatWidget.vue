<template>
  <div class="widget">
    <div class="header">
      <div class="brand">
        <img v-if="agentAvatar" :src="agentAvatar" alt="avatar" />
        <div class="title">{{ agentName }}</div>
      </div>
    </div>

    <div class="messages" ref="scrollRef">
      <div class="fade-top" aria-hidden="true"></div>
      <div v-for="(m, i) in messages" :key="i" class="row" :class="m.role">
        <img v-if="m.role==='ai' && agentAvatar" class="avatar" :src="agentAvatar" alt="ai" />
        <div class="bubble" :class="m.role">{{ m.content }}</div>
      </div>
      <div v-if="loading" class="row ai">
        <img v-if="agentAvatar" class="avatar" :src="agentAvatar" alt="ai" />
        <div class="bubble ai typing">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="typing-text"></span>
        </div>
      </div>
    </div>

    <div class="composer-wrap">
      <form class="composer" @submit.prevent="send">
        <input v-model="text" :placeholder="placeholder" :disabled="loading" />
        <button :disabled="loading || !text.trim()">Enviar</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  apiBase: { type: String, required: true },
  agentName: { type: String, default: 'Assistente' },
  agentAvatar: { type: String, default: '' },
  placeholder: { type: String, default: 'Digite sua mensagem…' },
})

const text = ref('')
const loading = ref(false)
const messages = ref([])
const sessionId = ref(localStorage.getItem('turbonet_session') || '')
const scrollRef = ref(null)

watch(messages, () => {
  requestAnimationFrame(() => {
    if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  })
}, { deep: true })

async function send() {
  const content = text.value.trim()
  if (!content) return
  messages.value.push({ role: 'user', content })
  text.value = ''
  loading.value = true
  try {
    const url = `${props.apiBase}/api/v1/chat`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId.value ? { 'X-Session-Id': sessionId.value } : {}),
      },
      body: JSON.stringify({ message: content, sessionId: sessionId.value || undefined })
    })
    const data = await res.json()
    if (res.ok) {
      if (data.sessionId && data.sessionId !== sessionId.value) {
        sessionId.value = data.sessionId
        localStorage.setItem('turbonet_session', sessionId.value)
      }
      messages.value.push({ role: 'ai', content: data.reply || '…' })
    } else {
      messages.value.push({ role: 'ai', content: data?.message || 'Desculpe, ocorreu um erro.' })
    }
  } catch (e) {
    messages.value.push({ role: 'ai', content: 'Falha de conexão. Tente novamente.' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // noop
})
</script>

<style scoped>
.widget { display:flex; flex-direction:column; height:100%; background:transparent; --composer-height: 72px; }
.header { display:flex; align-items:center; justify-content:center; padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); position:sticky; top:0; z-index:2; }
.brand { display:flex; align-items:center; gap:10px; }
.header img { width:28px; height:28px; border-radius:50%; }
.header .title { font-weight:600; letter-spacing:.2px; }
.messages { position:relative; flex:1; overflow:auto; padding:24px 0 calc(var(--composer-height) + 24px); display:flex; flex-direction:column; gap:12px; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; }
.messages { -webkit-mask-image: linear-gradient(to bottom, transparent 0px, #000 56px); mask-image: linear-gradient(to bottom, transparent 0px, #000 56px); }
.fade-top { position: sticky; top: 0; height: 56px; background: linear-gradient(180deg, rgba(11,16,32,1), rgba(11,16,32,0)); margin-bottom: -56px; pointer-events: none; z-index: 2; }
.messages :deep(.container) { max-width: 920px; margin: 0 auto; }
.row { display:flex; }
.row.user { justify-content:flex-end; }
.row.ai { justify-content:flex-start; }
.avatar { width:28px; height:28px; border-radius:50%; margin: 0 8px 0 16px; align-self:flex-end; }
.bubble { max-width: 920px; padding:12px 14px; border-radius:16px; line-height:1.45; font-size:15px; white-space:pre-wrap; }
.bubble.user { background:#3a6df0; color:#fff; border-bottom-right-radius:4px; }
.bubble.ai { background:#171e44; color:#e9ecff; border-bottom-left-radius:4px; border:1px solid #222b5a; }
.typing { display:flex; align-items:center; gap:6px; }
.typing .dot { width:6px; height:6px; background:#9aa3d7; border-radius:50%; display:inline-block; animation: bounce 1.2s infinite ease-in-out; }
.typing .dot:nth-child(2) { animation-delay: .15s; }
.typing .dot:nth-child(3) { animation-delay: .3s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity:.6 } 40% { transform: scale(1); opacity:1 } }
.typing-text { color:#b9c2ff; }
.composer-wrap { position:fixed; left:0; right:0; bottom: env(safe-area-inset-bottom, 0px); width:100%; display:flex; justify-content:center; background:#0b1020; z-index:9999; height: var(--composer-height); padding: 12px 0; }
.composer { display:flex; gap:10px; align-items:center; padding:0 16px; width: min(960px, calc(100% - 32px)); margin: 0 auto; background: transparent; border:none; border-radius: 0; box-shadow: none; }
.composer input { flex:1; background:#0c1130; border:1px solid #2b3569; color:#e8ebff; border-radius:999px; padding:16px 18px; outline:none; }
.composer input:focus { border-color:#3a6df0; }
.composer button { background:#3a6df0; color:#fff; border:none; border-radius:999px; padding:16px 20px; font-weight:600; cursor:pointer; }
.composer button:disabled { opacity:.6; cursor:not-allowed; }
@media (min-width: 900px) {
  .messages { padding-left: calc(50% - 460px); padding-right: calc(50% - 460px); }
  .composer { padding-left: calc(50% - 460px); padding-right: calc(50% - 460px); }
}
</style>

