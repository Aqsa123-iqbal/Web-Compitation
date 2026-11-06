import { useMemo, useState } from 'react';
import { AlertTriangle, Mail, Send } from 'lucide-react';

const digits = phone => (phone || '').replace(/\D/g, '').replace(/^0/, '92');
export default function EmailAnnouncements({ participants = [], competitions = [] }) {
  const [competitionId, setCompetitionId] = useState('');
  const [batch, setBatch] = useState('All');
  const [submission, setSubmission] = useState('All');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const target = useMemo(() => participants.filter(p => (!competitionId || p.competitionId === competitionId) && (batch === 'All' || p.batch === batch) && (submission === 'All' || (submission === 'Submitted' ? !!p.submittedAt : !p.submittedAt))), [participants, competitionId, batch, submission]);
  return <section className="panel announcement-panel"><div className="panel-head"><div><span className="kicker">EMAIL & ANNOUNCEMENTS</span><h3>Prepare a competition update</h3></div><span className="tag tag-neutral">EMAIL PROVIDER NOT CONFIGURED</span></div>
    <div className="notice-bar"><AlertTriangle size={17}/><span>Bulk email delivery is unavailable. No email provider credentials or sending function are configured, so the portal will not report a send as successful.</span></div>
    <div className="form-grid"><label className="field"><span>Competition</span><select value={competitionId} onChange={e=>setCompetitionId(e.target.value)}><option value="">All competitions</option>{competitions.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label className="field"><span>Batch</span><select value={batch} onChange={e=>setBatch(e.target.value)}><option>All</option>{[...new Set(participants.map(p=>p.batch).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="field"><span>Submission status</span><select value={submission} onChange={e=>setSubmission(e.target.value)}><option>All</option><option>Submitted</option><option>Not submitted</option></select></label>
      <label className="field"><span>Subject</span><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Competition announcement"/></label>
      <label className="field full-width"><span>Message</span><textarea rows="5" value={body} onChange={e=>setBody(e.target.value)} placeholder="Write the update for participants"/></label>
    </div>
    <p className="recipient-count"><Mail size={15}/> {target.length} matching participant{target.length===1?'':'s'} · {target.filter(p=>p.email).length} email addresses</p>
    <button className="button button-outline" disabled={!subject.trim()||!body.trim()||!target.length} title="Configure a server-side email provider before sending"><Send size={15}/> Sending unavailable until configured</button>
    <div className="announcement-contacts"><span className="kicker">INDIVIDUAL CONTACT LINKS</span>{target.slice(0,8).map(p=><div key={p.id}><b>{p.name}</b><a href={`mailto:${p.email}`}>{p.email}</a><a href={`https://wa.me/${digits(p.phone)}`} target="_blank" rel="noreferrer">WhatsApp</a><a href={`tel:${p.phone}`}>Call</a></div>)}</div>
  </section>;
}
