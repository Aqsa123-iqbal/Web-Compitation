import { useEffect, useState } from 'react';
import { AlertCircle, Check, CloudUpload, ExternalLink, FileText, FolderOpen, Link2, LoaderCircle, Trash2 } from 'lucide-react';
import { loadCompetitionResources, removeCompetitionResource, resourceDownloadUrl, saveCompetitionResourceLink, saveGoogleDriveResources, updateCompetitionResource, uploadCompetitionResource } from './lib/supabase';

const categories = ['Rules', 'Task Statement', 'Reference Material', 'Templates', 'Other Documents'];
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY?.trim();
const googleAppId = import.meta.env.VITE_GOOGLE_APP_ID?.trim();
const googleReady = !!(googleClientId && googleApiKey && googleAppId);
const validExtensions = new Set(['pdf','doc','docx','zip','png','jpg','jpeg','webp','txt','md','csv','json','js','jsx','ts','tsx','css','html','svg']);
const allowedFile = file => validExtensions.has(file.name.split('.').pop()?.toLowerCase());

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const script = document.createElement('script'); script.id = id; script.src = src; script.async = true;
    script.onload = resolve; script.onerror = () => reject(new Error('Google library could not be loaded. Check network and allowed domain configuration.'));
    document.head.append(script);
  });
}

export default function CompetitionResources({ competitionId, participant = null, userId, backendReady, admin = false }) {
  const [rows, setRows] = useState([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [googleSession,setGoogleSession]=useState(null);
  const [category, setCategory] = useState('Other Documents'); const [link, setLink] = useState(''); const [linkName, setLinkName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]); const participantId = participant?.id || null;
  async function refresh() {
    if (!backendReady || !competitionId) return;
    try { setRows(await loadCompetitionResources(competitionId, participantId)); }
    catch (error) { setMessage(`Could not load resources: ${error.message}`); }
  }
  useEffect(() => { refresh(); }, [competitionId, participantId, backendReady]);
  async function saveLink(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { await saveCompetitionResourceLink({ competitionId, participantId, userId, url: link, name: linkName || link, category, description: '' }); setLink(''); setLinkName(''); await refresh(); setMessage('Link saved to the competition resource list.'); }
    catch (error) { setMessage(`Link was not saved: ${error.message}`); } finally { setBusy(false); }
  }
  async function uploadFiles() {
    const files = [...selectedFiles]; if (!files.length) return;
    const invalid = files.filter(f => !allowedFile(f) || f.size > 6 * 1024 * 1024);
    if (invalid.length) { setMessage(`Unsupported or over 6 MB: ${invalid.map(f => f.name).join(', ')}`); return; }
    if (!backendReady) { setMessage('Direct uploads need a configured Supabase project.'); return; }
    setBusy(true); setMessage(`Uploading ${files.length} item${files.length===1?'':'s'}…`);
    let done = 0;
    try {
      for (const file of files) { await uploadCompetitionResource({ file, competitionId, participantId, userId, category }); done++; }
      setSelectedFiles([]); await refresh(); setMessage(`${done} resource${done===1?'':'s'} uploaded to private Supabase Storage.`);
    } catch (error) { await refresh(); setMessage(`${done} uploaded; next upload failed: ${error.message}`); }
    finally { setBusy(false); }
  }
  function addSelectedFiles(fileList) {
    const incoming = [...(fileList || [])];
    if (!incoming.length) return;
    setSelectedFiles(current => {
      const known = new Set(current.map(file => `${file.webkitRelativePath || ''}:${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...incoming.filter(file => {
        const key = `${file.webkitRelativePath || ''}:${file.name}:${file.size}:${file.lastModified}`;
        if (known.has(key)) return false;
        known.add(key);
        return true;
      })];
    });
  }
  async function importFromDrive() {
    if (!backendReady) { setMessage('Connect Supabase first so selected Drive metadata can be saved.'); return; }
    if (!googleReady) { setMessage('Google Drive import is not configured. Add the three Google values in .env.local and restart Vite.'); return; }
    setBusy(true); setMessage('Connecting to Google Drive…');
    try {
      await Promise.all([loadScript('https://accounts.google.com/gsi/client','google-gis'), loadScript('https://apis.google.com/js/api.js','google-api')]);
      await new Promise((resolve,reject)=>window.gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('Google Picker failed to load.')),timeout:10000,ontimeout:()=>reject(new Error('Google Picker timed out.'))}));
      const token = googleSession&&googleSession.expiresAt>Date.now()+30000?googleSession.accessToken:await new Promise((resolve,reject)=>{
        const client=window.google.accounts.oauth2.initTokenClient({client_id:googleClientId,scope:'https://www.googleapis.com/auth/drive.file',callback:r=>r.error?reject(new Error(r.error_description||r.error)):(setGoogleSession({accessToken:r.access_token,expiresAt:Date.now()+Number(r.expires_in||3600)*1000}),resolve(r.access_token)),error_callback:e=>reject(new Error(e.message||e.type||'Google authorization was cancelled.'))});
        client.requestAccessToken({prompt:googleSession?'':'consent'});
      });
      await new Promise((resolve,reject)=>{
        const picker=new window.google.picker.PickerBuilder()
          .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true))
          .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
          .setOAuthToken(token).setDeveloperKey(googleApiKey).setAppId(googleAppId).setOrigin(window.location.origin)
          .setCallback(async data=>{
            if(data.action===window.google.picker.Action.CANCEL){setMessage('Google Drive selection cancelled.');resolve();return;}
            if(data.action===window.google.picker.Action.ERROR){reject(new Error('Google Picker returned an error. Check OAuth, API key restrictions, and Drive API setup.'));return;}
            if(data.action!==window.google.picker.Action.PICKED)return;
            try {
              const docs=(data.docs||[]).map(d=>({id:d.id,name:d.name,mimeType:d.mimeType,url:d.url||d.embedUrl||'',size:d.size||null,iconUrl:d.iconUrl||''}));
              await saveGoogleDriveResources({competitionId,participantId,userId,items:docs}); await refresh(); setMessage(`${docs.length} Google Drive item${docs.length===1?'':'s'} imported. Google files stay in Drive; only IDs and metadata are stored here.`); resolve();
            } catch(error) { reject(error); }
          }).build();
        picker.setVisible(true);
      });
    } catch(error) { setGoogleSession(null); setMessage(`Google Drive import failed: ${error.message}. If the access token expired, click Import again to reauthorize.`); }
    finally { setBusy(false); }
  }
  async function remove(row) {
    if (!window.confirm(`Remove “${row.display_name}” from this competition?`)) return;
    setBusy(true); try { await removeCompetitionResource(row); await refresh(); setMessage('Resource removed.'); } catch(error) { setMessage(`Could not remove resource: ${error.message}`); } finally { setBusy(false); }
  }
  async function editResource(row, patch) {
    try { const saved=await updateCompetitionResource(row.id,patch); setRows(items=>items.map(item=>item.id===saved.id?saved:item)); }
    catch(error) { setMessage(`Could not update resource: ${error.message}`); }
  }
  async function replaceFile(row, file) {
    if (!file) return;
    if (!allowedFile(file) || file.size > 6 * 1024 * 1024) { setMessage('Choose an allowed file under 6 MB.'); return; }
    setBusy(true);
    try {
      await uploadCompetitionResource({ file, competitionId, participantId, userId, category: row.category, description: row.description });
      await removeCompetitionResource(row); await refresh(); setMessage('Resource file replaced.');
    } catch(error) { await refresh(); setMessage(`Could not replace file: ${error.message}`); }
    finally { setBusy(false); }
  }
  async function open(row) {
    try { const href=await resourceDownloadUrl(row); if(href)window.open(href,'_blank','noopener,noreferrer'); }
    catch(error) { setMessage(`Could not open resource: ${error.message}`); }
  }
  return <section className="resource-manager">
    <div className="resource-manager-heading"><div><span className="kicker">{admin?'COMPETITION RESOURCES':'PROJECT RESOURCES'}</span><h3>{admin?'Manage competition files':'Add project files and Drive items'}</h3></div>{busy&&<LoaderCircle className="resource-spinner" size={18}/>}</div>
    {!backendReady&&<div className="notice-bar"><AlertCircle size={16}/><span>Resource uploads and saved imports require Supabase credentials. No files are being uploaded in local demo mode.</span></div>}
    <div className="resource-controls">
      {admin&&<label className="field"><span>Category</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>}
      <form className="resource-link-form" onSubmit={saveLink}><input type="url" required value={link} onChange={e=>setLink(e.target.value)} placeholder="Paste a Drive or reference link (https://…)"/><input value={linkName} onChange={e=>setLinkName(e.target.value)} placeholder="Resource name (optional)"/><button className="button button-outline button-sm" disabled={busy||!backendReady}><Link2 size={14}/> Save link</button></form>
      <label className={`resource-file-picker ${!backendReady?'disabled':''}`}><input type="file" multiple disabled={!backendReady||busy} onChange={e=>{addSelectedFiles(e.target.files);e.target.value='';}}/><CloudUpload size={16}/> Add multiple files</label>
      <label className={`resource-file-picker ${!backendReady?'disabled':''}`}><input type="file" multiple webkitdirectory="" directory="" disabled={!backendReady||busy} onChange={e=>{addSelectedFiles(e.target.files);e.target.value='';}}/><FolderOpen size={16}/> Add folder</label>
      <small className="muted">Add more than one folder or file batch before uploading; choose a folder again to add another.</small>
      <button className="button button-outline button-sm" disabled={busy||!backendReady||!googleReady} title={!googleReady?'Google OAuth client, API key, and project number required':''} onClick={importFromDrive}><FolderOpen size={15}/> Import from Google Drive</button>
      {!googleReady&&<small className="muted">Picker setup required: VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY, VITE_GOOGLE_APP_ID.</small>}
    </div>
    {!!selectedFiles.length&&<div className="selected-file-batch"><span>{selectedFiles.length} file(s) queued · max 6 MB each</span><button className="button button-outline button-sm" disabled={busy} onClick={()=>setSelectedFiles([])}>Clear selection</button><button className="button button-primary button-sm" disabled={busy||!backendReady} onClick={uploadFiles}>Upload all to Supabase</button></div>}
    {message&&<p className="resource-message" role="status">{message}</p>}
    <div className="resource-list">{rows.map(row=><article className="resource-row" key={row.id}><FileText size={17}/><div className="resource-row-main"><b>{row.display_name}</b><small>{row.source==='google_drive'?'Google Drive metadata':row.source==='upload'?'Supabase Storage':'External link'} · {row.category} · {row.mime_type} · {new Date(row.created_at).toLocaleString()}{row.description?` · ${row.description}`:''}{row.file_size?` · ${(row.file_size/1024/1024).toFixed(2)} MB`:''}</small>{admin&&<><input className="resource-description" defaultValue={row.description||''} placeholder="Short resource description" onBlur={e=>e.target.value!==row.description&&editResource(row,{description:e.target.value})}/><select className="resource-inline-select" value={row.category} onChange={e=>editResource(row,{category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select><select className="resource-inline-select" value={row.visibility} onChange={e=>editResource(row,{visibility:e.target.value})}><option value="registered">Registered participants</option><option value="public">Public</option><option value="private">Organizer only</option></select><label className="resource-enable"><input type="checkbox" checked={row.enabled} onChange={e=>editResource(row,{enabled:e.target.checked})}/> Enabled</label></>}</div><span className="resource-status"><Check size={13}/>{row.enabled?'Available':'Disabled'}</span><button className="button button-outline button-sm" onClick={()=>open(row)}><ExternalLink size={14}/> Open</button>{row.source==='upload'&&<label className="resource-replace">Replace<input type="file" accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.css,.html,.svg" disabled={busy} onChange={e=>replaceFile(row,e.target.files?.[0])}/></label>}<button className="resource-delete" aria-label={`Remove ${row.display_name}`} disabled={busy} onClick={()=>remove(row)}><Trash2 size={15}/></button></article>)}{backendReady&&!rows.length&&<p className="muted">No additional resources have been added.</p>}</div>
  </section>;
}
