import { createMockStorage, createMockPromptTransport } from './mockStorage.js'
import { PortalModeError } from '../../server/portalDataMode.js'
import { collections } from './migration.js'
import { showInitializationFailure } from './access.js'

async function startMock() {
  const cloud = createMockStorage()
  const prompts = createMockPromptTransport()
  const aliases = new Map(collections.map(([namespace, , key]) => [key, namespace]))
  globalThis.PortalCloud = cloud
  globalThis.PortalPromptApi = prompts
  globalThis.PortalStorage = {
    ...cloud.settings,
    getItem(key) {
      if (key === 'prompt-collection-prompts') return JSON.stringify(prompts.snapshot())
      if (aliases.has(key)) return JSON.stringify(cloud.list(aliases.get(key)))
      if (key === 'who-are-you-summary') {
        return JSON.stringify(Object.fromEntries(['employments', 'projects', 'documents'].map(name => [name, cloud.list(`who-are-you/${name}`).length])))
      }
      return cloud.settings.getItem(key)
    },
  }
  const notice = document.createElement('aside')
  notice.className = 'portal-mock-notice'
  notice.setAttribute('role', 'status')
  notice.setAttribute('aria-label', 'Mock 저장 상태')
  notice.textContent = 'MOCK · 실계정·클라우드 연결 없음 · 이 화면의 임시 기록은 새로고침하면 초기화됩니다.'
  document.body.prepend(notice)
  for (const placeholder of document.querySelectorAll('script[data-cloud-src]')) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = placeholder.dataset.cloudSrc
      script.onload = resolve
      script.onerror = () => reject(new PortalModeError('mock_tool_load_failed'))
      placeholder.replaceWith(script)
    })
  }
  return cloud
}

export const ready = Promise.resolve().then(startMock).catch(showInitializationFailure)
