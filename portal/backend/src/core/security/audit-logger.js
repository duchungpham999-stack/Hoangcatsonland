export async function requestAuditLogger(req) {
  req.audit = {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    startedAt: new Date().toISOString()
  };
}

export async function auditEvent(event) {
  console.info(JSON.stringify({ type: 'audit', at: new Date().toISOString(), ...event }));
}
