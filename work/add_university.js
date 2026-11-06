import fs from 'node:fs';
const p='src/App.jsx';let s=fs.readFileSync(p,'utf8');
s=s.replace("useState({name:'',reg:'',email:'',phone:'',department:'Computer Science'", "useState({name:'',university:'COMSATS University Islamabad, Vehari Campus',reg:'',email:'',phone:'',department:'Computer Science'");
s=s.replace("['name','reg','email','phone','department','semester','batch','password']", "['name','university','reg','email','phone','department','semester','batch','password']");
s=s.replace('<Field label="Registration number" required error={errors.reg}>', '<Field label="University" required error={errors.university}><input value={form.university} onChange={e=>set(\'university\',e.target.value)}/></Field><Field label="Registration number" required error={errors.reg}>');
fs.writeFileSync(p,s);
