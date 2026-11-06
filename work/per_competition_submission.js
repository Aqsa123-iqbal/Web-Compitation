import fs from 'node:fs';
const p='src/App.jsx';let s=fs.readFileSync(p,'utf8');
s=s.replace("const set=(k,v)=>setForm(f=>({...f,[k]:v}));const p=current;return <main><PageHero kicker=\"PROJECT DELIVERY\"", "const set=(k,v)=>setForm(f=>({...f,[k]:v}));const p=current;const competition=db.competitions?.find(c=>c.id===current?.competitionId);const organizerDriveEnabled=!!competition?.driveEnabled;const organizerDriveUrl=competition?.driveUploadUrl||'';return <main><PageHero kicker=\"PROJECT DELIVERY\"");
s=s.replace('db.config.driveEnabled&&validUrl(db.config.driveUploadUrl)', 'organizerDriveEnabled&&validUrl(organizerDriveUrl)');
s=s.replace('href={db.config.driveUploadUrl}', 'href={organizerDriveUrl}');
s=s.replace('Late changes are rejected by the real server in production. Demo mode saves locally and can’t validate deadlines across devices.', '{backendReady?"Supabase checks the submission deadline using its server clock.":"Demo mode saves locally and cannot enforce deadlines across devices."}');
fs.writeFileSync(p,s);
