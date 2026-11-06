import { useState } from 'react';
import { ExternalLink, Github, LoaderCircle, RefreshCw, Rocket, ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabase';

export default function IntegrationTools({ githubUrl = '', backendReady = false }) {
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);

  async function call(action, extra = {}) {
    if (!supabase || !backendReady) {
      setResult({ kind: 'error', text: 'Sign in to the connected Supabase project to use server-side integration checks.' });
      return;
    }
    setBusy(action);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('competition-integrations', { body: { action, ...extra } });
      if (error) throw new Error(data?.error || error.message || 'Integration function is not deployed.');
      if (data?.error || data?.ok === false) throw new Error(data.error || 'The integration could not verify this item.');
      if (action === 'verify-github') {
        const repo = data.repository;
        setResult({ kind: 'success', text: `${repo.name} verified · ${repo.private ? 'Private' : 'Public'} · default branch ${repo.defaultBranch}${repo.archived ? ' · Archived' : ''}`, url: repo.url });
      } else if (action === 'check-vercel') {
        const deployment = data.deployment;
        setResult({ kind: 'success', text: `Latest production deployment: ${deployment.state}${deployment.createdAt ? ` · ${new Date(deployment.createdAt).toLocaleString()}` : ''}`, url: deployment.url });
      } else {
        const deployment = data.deployment;
        setResult({ kind: 'success', text: `Redeploy requested · status ${deployment.state}`, url: deployment.url });
      }
    } catch (error) {
      setResult({ kind: 'error', text: error.message });
    } finally {
      setBusy('');
    }
  }

  return <section className="integration-tools panel">
    <div className="panel-head"><div><span className="kicker">GITHUB & VERCEL API</span><h3>Verify project integrations</h3></div><ShieldCheck size={20}/></div>
    <p>Checks run on the Supabase server. API tokens are never sent to the browser.</p>
    {!backendReady && <div className="notice-bar">Connect Supabase and sign in as an organizer to use these checks.</div>}
    <div className="inline-actions">
      <button className="button button-outline button-sm" disabled={!!busy || !githubUrl || !backendReady} onClick={() => call('verify-github', { url: githubUrl })}>
        {busy === 'verify-github' ? <LoaderCircle className="resource-spinner" size={15}/> : <Github size={15}/>} Verify GitHub repository
      </button>
      <button className="button button-outline button-sm" disabled={!!busy || !backendReady} onClick={() => call('check-vercel')}>
        {busy === 'check-vercel' ? <LoaderCircle className="resource-spinner" size={15}/> : <RefreshCw size={15}/>} Check configured Vercel project
      </button>
      <button className="button button-outline button-sm" disabled={!!busy || !backendReady} onClick={() => {
        if (window.confirm('Request a new deployment of the latest production deployment for the configured Vercel project?')) call('redeploy-vercel');
      }}>
        {busy === 'redeploy-vercel' ? <LoaderCircle className="resource-spinner" size={15}/> : <Rocket size={15}/>} Redeploy latest
      </button>
    </div>
    {result && <div className={`integration-result ${result.kind}`} role="status">{result.text}{result.url && <a href={result.url} target="_blank" rel="noreferrer">Open <ExternalLink size={13}/></a>}</div>}
    <small>Vercel status and redeploy apply only to the organizer’s configured Vercel project. They cannot manage deployments in participants’ personal Vercel accounts.</small>
  </section>;
}
