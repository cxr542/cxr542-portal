import { createPromptTransport } from './promptTransport.js'
import { client } from './client.js'
import { createPortalStorage } from './storage.js'
import { accessPanel, migrationPanel, signIn } from './access.js'
import { collections } from './migration.js'
import { shouldWarnAboutRemoteChange } from './remoteChanges.js'

let state = { pending: 0, failures: [] }
let renderStatus = () => {}
let cloud
let prompts
let remoteChanged = false

function installGlobals() {
  globalThis.PortalCloud = cloud
  const settings = cloud.settings
  const aliases = new Map(collections.map(([namespace, , key]) => [key, namespace]))
  globalThis.PortalStorage = {
    ...settings,
    getItem(key) {
      if (key === 'prompt-collection-prompts' && prompts) return JSON.stringify(prompts.snapshot())
      if (aliases.has(key)) return JSON.stringify(cloud.list(aliases.get(key)))
      if (key === 'who-are-you-summary') {
        return JSON.stringify({
          employments: cloud.list('who-are-you/employments').length,
          projects: cloud.list('who-are-you/projects').length,
          documents: cloud.list('who-are-you/documents').length,
        })
      }
      return settings.getItem(key)
    },
  }
}

function accountToolbar() {
  const bar = document.createElement('aside')
  bar.className = 'portal-cloud-toolbar'
  bar.setAttribute('aria-label', '클라우드 저장 상태')
  const label = document.createElement('span')
  label.setAttribute('role', 'status')
  const details = document.createElement('details')
  const summary = document.createElement('summary')
  summary.textContent = '계정·저장'
  const account = document.createElement('p')
  account.textContent = '개인 계정'
  const errorText = document.createElement('p')
  errorText.setAttribute('role', 'alert')
  const actions = document.createElement('div')
  actions.className = 'portal-cloud-actions'
  const addAction = (text, action) => {
    const button = document.createElement('button')
    button.textContent = text
    button.onclick = async () => {
      button.disabled = true
      try { await action() }
      catch (error) { errorText.textContent = error.message; details.open = true }
      finally { button.disabled = false }
    }
    actions.append(button)
    return button
  }
  addAction('브라우저 기록 이관', async () => { await cloud.flush(); await migrationPanel(cloud); location.reload() })
  addAction('다시 저장', () => cloud.retry())
  addAction('새로 불러오기', () => {
    if ((state.pending || state.failures.length) && !confirm('저장되지 않은 변경 사항이 사라집니다. 다시 불러올까요?')) return
    location.reload()
  })
  addAction('로그아웃', async () => {
    await cloud.flush()
    const { error } = await client.auth.signOut()
    if (error) throw error
  })
  details.append(summary, account, errorText, actions)
  bar.append(label, details)
  document.body.append(bar)
  renderStatus = () => {
    label.textContent = state.failures.length ? 'Supabase 저장 실패' : state.pending ? 'Supabase 저장 중…' : remoteChanged ? '다른 탭에서 변경됨 · 새로 불러오기' : 'Supabase 연결됨'
    if (state.failures.length) {
      details.open = true
      errorText.textContent = '변경 사항이 저장되지 않았습니다. 다시 저장하거나, 충돌 시 새로 불러와 주세요. ' + state.failures[0].message
    } else errorText.textContent = ''
  }
  renderStatus()
  window.addEventListener('beforeunload', event => {
    if (state.pending || state.failures.length) { event.preventDefault(); event.returnValue = '' }
  })
}

async function start() {
  const loading = accessPanel('포털 연결 중', 'Supabase에서 기록을 불러옵니다.')
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  loading.gate.remove()
  const session = data.session || await signIn(client)
  client.auth.onAuthStateChange((event, next) => {
    if (event === 'SIGNED_OUT' || (next && next.user.id !== session.user.id)) {
      prompts?.stop()
      cloud?.stop()
      document.body.replaceChildren()
      location.reload()
    }
  })
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('cxr542-portal-cloud') : null
  cloud = createPortalStorage(client, next => { state = next; renderStatus() }, row => {
    channel?.postMessage({ userId: session.user.id, ...row })
  })
  if (channel) channel.onmessage = ({ data }) => {
    const embedded = window.parent !== window && new URLSearchParams(location.search).get('portal') === 'workspace'
    if (!shouldWarnAboutRemoteChange(data, session.user.id, embedded)) return
    // Preserve loaded revisions: an open draft must never inherit another tab's revision.
    remoteChanged = true
    renderStatus()
  }
  const fetching = accessPanel('기록 불러오는 중', '클라우드 연결을 확인합니다.')
  await cloud.load()
  fetching.gate.remove()
  const promptPage = location.pathname === '/' || location.pathname === '/index.html' || location.pathname.startsWith('/prompt-collection');
  prompts = createPromptTransport(client, fetch, () => channel?.postMessage({ userId: session.user.id, namespace: 'prompt-collection' }));
  globalThis.PortalPromptApi = prompts;
  if (promptPage) {
    try { await prompts.list(); } catch (error) {
      if (location.pathname.startsWith('/prompt-collection')) throw error;
      console.warn('프롬프트 개수를 불러오지 못했습니다. 다른 도구는 계속 사용할 수 있습니다.');
    }
  }
  installGlobals()
  if (!cloud.has('settings', 'cloud-migration-reviewed')) {
    await migrationPanel(cloud)
    await cloud.write('settings', 'cloud-migration-reviewed', '1')
  }
  accountToolbar()
  // Public HTML tools keep their existing script order, after authentication/hydration.
  for (const placeholder of document.querySelectorAll('script[data-cloud-src]')) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = placeholder.dataset.cloudSrc
      script.onload = resolve
      script.onerror = () => reject(new Error('도구를 불러오지 못했습니다. 새로고침해 주세요.'))
      placeholder.replaceWith(script)
    })
  }
  return cloud
}

export const ready = start().catch(error => {
  const failure = accessPanel('연결을 확인해 주세요', '클라우드에 연결할 수 없어 포털을 시작하지 못했습니다.')
  failure.status.textContent = error.message
  const retry = document.createElement('button')
  retry.textContent = '다시 연결'
  retry.onclick = () => location.reload()
  failure.panel.append(retry)
  throw error
})
