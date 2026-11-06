import { useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, Plus, Save, Trash2, X } from 'lucide-react';
import { sanitizeRichText } from './lib/sanitizeRichText';
import RichTextEditor from './RichTextEditor';
import CompetitionResources from './CompetitionResources';

const blank = () => ({
  id: '', title: '', shortDescription: '', description: '', university: 'COMSATS University Islamabad',
  department: 'Department of Computer Science, Vehari Campus', rules: '', task: '', submissionInstructions: '', requiredTechnologies: '',
  startsAt: '', endsAt: '', registrationDeadline: '', status: 'upcoming',
  driveUploadUrl: '', driveEnabled: false, resultsAnnounced: false, winners: [],
});
const localDate = value => value ? new Date(value).toISOString().slice(0, 16) : '';

export default function CompetitionManager({ competitions = [], participants = [], onSave, onDelete, onToast, backendReady, userId }) {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const visible = useMemo(() => competitions.filter(c => `${c.title} ${c.status}`.toLowerCase().includes(query.toLowerCase())), [competitions, query]);
  const startNew = () => setEditing(blank());
  const edit = item => setEditing({ ...blank(), ...item, startsAt: localDate(item.startsAt), endsAt: localDate(item.endsAt), registrationDeadline: localDate(item.registrationDeadline) });
  async function save(e) {
    e.preventDefault();
    if (!editing.title.trim()) return onToast('Enter a competition title.');
    if (editing.driveEnabled && !/^https?:\/\//i.test(editing.driveUploadUrl)) return onToast('Add a valid organizer Drive folder URL before enabling it.');
    if (editing.startsAt && editing.endsAt && new Date(editing.endsAt) <= new Date(editing.startsAt)) return onToast('The competition end must be after it starts.');
    try {
      await onSave({ ...editing, rules: sanitizeRichText(editing.rules), task: sanitizeRichText(editing.task), submissionInstructions: sanitizeRichText(editing.submissionInstructions), description: sanitizeRichText(editing.description), id: editing.id || `comp-${crypto.randomUUID()}` });
      setEditing(null);
      onToast(backendReady ? 'Competition saved to Supabase.' : 'Competition saved in this browser demo.');
    } catch (error) { onToast(`Competition could not be saved: ${error.message}`); }
  }
  return <div className="competition-manager">
    <section className="panel admin-panel">
      <div className="panel-head"><div><span className="kicker">COMPETITION CATALOG</span><h3>Manage competitions</h3></div><button className="button button-primary button-sm" onClick={startNew}><Plus size={15}/> New competition</button></div>
      <label className="search-box"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search competitions"/></label>
      <div className="competition-catalog">{visible.map(c => {
        const count = participants.filter(p => p.competitionId === c.id).length;
        return <article className="competition-admin-card" key={c.id}>
          <div className="competition-admin-top"><span className={`status-pill status-${c.status}`}>{c.status}</span><span>{count} registrations</span></div>
          <h3>{c.title}</h3><p>{c.shortDescription || c.description || 'No description added yet.'}</p>
          <div className="competition-admin-dates"><CalendarDays size={15}/>{c.startsAt ? new Date(c.startsAt).toLocaleString() : 'Dates not set'}{c.registrationDeadline ? ` · Register by ${new Date(c.registrationDeadline).toLocaleDateString()}` : ''}</div>
          <div className="competition-admin-drive">Drive link: {c.driveEnabled && c.driveUploadUrl ? <a href={c.driveUploadUrl} target="_blank" rel="noreferrer">Enabled <ExternalLink size={13}/></a> : 'Disabled or not configured'}</div>
          <details className="competition-resource-details"><summary>Manage files, folders, and links</summary><CompetitionResources competitionId={c.id} userId={userId} backendReady={backendReady} admin/></details>
          <div className="inline-actions"><button className="button button-outline button-sm" onClick={() => edit(c)}>Edit details</button><button className="reject-action" onClick={() => { if (window.confirm(`Delete “${c.title}”? This will remove its demo registrations.`)) onDelete(c.id); }}>Delete <Trash2 size={14}/></button></div>
        </article>;
      })}{!visible.length && <div className="empty-table">No competitions match. Create one to get started.</div>}</div>
    </section>
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setEditing(null); }}>
      <form className="panel competition-editor" onSubmit={save}>
        <div className="panel-head"><div><span className="kicker">{editing.id ? 'EDIT COMPETITION' : 'NEW COMPETITION'}</span><h3>{editing.title || 'Competition details'}</h3></div><button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Close"><X/></button></div>
        <div className="competition-editor-grid">
          <label className="field"><span>Competition title *</span><input required value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })}/></label>
          <label className="field"><span>Status</span><select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}><option value="draft">Draft</option><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
          <label className="field"><span>Short description</span><input value={editing.shortDescription} onChange={e => setEditing({ ...editing, shortDescription: e.target.value })}/></label>
          <label className="field"><span>University</span><input value={editing.university} onChange={e => setEditing({ ...editing, university: e.target.value })}/></label>
          <label className="field"><span>Department</span><input value={editing.department} onChange={e => setEditing({ ...editing, department: e.target.value })}/></label>
          <label className="field"><span>Starts at</span><input type="datetime-local" value={editing.startsAt} onChange={e => setEditing({ ...editing, startsAt: e.target.value })}/></label>
          <label className="field"><span>Ends at</span><input type="datetime-local" value={editing.endsAt} onChange={e => setEditing({ ...editing, endsAt: e.target.value })}/></label>
          <label className="field"><span>Registration deadline</span><input type="datetime-local" value={editing.registrationDeadline} onChange={e => setEditing({ ...editing, registrationDeadline: e.target.value })}/></label>
          <label className="field"><span>Organizer Drive upload folder</span><input type="url" value={editing.driveUploadUrl} placeholder="https://drive.google.com/drive/folders/..." onChange={e => setEditing({ ...editing, driveUploadUrl: e.target.value })}/><small>Participants open this folder and upload manually. No automatic Drive API upload.</small></label>
          <label className="toggle-setting"><span><b>Show organizer Drive folder</b><small>This link is separate from participant judge links.</small></span><input type="checkbox" checked={editing.driveEnabled} onChange={e => setEditing({ ...editing, driveEnabled: e.target.checked })}/></label>
          <RichTextEditor label="Detailed description" value={editing.description} placeholder="Explain the competition and who can participate" onChange={value => setEditing({ ...editing, description: value })}/>
          <RichTextEditor label="Competition rules" value={editing.rules} placeholder="Add competition rules and regulations" onChange={value => setEditing({ ...editing, rules: value })}/>
          <RichTextEditor label="Task statement" value={editing.task} placeholder="Describe the task participants will build" onChange={value => setEditing({ ...editing, task: value })}/>
          <RichTextEditor label="Submission instructions" value={editing.submissionInstructions} placeholder="Explain what participants must submit and how judges access it" onChange={value => setEditing({ ...editing, submissionInstructions: value })}/>
          <label className="field full-width"><span>Required technologies</span><input value={editing.requiredTechnologies} onChange={e=>setEditing({...editing,requiredTechnologies:e.target.value})} placeholder="React, Supabase, one external API"/></label>
        </div>
        {editing.id && <details className="competition-resource-details editor-resource-details" open>
          <summary>Upload multiple files or folders</summary>
          <CompetitionResources competitionId={editing.id} userId={userId} backendReady={backendReady} admin/>
        </details>}
        <div className="form-submit"><button className="button button-primary" type="submit"><Save size={16}/> Save competition</button><button className="button button-outline" type="button" onClick={() => setEditing(null)}>Cancel</button></div>
      </form>
    </div>}
  </div>;
}
