import { createApp, h } from 'vue'

class TurboNetChatbot extends HTMLElement {
  constructor() {
    super()
    this._mount = null
    const shadow = this.attachShadow({ mode: 'open' })
    const root = document.createElement('div')
    root.id = 'root'
    shadow.appendChild(root)
  }

  connectedCallback() {
    const apiBase = this.getAttribute('api-base') || 'http://localhost:3000'
    const agentName = this.getAttribute('agent-name') || 'Ana'
    const agentAvatar = this.getAttribute('agent-avatar') || ''

    import('../components/ChatWidget.vue').then(({ default: ChatWidget }) => {
      const app = createApp({
        render() {
          return h(ChatWidget, { apiBase, agentName, agentAvatar })
        }
      })
      app.mount(this.shadowRoot.querySelector('#root'))
      this._mount = app
    })
  }

  disconnectedCallback() {
    if (this._mount) {
      this._mount.unmount()
      this._mount = null
    }
  }
}

customElements.define('turbonet-chatbot', TurboNetChatbot)


