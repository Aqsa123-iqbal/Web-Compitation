import fs from 'node:fs';
const p='src/App.jsx';let s=fs.readFileSync(p,'utf8');
s=s.replace('function Register({go,register,db})','function Register({go,register,db,selectedCompetitionId})');
s=s.replace("useState({name:'',university:", "useState({competitionId:selectedCompetitionId||'',name:'',university:");
s=s.replace('register({...form});}', 'register({...form,competitionId:selectedCompetitionId||form.competitionId});}');
s=s.replace('backendConfigured:!!supabase};', 'backendConfigured:!!supabase,selectedCompetitionId};');
fs.writeFileSync(p,s);
