import { useEffect, useMemo, useState } from 'react'
import { clearSession, loadSession, saveSession, verifyAccess } from './services/auth'
import { getUpcomingItems, mockActionPlans, mockContacts, mockLinks, mockMeetings } from './data/mockData'
import { filterActions, filterContacts, getQuickActions } from './domain'
import './styles.css'

const TABS = [
  { id: 'dashboard', label: '홈' },
  { id: 'meetings', label: '회의록' },
  { id: 'actions', label: '액션' },
  { id: 'contacts', label: '연락망' },
  { id: 'more', label: '더보기' },
]

const ACTION_STATUS = {
  예정: 'status-planned',
  진행중: 'status-active',
  완료: 'status-done',
}

const blankMeeting = {
  title: '',
  dateTime: '',
  location: '',
  attendees: '',
  agenda: '',
  discussion: '',
  decisions: '',
  author: '',
}

const blankAction = {
  meetingId: '',
  task: '',
  owner: '',
  dueDate: '',
  status: '예정',
  memo: '',
}

const blankLink = {
  title: '',
  url: '',
  category: '자료',
  memo: '',
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDay(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function isRecentMeeting(meeting, index) {
  return index === 0
}

function meetingSearchString(meeting) {
  return [meeting.title, meeting.location, meeting.agenda, meeting.attendees].join(' ').toLowerCase()
}

function Card({ title, value, label }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{title}</span>
    </article>
  )
}

function App() {
  const [session, setSession] = useState(() => loadSession())
  const [roleChoice, setRoleChoice] = useState('manager')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [meetingQuery, setMeetingQuery] = useState('')
  const [contactQuery, setContactQuery] = useState('')
  const [contactFilter, setContactFilter] = useState('전체')
  const [actionOwner, setActionOwner] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [meetingDraft, setMeetingDraft] = useState(blankMeeting)
  const [actionDraft, setActionDraft] = useState(blankAction)
  const [linkDraft, setLinkDraft] = useState(blankLink)
  const [editMode, setEditMode] = useState(null)
  const [meetings, setMeetings] = useState(() => JSON.parse(globalThis.PortalStorage.getItem('src-running-ops-data') || '{}').meetings || mockMeetings)
  const [actions, setActions] = useState(() => JSON.parse(globalThis.PortalStorage.getItem('src-running-ops-data') || '{}').actions || mockActionPlans)
  const [contacts] = useState(() => JSON.parse(globalThis.PortalStorage.getItem('src-running-ops-data') || '{}').contacts || mockContacts)
  const [links, setLinks] = useState(() => JSON.parse(globalThis.PortalStorage.getItem('src-running-ops-data') || '{}').links || mockLinks)

  useEffect(() => {
    globalThis.PortalStorage.setItem(
      'src-running-ops-data',
      JSON.stringify({ meetings, actions, contacts, links }),
    )
  }, [meetings, actions, contacts, links])

  const role = session?.role || null
  const isManager = role === 'manager'

  const meetingCounts = useMemo(() => {
    return {
      meetings: meetings.length,
      pendingActions: actions.filter((item) => item.status !== '완료').length,
      contacts: contacts.filter(Boolean).length,
      links: links.length,
      upcoming: getUpcomingItems().slice(0, 3),
    }
  }, [actions, contacts, links, meetings])

  const meetingResults = useMemo(() => {
    const query = meetingQuery.toLowerCase()
    return [...meetings]
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
      .filter((meeting) => !query || meetingSearchString(meeting).includes(query))
  }, [meetingQuery, meetings])

  const selectedMeetingActions = useMemo(() => {
    if (!selectedMeeting) return []
    return actions.filter((action) => action.meetingId === selectedMeeting.id)
  }, [actions, selectedMeeting])

  const contactResults = useMemo(
    () => filterContacts(contacts, contactQuery, contactFilter),
    [contactQuery, contactFilter, contacts],
  )

  const actionResults = useMemo(
    () => filterActions(actions, actionOwner, actionStatus),
    [actions, actionOwner, actionStatus],
  )
  const quickActions = useMemo(() => getQuickActions(role || 'viewer'), [role])

  const owners = useMemo(() => [...new Set(actions.map((action) => action.owner))], [actions])

  async function handleLogin(event) {
    event.preventDefault()
    setAuthError('')
    try {
      const result = await verifyAccess(roleChoice, password)
      const nextSession = { role: result.role, issuedAt: result.issuedAt }
      saveSession(nextSession)
      setSession(nextSession)
      setPassword('')
    } catch {
      setAuthError('역할 또는 비밀번호를 확인해 주세요.')
    }
  }

  function handleLogout() {
    clearSession()
    setSession(null)
    setActiveTab('dashboard')
    setSelectedMeeting(null)
  }

  function openMeetingDetail(meeting) {
    setSelectedMeeting(meeting)
    setEditMode(null)
    setMeetingDraft(meeting)
  }

  function openMeetingEditor(meeting = blankMeeting) {
    setSelectedMeeting(meeting.id ? meeting : null)
    setEditMode('meeting')
    setMeetingDraft(meeting.id ? meeting : { ...blankMeeting })
  }

  function openActionEditor(action = blankAction) {
    setEditMode('action')
    setActionDraft(action.id ? action : { ...blankAction, meetingId: selectedMeeting?.id || meetings[0]?.id || '' })
  }

  function openLinkEditor(link = blankLink) {
    setEditMode('link')
    setLinkDraft(link.id ? link : { ...blankLink })
  }

  function saveMeeting() {
    const next = meetingDraft.id
      ? meetings.map((item) => (item.id === meetingDraft.id ? { ...meetingDraft, updatedAt: new Date().toISOString() } : item))
      : [{ ...meetingDraft, id: `meeting-${Date.now()}`, updatedAt: new Date().toISOString(), author: 'manager' }, ...meetings]
    setMeetings(next)
    setEditMode(null)
    setSelectedMeeting(null)
  }

  function deleteMeeting(id) {
    setMeetings(meetings.filter((item) => item.id !== id))
    setActions(actions.filter((item) => item.meetingId !== id))
    setSelectedMeeting(null)
  }

  function saveAction() {
    const next = actionDraft.id
      ? actions.map((item) => (item.id === actionDraft.id ? actionDraft : item))
      : [{ ...actionDraft, id: `action-${Date.now()}` }, ...actions]
    setActions(next)
    setEditMode(null)
  }

  function deleteAction(id) {
    setActions(actions.filter((item) => item.id !== id))
  }

  function saveLink() {
    const next = linkDraft.id
      ? links.map((item) => (item.id === linkDraft.id ? { ...linkDraft, updatedAt: new Date().toISOString() } : item))
      : [{ ...linkDraft, id: `link-${Date.now()}`, updatedAt: new Date().toISOString() }, ...links]
    setLinks(next)
    setEditMode(null)
  }

  function deleteLink(id) {
    setLinks(links.filter((item) => item.id !== id))
  }

  if (!session) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <p className="eyebrow">SRC RUNNING OPS</p>
          <h1>운영진 전용 관리 페이지</h1>
          <p className="muted">회의록, Action Plan, 비상연락망, 자료 링크를 한 화면에서 다룹니다.</p>

          <form onSubmit={handleLogin} className="login-form">
            <label>
              역할 선택
              <select value={roleChoice} onChange={(e) => setRoleChoice(e.target.value)}>
                <option value="manager">매니저</option>
                <option value="viewer">운영진 조회</option>
              </select>
            </label>
            <label>
              비밀번호
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호 입력" />
            </label>
            {authError ? <p className="error">{authError}</p> : null}
            <button className="primary-button" type="submit">입장하기</button>
          </form>

          <p className="note">매니저는 작성·수정·삭제 가능 / 운영진은 조회만 가능합니다.</p>
        </section>
      </main>
    )
  }

  return (
    <div className="ops-shell">
      <header className="hero-bar">
        <div>
          <p className="eyebrow">SRC RUNNING OPS</p>
          <h1>운영진 콘솔</h1>
        </div>
        <button className="ghost-button" type="button" onClick={handleLogout}>로그아웃</button>
      </header>

      <main className="ops-main">
        {activeTab === 'dashboard' && (
          <section className="screen">
            <div className="hero-panel">
              <p className="section-label">Dashboard</p>
              <h2>오늘의 운영 현황</h2>
              <p className="muted">모바일에서 빠르게 확인하고 바로 작업으로 넘어갈 수 있게 구성했습니다.</p>
            </div>

            <div className="metrics-grid">
              <Card label="최근 회의록 수" value={meetingCounts.meetings} title="Recent" />
              <Card label="미완료 Action Plan" value={meetingCounts.pendingActions} title="Open tasks" />
              <Card label="비상연락망 인원" value={meetingCounts.contacts} title="Contacts" />
              <Card label="자료 링크 수" value={meetingCounts.links} title="Links" />
            </div>

            <section className="panel">
              <div className="panel-head">
                <h3>다가오는 일정</h3>
              </div>
              <div className="timeline">
                {meetingCounts.upcoming.map((item) => (
                  <article key={item.label} className="timeline-item">
                    <strong>{item.label}</strong>
                    <span>{item.date}</span>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h3>빠른 바로가기</h3>
              </div>
              <div className="quick-grid">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={action.available ? 'primary-button' : 'ghost-button'}
                    onClick={() => {
                      if (action.id === 'meeting') setActiveTab('meetings')
                      if (action.id === 'action') setActiveTab('actions')
                      if (action.id === 'contacts') setActiveTab('contacts')
                      if (action.id === 'links') setActiveTab('more')
                    }}
                    disabled={!action.available}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {!isManager ? <p className="note">viewer 권한에서는 작성/추가 버튼이 비활성화됩니다.</p> : null}
            </section>
          </section>
        )}

        {activeTab === 'meetings' && (
          <section className="screen">
            <div className="screen-head">
              <div>
                <p className="section-label">Meetings</p>
                <h2>운영진 회의록</h2>
              </div>
              {isManager ? <button className="primary-button floating-action" type="button" onClick={() => openMeetingEditor()}>+</button> : null}
            </div>
            <input className="search-input" value={meetingQuery} onChange={(e) => setMeetingQuery(e.target.value)} placeholder="회의 제목, 장소, 안건, 참석자 검색" />
            <div className="list">
              {meetingResults.map((meeting, index) => (
                <button key={meeting.id} type="button" className="list-card" onClick={() => openMeetingDetail(meeting)}>
                  <div className="list-card__meta">
                    <strong>{meeting.title}</strong>
                    {isRecentMeeting(meeting, index) ? <span className="badge badge--pink">최신 회의록</span> : null}
                  </div>
                  <span>{formatDate(meeting.dateTime)} · {meeting.location}</span>
                  <p>{meeting.agenda}</p>
                </button>
              ))}
            </div>
            {selectedMeeting ? (
              <article className="detail-card">
                <div className="detail-head">
                  <div>
                    <p className="section-label">상세</p>
                    <h3>{selectedMeeting.title}</h3>
                  </div>
                  {isManager ? (
                    <div className="detail-actions">
                      <button type="button" className="ghost-button" onClick={() => openMeetingEditor(selectedMeeting)}>수정하기</button>
                      <button type="button" className="danger-button" onClick={() => deleteMeeting(selectedMeeting.id)}>삭제하기</button>
                    </div>
                  ) : null}
                </div>
                <dl className="detail-grid">
                  <div><dt>회의 일시</dt><dd>{formatDate(selectedMeeting.dateTime)}</dd></div>
                  <div><dt>장소</dt><dd>{selectedMeeting.location}</dd></div>
                  <div><dt>참석자</dt><dd>{selectedMeeting.attendees}</dd></div>
                  <div><dt>주요 안건</dt><dd>{selectedMeeting.agenda}</dd></div>
                  <div><dt>논의 내용</dt><dd>{selectedMeeting.discussion}</dd></div>
                  <div><dt>결정사항</dt><dd>{selectedMeeting.decisions}</dd></div>
                  <div><dt>작성자</dt><dd>{selectedMeeting.author}</dd></div>
                  <div><dt>수정일시</dt><dd>{formatDate(selectedMeeting.updatedAt)}</dd></div>
                </dl>
                <section className="nested-panel">
                  <h4>연결된 Action Plan</h4>
                  {selectedMeetingActions.map((action) => (
                    <div className="nested-row" key={action.id}>
                      <strong>{action.task}</strong>
                      <span>{action.owner} · {action.status}</span>
                    </div>
                  ))}
                </section>
              </article>
            ) : null}
            {editMode === 'meeting' ? (
              <section className="panel editor-panel">
                <h3>{meetingDraft.id ? '회의록 수정' : '회의록 작성'}</h3>
                <div className="form-grid">
                  <input placeholder="회의 제목" value={meetingDraft.title} onChange={(e) => setMeetingDraft({ ...meetingDraft, title: e.target.value })} />
                  <input placeholder="회의 일시" value={meetingDraft.dateTime} onChange={(e) => setMeetingDraft({ ...meetingDraft, dateTime: e.target.value })} />
                  <input placeholder="장소" value={meetingDraft.location} onChange={(e) => setMeetingDraft({ ...meetingDraft, location: e.target.value })} />
                  <input placeholder="참석자" value={meetingDraft.attendees} onChange={(e) => setMeetingDraft({ ...meetingDraft, attendees: e.target.value })} />
                  <textarea placeholder="주요 안건" value={meetingDraft.agenda} onChange={(e) => setMeetingDraft({ ...meetingDraft, agenda: e.target.value })} />
                  <textarea placeholder="논의 내용" value={meetingDraft.discussion} onChange={(e) => setMeetingDraft({ ...meetingDraft, discussion: e.target.value })} />
                  <textarea placeholder="결정사항" value={meetingDraft.decisions} onChange={(e) => setMeetingDraft({ ...meetingDraft, decisions: e.target.value })} />
                  <input placeholder="작성자" value={meetingDraft.author} onChange={(e) => setMeetingDraft({ ...meetingDraft, author: e.target.value })} />
                </div>
                <div className="editor-actions">
                  <button type="button" className="primary-button" onClick={saveMeeting}>저장</button>
                  <button type="button" className="ghost-button" onClick={() => setEditMode(null)}>취소</button>
                </div>
              </section>
            ) : null}
          </section>
        )}

        {activeTab === 'actions' && (
          <section className="screen">
            <div className="screen-head">
              <div>
                <p className="section-label">Actions</p>
                <h2>Action Plan</h2>
              </div>
              {isManager ? <button className="primary-button floating-action" type="button" onClick={() => openActionEditor()}>+</button> : null}
            </div>
            <div className="filter-row">
              <select value={actionOwner} onChange={(e) => setActionOwner(e.target.value)}>
                <option value="">담당자 전체</option>
                {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
              </select>
              <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)}>
                <option value="">상태 전체</option>
                <option value="예정">예정</option>
                <option value="진행중">진행중</option>
                <option value="완료">완료</option>
              </select>
            </div>
            <div className="list">
              {actionResults.map((action) => (
                <article key={action.id} className="list-card action-card">
                  <div className="list-card__meta">
                    <strong>{action.task}</strong>
                    <span className={`badge ${ACTION_STATUS[action.status]}`}>{action.status}</span>
                  </div>
                  <span>{action.owner} · {formatDay(action.dueDate)}</span>
                  <p>{action.memo}</p>
                  <div className="inline-actions">
                    {isManager ? (
                      <>
                        <button type="button" className="ghost-button" onClick={() => openActionEditor(action)}>수정</button>
                        <button type="button" className="danger-button" onClick={() => deleteAction(action.id)}>삭제</button>
                      </>
                    ) : <span className="muted">viewer는 조회만 가능합니다.</span>}
                  </div>
                </article>
              ))}
            </div>
            {editMode === 'action' ? (
              <section className="panel editor-panel">
                <h3>{actionDraft.id ? 'Action 수정' : 'Action 추가'}</h3>
                <div className="form-grid">
                  <select value={actionDraft.meetingId} onChange={(e) => setActionDraft({ ...actionDraft, meetingId: e.target.value })}>
                    {meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
                  </select>
                  <input placeholder="할 일" value={actionDraft.task} onChange={(e) => setActionDraft({ ...actionDraft, task: e.target.value })} />
                  <input placeholder="담당자" value={actionDraft.owner} onChange={(e) => setActionDraft({ ...actionDraft, owner: e.target.value })} />
                  <input placeholder="마감일" value={actionDraft.dueDate} onChange={(e) => setActionDraft({ ...actionDraft, dueDate: e.target.value })} />
                  <select value={actionDraft.status} onChange={(e) => setActionDraft({ ...actionDraft, status: e.target.value })}>
                    <option value="예정">예정</option>
                    <option value="진행중">진행중</option>
                    <option value="완료">완료</option>
                  </select>
                  <textarea placeholder="비고" value={actionDraft.memo} onChange={(e) => setActionDraft({ ...actionDraft, memo: e.target.value })} />
                </div>
                <div className="editor-actions">
                  <button type="button" className="primary-button" onClick={saveAction}>저장</button>
                  <button type="button" className="ghost-button" onClick={() => setEditMode(null)}>취소</button>
                </div>
              </section>
            ) : null}
          </section>
        )}

        {activeTab === 'contacts' && (
          <section className="screen">
            <div className="screen-head">
              <div>
                <p className="section-label">Contacts</p>
                <h2>비상연락망</h2>
              </div>
            </div>
            <input className="search-input" value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} placeholder="이름 / 역할 / 그룹 검색" />
            <div className="chip-row">
              {['전체', '운영진', '페이서', '응급지원', '총무관리'].map((item) => (
                <button key={item} type="button" className={`chip ${contactFilter === item ? 'chip--active' : ''}`} onClick={() => setContactFilter(item)}>{item}</button>
              ))}
            </div>
            <p className="warning">본 연락망은 내부 운영진 전용입니다. 외부 공유 및 무단 배포를 금지합니다.</p>
            <div className="list">
              {contactResults.map((contact) => (
                <article key={contact.id} className="list-card contact-card">
                  <div className="list-card__meta">
                    <strong>{contact.name}</strong>
                    <span className="badge badge--outline">{contact.role}</span>
                  </div>
                  <span>{contact.group}</span>
                  <p>{contact.memo}</p>
                  <div className="inline-actions">
                    <a className="ghost-button" href={`tel:${contact.phone}`}>전화 걸기</a>
                    <a className="ghost-button" href={`tel:${contact.emergencyPhone}`}>비상전화</a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'more' && (
          <section className="screen">
            <div className="screen-head">
              <div>
                <p className="section-label">More</p>
                <h2>자료 링크</h2>
              </div>
              {isManager ? <button type="button" className="primary-button floating-action" onClick={() => openLinkEditor()}>+</button> : null}
            </div>
            <div className="list">
              {links.map((link) => (
                <article key={link.id} className="list-card">
                  <div className="list-card__meta">
                    <strong>{link.title}</strong>
                    <span className="badge badge--outline">{link.category}</span>
                  </div>
                  <span>{link.memo}</span>
                  <div className="inline-actions">
                    <a className="ghost-button" href={link.url} target="_blank" rel="noreferrer">열기</a>
                    {isManager ? <button type="button" className="ghost-button" onClick={() => openLinkEditor(link)}>수정</button> : null}
                    {isManager ? <button type="button" className="danger-button" onClick={() => deleteLink(link.id)}>삭제</button> : null}
                  </div>
                </article>
              ))}
            </div>
            {editMode === 'link' ? (
              <section className="panel editor-panel">
                <h3>{linkDraft.id ? '링크 수정' : '링크 추가'}</h3>
                <div className="form-grid">
                  <input placeholder="링크 제목" value={linkDraft.title} onChange={(e) => setLinkDraft({ ...linkDraft, title: e.target.value })} />
                  <input placeholder="URL" value={linkDraft.url} onChange={(e) => setLinkDraft({ ...linkDraft, url: e.target.value })} />
                  <input placeholder="카테고리" value={linkDraft.category} onChange={(e) => setLinkDraft({ ...linkDraft, category: e.target.value })} />
                  <textarea placeholder="비고" value={linkDraft.memo} onChange={(e) => setLinkDraft({ ...linkDraft, memo: e.target.value })} />
                </div>
                <div className="editor-actions">
                  <button type="button" className="primary-button" onClick={saveLink}>저장</button>
                  <button type="button" className="ghost-button" onClick={() => setEditMode(null)}>취소</button>
                </div>
              </section>
            ) : null}
            <section className="panel">
              <h3>Google Sheets 준비 구조</h3>
              <p className="muted">앱은 현재 mock data로 동작하고, 추후 `VITE_SHEETS_API_BASE` 또는 Vercel API Route를 통해 Google Sheets 연동으로 교체할 수 있습니다.</p>
            </section>
          </section>
        )}

        <nav className="bottom-nav" aria-label="주요 탭">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </main>
    </div>
  )
}

export default App
