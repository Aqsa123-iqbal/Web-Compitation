import fs from 'node:fs';
const p='src/App.jsx';let s=fs.readFileSync(p,'utf8');
const old='<h2>{user?.name}</h2><p>{current.batch} · {current.department} · {current.reg}</p></div><span className="avatar-large">{(user?.name||\'P\').split(\' \').map(w=>w[0]).join(\'\').slice(0,2)}</span></div>';
const neu='<h2>{user?.name}</h2><p className="participant-university">{current.university||\'COMSATS University Islamabad\'}</p><p>{current.batch} · {current.department} · {current.reg}</p></div><label className="avatar-large profile-avatar-label">{current.profilePicture?<img src={current.profilePicture} alt="Participant profile"/>:(user?.name||\'P\').split(\' \').map(w=>w[0]).join(\'\').slice(0,2)}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={profilePhoto}/><small>{photoBusy?\'Uploading…\':\'Change photo\'}</small></label></div>{photoMessage&&<p className="profile-photo-message">{photoMessage}</p>}';
if(!s.includes(old)) throw new Error('Dashboard profile markup marker missing');
s=s.replace(old,neu);
fs.writeFileSync(p,s);
