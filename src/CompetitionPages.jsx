import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, ExternalLink, FileText, Trophy } from 'lucide-react';
import { sanitizeRichText } from './lib/sanitizeRichText';
import { loadCompetitionDetails } from './lib/supabase';
import CompetitionResources from './CompetitionResources';

const date = value => value ? new Date(value).toLocaleString() : 'Date to be announced';
export function CompetitionListings({ competitions = [], go }) {
  const publicRows = competitions.filter(c => c.status !== 'draft' && c.status !== 'archived');
  const previous = competitions.filter(c => ['completed','archived'].includes(c.status));
  if (!publicRows.length && !previous.length) return null;
  return <section className="section competition-listings"><div className="container">
    <div className="section-heading"><div><span className="kicker">COMPETITION CALENDAR</span><h2>Choose your next challenge.</h2></div><p>Dates, registration status, and details are managed by the organizers.</p></div>
    {publicRows.length ? <div className="competition-public-grid">{publicRows.map(c => <article className="competition-public-card" key={c.id}>
      <div className="competition-public-top"><span className={`status-pill status-${c.status}`}>{c.status}</span><span><CalendarDays size={14}/>{date(c.startsAt)}</span></div>
      <h3>{c.title}</h3><p>{c.shortDescription || c.description || 'Competition details will be announced soon.'}</p>
      {c.registrationDeadline && <small>Register by {date(c.registrationDeadline)}</small>}
      <div className="competition-card-actions"><button className="button button-outline button-sm" onClick={() => go(`competition/${c.id}`)}>View details <ArrowRight size={14}/></button>{c.status !== 'completed'&&<button className="button button-primary button-sm" onClick={() => go(`register/${c.id}`)}>Register</button>}</div>
    </article>)}</div> : <p className="empty-table">No upcoming competition has been announced.</p>}
    {previous.length>0&&<div className="previous-competitions"><h3><Trophy size={17}/> Previous competitions</h3>{previous.map(c=><button key={c.id} onClick={()=>go(`competition/${c.id}`)}>{c.title} · {c.winners?.filter(w=>w.name).map(w=>w.name).join(', ')||'Results to be announced'}</button>)}</div>}
  </div></section>;
}

export function CompetitionDetails({ competition, participants = [], user, current, backendReady, go }) {
  const [fullCompetition,setFullCompetition]=useState(null); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const authorized=!backendReady||!!(user&&(user.role==='admin'||current?.competitionId===competition?.id));
  useEffect(()=>{
    if(!backendReady||!competition||!authorized){setFullCompetition(null);setLoading(false);return;}
    let alive=true;setLoading(true);setError('');
    loadCompetitionDetails(competition.id).then(data=>{if(alive)setFullCompetition(data);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[competition?.id,backendReady,authorized,user?.id]);
  if (!competition) return <main><div className="container results-empty"><h2>Competition not found</h2><p>This competition may be private or removed.</p><button className="button button-outline" onClick={()=>go()}>Back to competition list</button></div></main>;
  if(backendReady&&!authorized)return <main><div className="container results-empty"><span className="kicker">PARTICIPANT ACCESS</span><h2>Sign in to view competition information</h2><p>Task details, rules, announcements, and resources are available to registered participants and organizers.</p><div className="inline-actions"><button className="button button-outline" onClick={()=>go('login')}>Sign in</button><button className="button button-primary" onClick={()=>go(`register/${competition.id}`)}>Register for this competition</button></div></div></main>;
  if(backendReady&&loading)return <main><div className="container results-empty"><h2>Loading competition information…</h2></div></main>;
  if(backendReady&&error)return <main><div className="container results-empty"><h2>Competition information unavailable</h2><p>{error}</p></div></main>;
  competition=fullCompetition||competition;
  const winners = competition.winners || [];
  return <main><section className="page-hero"><div className="container"><span className="kicker">{competition.university || 'VSPARK COMPETITION'}</span><h1>{competition.title}</h1><p>{competition.description || competition.shortDescription}</p><span className={`status-pill status-${competition.status}`}>{competition.status}</span><div className="hero-actions"><button className="button button-primary" onClick={()=>go(`register/${competition.id}`)}>Register for this competition <ArrowRight size={16}/></button><button className="button button-outline" onClick={()=>go('rules')}>General rules <FileText size={15}/></button></div></div></section>
    <div className="container competition-detail-grid"><section className="panel"><span className="kicker">ABOUT THE COMPETITION</span><div className="competition-rich-content" dangerouslySetInnerHTML={{__html:sanitizeRichText(competition.description || 'More details will be shared by the organizers.')}}/><dl><dt>University / department</dt><dd>{competition.university} · {competition.department}</dd><dt>Starts</dt><dd>{date(competition.startsAt)}</dd><dt>Ends</dt><dd>{date(competition.endsAt)}</dd><dt>Registration deadline</dt><dd>{date(competition.registrationDeadline)}</dd></dl></section>
    <section className="panel"><span className="kicker">TASK STATEMENT</span><div className="competition-rich-content" dangerouslySetInnerHTML={{__html:sanitizeRichText(competition.task || 'Task statement will be announced by the organizers.')}}/>{competition.rules&&<><span className="kicker">COMPETITION RULES</span><div className="competition-rich-content" dangerouslySetInnerHTML={{__html:sanitizeRichText(competition.rules)}}/></>}</section>
    <section className="panel"><span className="kicker">PROJECT UPLOAD FOLDER</span>{competition.driveEnabled&&competition.driveUploadUrl?<><p>Organizer-provided folder for manual project upload. This is different from the Drive link submitted for judging.</p><a className="text-link" href={competition.driveUploadUrl} target="_blank" rel="noreferrer">Open organizer upload folder <ExternalLink size={14}/></a></>:<p>The organizer has not enabled a Drive folder for this competition.</p>}</section>
    <section className="panel"><span className="kicker">SUBMISSION INSTRUCTIONS</span>{competition.submissionInstructions?<div className="competition-rich-content" dangerouslySetInnerHTML={{__html:sanitizeRichText(competition.submissionInstructions)}}/>:<p>Submit your repository, deployment URL, and judge-access folder before the timer ends.</p>}<span className="kicker">REQUIRED TECHNOLOGIES</span><p>{competition.requiredTechnologies||'See the task statement and competition rules for required technologies.'}</p></section>
    <section className="panel"><span className="kicker">PREVIOUS WINNERS</span>{winners.length?winners.map((w,i)=><p key={i}>{w.position||i+1}. {w.name} · {w.project||'Project details not public'}</p>):<p>No previous winners have been announced for this competition.</p>}</section></div>
    {competition.announcements?.length>0&&<section className="container panel competition-announcements"><span className="kicker">ANNOUNCEMENTS</span>{competition.announcements.map(a=><article key={a.id}><h3>{a.subject}</h3><p>{a.body}</p><small>{date(a.created_at)}</small></article>)}</section>}
    {backendReady&&(user?.role==='admin'||current?.competitionId===competition.id)&&<div className="container competition-resources-detail"><CompetitionResources competitionId={competition.id} participant={user?.role==='admin'?null:current} userId={user?.id} backendReady={backendReady}/></div>}
  </main>;
}
