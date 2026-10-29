import { mockActionPlans, mockContacts, mockLinks, mockMeetings } from '../src-running-ops/src/data/mockData.js'

const RESOURCE_MAP = {
  meetings: mockMeetings,
  actionPlans: mockActionPlans,
  contacts: mockContacts,
  links: mockLinks,
}

export default function handler(req, res) {
  const { resource } = req.query || {}
  const payload = RESOURCE_MAP[resource]

  if (!payload) {
    res.status(404).json({ error: 'unknown_resource' })
    return
  }

  res.status(200).json({
    resource,
    source: 'mock-data',
    rows: payload,
  })
}
