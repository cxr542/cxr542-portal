import { mockActionPlans, mockContacts, mockLinks, mockMeetings } from '../data/mockData'

const RESOURCE_MAP = {
  meetings: mockMeetings,
  actionPlans: mockActionPlans,
  contacts: mockContacts,
  links: mockLinks,
}

export async function listSheetResource(resource) {
  const baseUrl = import.meta.env.VITE_SHEETS_API_BASE
  if (baseUrl) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${resource}`)
    if (!response.ok) {
      throw new Error(`sheet_${resource}_failed`)
    }
    return response.json()
  }

  return RESOURCE_MAP[resource] || []
}

export function getSheetsSchema() {
  return {
    Meetings: ['id', 'title', 'dateTime', 'location', 'attendees', 'agenda', 'discussion', 'decisions', 'author', 'updatedAt'],
    ActionPlans: ['id', 'meetingId', 'task', 'owner', 'dueDate', 'status', 'memo'],
    Contacts: ['id', 'name', 'role', 'group', 'phone', 'emergencyPhone', 'memo', 'visible'],
    Links: ['id', 'title', 'url', 'category', 'memo', 'updatedAt'],
  }
}
