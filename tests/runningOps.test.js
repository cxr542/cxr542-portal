import { describe, expect, it } from 'vitest'
import { filterActions, filterContacts, getQuickActions } from '../src-running-ops/src/domain'
import { getSheetsSchema } from '../src-running-ops/src/services/sheetsClient'

describe('src-running-ops domain', () => {
  it('hides manager-only quick actions for viewer', () => {
    const viewerActions = getQuickActions('viewer')
    const managerActions = getQuickActions('manager')

    expect(viewerActions.find((item) => item.id === 'meeting').available).toBe(false)
    expect(viewerActions.find((item) => item.id === 'action').available).toBe(false)
    expect(managerActions.find((item) => item.id === 'meeting').available).toBe(true)
    expect(managerActions.find((item) => item.id === 'action').available).toBe(true)
  })

  it('filters contacts by name, role, and group', () => {
    const contacts = [
      { name: '민수', role: '운영진', group: '총무관리', visible: true },
      { name: '태오', role: '페이서', group: '운영진', visible: true },
      { name: '비공개', role: '운영진', group: '운영진', visible: false },
    ]

    expect(filterContacts(contacts, '민', '전체')).toHaveLength(1)
    expect(filterContacts(contacts, '페이서', '전체')).toHaveLength(1)
    expect(filterContacts(contacts, '', '총무관리')).toHaveLength(1)
    expect(filterContacts(contacts, '', '운영진')).toHaveLength(2)
  })

  it('filters action plans by owner and status', () => {
    const actions = [
      { owner: '민수', status: '예정' },
      { owner: '민수', status: '완료' },
      { owner: '태오', status: '진행중' },
    ]

    expect(filterActions(actions, '민수', '')).toHaveLength(2)
    expect(filterActions(actions, '', '완료')).toHaveLength(1)
    expect(filterActions(actions, '태오', '진행중')).toHaveLength(1)
  })

  it('documents the Google Sheets tab structure', () => {
    expect(getSheetsSchema()).toEqual({
      Meetings: ['id', 'title', 'dateTime', 'location', 'attendees', 'agenda', 'discussion', 'decisions', 'author', 'updatedAt'],
      ActionPlans: ['id', 'meetingId', 'task', 'owner', 'dueDate', 'status', 'memo'],
      Contacts: ['id', 'name', 'role', 'group', 'phone', 'emergencyPhone', 'memo', 'visible'],
      Links: ['id', 'title', 'url', 'category', 'memo', 'updatedAt'],
    })
  })
})
