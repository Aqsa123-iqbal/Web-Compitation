import fs from 'node:fs';
const p='src/App.jsx'; let s=fs.readFileSync(p,'utf8');
const marker='<p>Your deadline is calculated from your saved start time. Refreshing won’t reset it.</p><Countdown';
const addition='<p>Your deadline is calculated from your saved start time. Refreshing won’t reset it.</p><div className="organizer-drive-card"><span className="kicker">ORGANIZER UPLOAD FOLDER</span>{db.config.driveEnabled&&validUrl(db.config.driveUploadUrl)?<><p>Open this organizer-provided folder to upload your project files manually. This is separate from the Drive link you submit for judges.</p><a className="button button-outline" href={db.config.driveUploadUrl} target="_blank" rel="noreferrer">Open upload folder <ExternalLink size={14}/></a></>:<p>The organizer has not enabled a Drive upload folder for this competition.</p>}</div><Countdown';
if(!s.includes(marker)) throw new Error('Submission deadline marker missing');
s=s.replace(marker,addition);
fs.writeFileSync(p,s);
