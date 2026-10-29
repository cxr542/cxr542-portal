import { loginWithId } from './login.js'
import { collectLegacyData, migrateLegacyData, downloadBackup } from './migration.js'
import './access.css'

export function accessPanel(title, description) {
  const gate = document.createElement('dialog')
  gate.className = 'portal-cloud-gate'
  const panel = document.createElement('section')
  panel.className = 'portal-cloud-panel'
  const heading = document.createElement('h1')
  heading.textContent = title
  heading.id = `cloud-title-${crypto.randomUUID()}`
  gate.setAttribute('aria-labelledby', heading.id)
  gate.addEventListener('cancel', event => event.preventDefault())
  const text = document.createElement('p')
  text.textContent = description
  const status = document.createElement('p')
  status.setAttribute('role', 'status')
  panel.append(heading, text, status)
  gate.append(panel)
  document.body.append(gate)
  gate.showModal()
  return { gate, panel, status }
}

export function signIn(client) {
  const { gate, panel, status } = accessPanel('포털에 로그인', '개인 계정으로 로그인해 모든 기기에서 기록과 설정을 이어서 사용하세요.')
  const form = document.createElement('form')
  for (const [name, label, type, autocomplete] of [
    ['loginId', '아이디', 'text', 'username'],
    ['password', '비밀번호', 'password', 'current-password'],
  ]) {
    const field = document.createElement('label')
    field.textContent = label
    const input = document.createElement('input')
    Object.assign(input, { name, type, autocomplete, required: true, autocapitalize: 'none', spellcheck: false })
    field.append(input)
    form.append(field)
  }
  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.textContent = '로그인'
  form.append(submit)
  panel.insertBefore(form, status)
  form.elements.loginId.focus()
  return new Promise(resolve => {
    form.onsubmit = async event => {
      event.preventDefault()
      submit.disabled = true
      status.textContent = '로그인 중…'
      try {
        const session = await loginWithId(client, {
          loginId: form.elements.loginId.value.trim(), password: form.elements.password.value,
        })
        gate.remove()
        resolve(session)
      } catch (error) { status.textContent = error.message || '로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.' }
      finally { submit.disabled = false; form.elements.password.value = '' }
    }
  })
}

export async function migrationPanel(cloud) {
  const { gate, panel, status } = accessPanel('기존 기록 가져오기', '이 브라우저의 기록을 현재 로그인한 계정으로 옮깁니다. 원본은 유지하며, 같은 ID의 클라우드 기록은 덮어쓰지 않습니다.')
  let documents
  try { documents = await collectLegacyData() }
  catch (error) { status.textContent = error.message }
  if (documents) status.textContent = `이관 가능한 기록·설정 ${documents.length}건`
  const actions = document.createElement('div')
  actions.className = 'portal-cloud-actions'
  panel.append(actions)
  return new Promise(resolve => {
    const backup = document.createElement('button')
    backup.textContent = '원본 JSON 백업'
    backup.disabled = !documents
    backup.onclick = () => downloadBackup(documents)
    const migrate = document.createElement('button')
    migrate.textContent = '이 계정으로 가져오기'
    migrate.disabled = !documents?.length
    migrate.onclick = async () => {
      migrate.disabled = true
      done.disabled = true
      status.textContent = '가져오는 중… 이 창을 유지해 주세요.'
      try {
        const result = await migrateLegacyData(cloud, documents)
        status.textContent = `${result.imported}건 이관 완료 · 기존 클라우드 기록 ${result.skipped}건 유지`
      } catch (error) { status.textContent = `이관 중단: ${error.message}. 원본은 유지됩니다.`; migrate.disabled = false }
      done.disabled = false
    }
    const done = document.createElement('button')
    done.textContent = '포털 계속 사용'
    done.onclick = () => { gate.remove(); resolve() }
    actions.append(backup, migrate, done)
  })
}
