export function getQuickActions(role) {
  const canManage = role === 'manager'
  return [
    { id: 'meeting', label: '회의록 작성', available: canManage },
    { id: 'action', label: 'Action Plan 추가', available: canManage },
    { id: 'contacts', label: '비상연락망 열기', available: true },
    { id: 'links', label: '자료 링크 열기', available: true },
  ]
}

export function filterContacts(contacts, query, filter) {
  return contacts.filter((contact) => {
    const matchesFilter =
      filter === '전체' || contact.role === filter || contact.group === filter
    const matchesQuery =
      !query ||
      [contact.name, contact.role, contact.group]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase())
    return matchesFilter && matchesQuery && contact.visible
  })
}

export function filterActions(actions, ownerFilter, statusFilter) {
  return actions.filter((action) => {
    const matchesOwner = !ownerFilter || action.owner === ownerFilter
    const matchesStatus = !statusFilter || action.status === statusFilter
    return matchesOwner && matchesStatus
  })
}
