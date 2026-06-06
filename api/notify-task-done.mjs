const MAX_FIELD_LENGTH = 600;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function clean(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, MAX_FIELD_LENGTH);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(payload) {
  const rows = [
    ['\uBAA8\uB4C8', payload.module],
    ['\uC791\uC5C5', payload.action],
    ['\uC81C\uBAA9', payload.title],
    ['URL', payload.url],
    ['\uC2DC\uAC01', payload.completedAt],
  ];
  const body = rows
    .map(([key, value]) => '<tr><th align="left" style="border:1px solid #ddd;background:#f8fafc">' + escapeHtml(key) + '</th><td style="border:1px solid #ddd">' + escapeHtml(value || '-') + '</td></tr>')
    .join('');
  return '<!doctype html><meta charset="utf-8" /><h2>cxr542-portal \uC791\uC5C5 \uC644\uB8CC</h2><table cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">' + body + '</table>';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      return json(res, 400, { ok: false, error: 'invalid_json' });
    }
  }
  body = body || {};

  const payload = {
    module: clean(body.module, 'cxr542-portal'),
    action: clean(body.action, '\uC791\uC5C5 \uC644\uB8CC'),
    title: clean(body.title, ''),
    url: clean(body.url, ''),
    completedAt: clean(body.completedAt, new Date().toISOString()),
  };

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL_TO;
  const from = process.env.NOTIFY_EMAIL_FROM || 'cxr542 Portal <onboarding@resend.dev>';

  if (!apiKey || !to) {
    console.info('[notify-task-done] skipped: missing RESEND_API_KEY or NOTIFY_EMAIL_TO', payload);
    return json(res, 200, { ok: true, sent: false, skipped: 'missing_email_config' });
  }

  const subject = '[cxr542-portal] ' + payload.module + ' - ' + payload.action;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: to.split(',').map((value) => value.trim()).filter(Boolean),
      subject,
      html: buildEmailHtml(payload),
      text:
        'cxr542-portal task complete\n' +
        'Module: ' + payload.module + '\n' +
        'Action: ' + payload.action + '\n' +
        'Title: ' + (payload.title || '-') + '\n' +
        'URL: ' + (payload.url || '-') + '\n' +
        'Completed at: ' + payload.completedAt,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[notify-task-done] resend failed', response.status, data);
    return json(res, 502, { ok: false, error: 'email_send_failed', status: response.status, detail: data });
  }

  return json(res, 200, { ok: true, sent: true, id: data.id || null });
}
