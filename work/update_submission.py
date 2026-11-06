from pathlib import Path

p = Path("src/App.jsx")
s = p.read_text()
s = s.replace(
    "function Submission({go,db,current,updateParticipant})",
    "function Submission({go,db,current,updateParticipant,backendReady})",
)
s = s.replace(
    "drive:current?.drive||'',technologies:current?.technologies||'React, Vite'",
    "drive:current?.drive||'',technologies:current?.technologies||'React, Vite',apis:current?.apis||''",
)
s = s.replace(
    "for(const k of ['github','live','drive'])if(form[k]&&!validUrl(form[k]))x[k]='Enter a valid http or https URL.';if(!checks.readme",
    "for(const k of ['github','live','drive'])if(form[k]&&!validUrl(form[k]))x[k]='Enter a valid http or https URL.';const apiRows=form.apis.split('\\n').filter(v=>v.trim());if(!apiRows.length)x.apis='Add at least one API name and URL.';else if(apiRows.some(v=>{const parts=v.split('|');return !parts[0]?.trim()||!validUrl(parts.slice(1).join('|').trim())}))x.apis='Use one valid entry per line: API name | https://...';if(!checks.readme",
)
old = '''<Field label="External API used"><input value={form.api||''} onChange={e=>set('api',e.target.value)} placeholder="e.g. Open-Meteo"/></Field>'''
new = '''<Field label="External APIs used" required error={errs.apis}><textarea rows="3" value={form.apis} onChange={e=>set('apis',e.target.value)} placeholder={"Open-Meteo | https://api.open-meteo.com/...\\nREST Countries | https://restcountries.com/..."}/><small>One API per line in the format Name | URL. Add more than one on separate lines.</small></Field>'''
s = s.replace(old, new)
s = s.replace("['drive','Google Drive project folder URL'", "['drive','Your Google Drive folder link for judges'")
s = s.replace(
    '<Tag kind="tag-demo">LOCAL DEMO</Tag></div><p className="form-intro">Paste links',
    '<Tag kind={backendReady?"tag-green":"tag-demo"}>{backendReady?"SAVED TO SUPABASE":"LOCAL DEMO"}</Tag></div><p className="form-intro">Paste links',
)
p.write_text(s)
