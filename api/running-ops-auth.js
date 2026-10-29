export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const { role, password } = req.body || {}
  const managerPassword = process.env.MANAGER_PASSWORD
  const viewerPassword = process.env.VIEWER_PASSWORD

  const matchedRole =
    role === 'manager' && managerPassword && password === managerPassword
      ? 'manager'
      : role === 'viewer' && viewerPassword && password === viewerPassword
        ? 'viewer'
        : null

  if (!matchedRole) {
    res.status(401).json({ error: 'invalid_credentials' })
    return
  }

  res.status(200).json({
    role: matchedRole,
    issuedAt: new Date().toISOString(),
  })
}
