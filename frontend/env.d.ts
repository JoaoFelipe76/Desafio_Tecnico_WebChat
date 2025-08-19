/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

declare module '*.vue' {
	import type { DefineComponent } from 'vue'
	const component: DefineComponent<{}, {}, any>
	export default component
}

// Shim to satisfy TS in editors when resolving dev-only test utils
declare module '@vue/test-utils'
