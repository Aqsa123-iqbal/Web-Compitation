import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function tokenFromEnv(): string | null {
  const secrets = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secrets) {
    try {
      const parsed = JSON.parse(secrets);
      if (parsed.default) return parsed.default;
    } catch { /* Fall back to legacy secret environment names. */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || null;
}

async function vercelLatest(token: string, projectId: string, teamId?: string) {
  const query = new URLSearchParams({ projectId, limit: '1', target: 'production' });
  if (teamId) query.set('teamId', teamId);
  const response = await fetch(`https://api.vercel.com/v6/deployments?${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Vercel API returned ${response.status}`);
  const deployment = data.deployments?.[0];
  if (!deployment) throw new Error('No production deployments found for the configured Vercel project.');
  return deployment;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'POST required.' }, 405);

  const authorization = request.headers.get('Authorization') || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  const url = Deno.env.get('SUPABASE_URL');
  const secret = tokenFromEnv();
  if (!url || !secret) return json({ error: 'Supabase Edge Function secret configuration is missing.' }, 503);
  if (!accessToken) return json({ error: 'Sign in before using integration checks.' }, 401);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) return json({ error: 'Your session is invalid or expired. Sign in again.' }, 401);
  const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') return json({ error: 'Only a competition administrator can run these checks.' }, 403);

  try {
    const body = await request.json();
    if (body.action === 'verify-github') {
      let parsed: URL;
      try { parsed = new URL(body.url); } catch { return json({ error: 'Enter a valid GitHub repository URL.' }, 400); }
      if (parsed.hostname.toLowerCase() !== 'github.com') return json({ error: 'Only github.com repository URLs are supported.' }, 400);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return json({ error: 'Use a repository URL like https://github.com/owner/repository.' }, 400);
      const [owner, repo] = parts;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'VSpark-Competition-Portal',
      };
      const githubToken = Deno.env.get('GITHUB_TOKEN');
      if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
      const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.replace(/\.git$/i, ''))}`, { headers });
      const data = await response.json().catch(() => ({}));
      if (response.status === 404) return json({ ok: false, error: 'Repository not found or private. Configure a read-only GitHub token for private repositories.' });
      if (!response.ok) return json({ error: data.message || `GitHub API returned ${response.status}.` }, response.status === 403 ? 429 : 502);
      return json({ ok: true, repository: { name: data.full_name, url: data.html_url, private: data.private, archived: data.archived, defaultBranch: data.default_branch, pushedAt: data.pushed_at, stars: data.stargazers_count } });
    }

    if (body.action === 'check-vercel') {
      const token = Deno.env.get('VERCEL_TOKEN');
      const projectId = Deno.env.get('VERCEL_PROJECT_ID');
      if (!token || !projectId) return json({ error: 'Vercel integration is not configured. Set VERCEL_TOKEN and VERCEL_PROJECT_ID as Supabase Function secrets.' }, 503);
      const deployment = await vercelLatest(token, projectId, Deno.env.get('VERCEL_TEAM_ID'));
      return json({ ok: true, deployment: { id: deployment.uid, state: deployment.state, url: deployment.url ? `https://${deployment.url}` : null, target: deployment.target, createdAt: deployment.createdAt, readyAt: deployment.readyAt || null } });
    }

    if (body.action === 'redeploy-vercel') {
      const token = Deno.env.get('VERCEL_TOKEN');
      const projectId = Deno.env.get('VERCEL_PROJECT_ID');
      if (!token || !projectId) return json({ error: 'Vercel integration is not configured. Set VERCEL_TOKEN and VERCEL_PROJECT_ID as Supabase Function secrets.' }, 503);
      const teamId = Deno.env.get('VERCEL_TEAM_ID');
      const latest = await vercelLatest(token, projectId, teamId);
      const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
      const response = await fetch(`https://api.vercel.com/v13/deployments${query}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ deploymentId: latest.uid }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || `Vercel redeploy request returned ${response.status}`);
      return json({ ok: true, deployment: { id: data.id || data.uid, state: data.readyState || data.status || 'QUEUED', url: data.url ? `https://${data.url}` : null } });
    }
    return json({ error: 'Unknown integration action.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Integration request failed.' }, 502);
  }
});
