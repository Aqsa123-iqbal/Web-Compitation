import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export function fromParticipant(row) {
  if (!row) return null;
  return {
    id: row.id, userId: row.user_id, name: row.name, university: row.university_name,
    winnerStatus: row.winner_status || 'Not Announced',
    registrationDate: row.created_at, reg: row.reg, email: row.email,
    phone: row.phone, department: row.department, semester: row.semester, batch: row.batch,
    type: row.participation_type, team: row.team || '', ...(row.member || {}),
    payment: row.payment_status, paymentRef: row.payment_ref, paymentProof: row.payment_proof_path,
    paymentComment: row.payment_comment, project: row.project || '', github: row.github_url || '',
    live: row.live_url || '', drive: row.drive_url || '', submittedAt: row.submitted_at,
    competitionId: row.competition_id, description: row.project_description || '',
    technologies: row.technologies || '', apis: row.api_details || '',
    startedAt: row.started_at, evaluation: row.evaluation || {}, feedback: row.feedback || '',
    evaluated: row.evaluated,
  };
}

export function toParticipant(values, userId) {
  const member = values.type === 'Team' ? {
    memberName: values.memberName, memberReg: values.memberReg,
    memberEmail: values.memberEmail, memberPhone: values.memberPhone,
  } : {};
  return {
    user_id: userId, name: values.name, reg: values.reg, email: values.email,
    phone: values.phone, department: values.department, semester: values.semester,
    batch: values.batch, participation_type: values.type, team: values.team || null,
    member,
  };
}

export async function loadCompetition(user) {
  if (!supabase) return null;
  const profileResult = user
    ? await supabase.from('profiles').select('id,full_name,role').eq('id', user.id).single()
    : { data: null, error: null };
  if (profileResult.error) throw profileResult.error;
  const role = profileResult.data?.role || 'participant';
  const settingsSource = user ? 'competition_settings' : 'public_competition_settings';
  const settingsResult = await supabase.from(settingsSource).select('*').eq('id', 1).single();
  if (settingsResult.error) throw settingsResult.error;
  const rosterResult = user && role === 'admin'
    ? await supabase.from('participants').select('*').order('created_at', { ascending: false })
    : user
      ? await supabase.from('participants').select('*').eq('user_id', user.id).limit(1)
      : { data: [], error: null };
  const resultsResult = await supabase.rpc('published_competition_results');
  const competitionsResult = role === 'admin'
    ? await supabase.from('competitions').select('*').order('created_at', { ascending: false })
    : await supabase.from('public_competition_catalog').select('*').order('starts_at', { ascending: true });
  if (rosterResult.error) throw rosterResult.error;
  if (resultsResult.error) throw resultsResult.error;
  if (competitionsResult.error) throw competitionsResult.error;
  const s = settingsResult.data;
  return {
    role,
    account: user ? { id: user.id, email: user.email, name: profileResult.data?.full_name || user.user_metadata?.full_name || user.email, role } : null,
    participants: (rosterResult.data || []).map(fromParticipant),
    results: (resultsResult.data || []).map((row) => ({ ...fromParticipant(row), evaluated: true })),
    competitions: (competitionsResult.data || []).map(fromCompetition),
    config: {
      title: s.title, duration: s.duration_minutes, mode: s.mode, task: s.task,
      registrationOpen: s.registration_open, paymentEnabled: s.payment_enabled,
      paymentAmount: s.payment_amount || '', paymentInstructions: s.payment_instructions || '',
      driveUploadUrl: s.drive_upload_url || '', driveEnabled: s.drive_enabled,
      resultsPublished: s.results_published,
    },
  };
}

function fromCompetition(row) {
  return {
    id: row.id, title: row.title, shortDescription: row.short_description,
    description: row.detailed_description, university: row.university_name, department: row.department,
    rules: row.rules_html, task: row.task_html || row.task, startsAt: row.starts_at,
    submissionInstructions: row.submission_instructions || '', requiredTechnologies: row.required_technologies || '',
    endsAt: row.ends_at, registrationDeadline: row.registration_deadline, status: row.status,
    driveUploadUrl: row.drive_upload_url || '', driveEnabled: row.drive_enabled,
    resultsAnnounced: row.results_announced,
    winners: row.winners || [], announcements: row.announcements || [],
  };
}

export async function loadCompetitionDetails(id) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('authorized_competition_details', { p_competition_id: id });
  if (error) throw error;
  return fromCompetition(data);
}

function toCompetition(item, userId) {
  return {
    title: item.title, short_description: item.shortDescription || '',
    detailed_description: item.description || '', university_name: item.university || '',
    department: item.department || '', rules_html: item.rules || '', task_html: item.task || '',
    task: item.task || '', submission_instructions: item.submissionInstructions || '', required_technologies: item.requiredTechnologies || '',
    starts_at: item.startsAt || null, ends_at: item.endsAt || null,
    registration_deadline: item.registrationDeadline || null, status: item.status || 'upcoming',
    drive_upload_url: item.driveUploadUrl || null, drive_enabled: !!item.driveEnabled,
    results_announced: !!item.resultsAnnounced, created_by: userId || null,
    updated_at: new Date().toISOString(),
  };
}

export async function saveCompetition(item, userId) {
  if (!supabase) return item;
  const payload = toCompetition(item, userId);
  const query = item.id && !item.id.startsWith('comp-')
    ? supabase.from('competitions').update(payload).eq('id', item.id).select().single()
    : supabase.from('competitions').insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return fromCompetition(data);
}

export async function deleteCompetition(id) {
  if (!supabase) return;
  const { error } = await supabase.from('competitions').delete().eq('id', id);
  if (error) throw error;
}

export async function registerParticipant(values) {
  if (!supabase) return null;
  const { password, confirm, ...profile } = values;
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password,
    options: { data: { ...profile, full_name: values.name, competition_id: values.competitionId } },
  });
  if (error) throw error;
  if (!data.session) return { confirmationRequired: true };
  const { error: participantError } = await supabase.from('participants').select('id').eq('user_id', data.user.id).single();
  if (participantError) throw participantError;
  return { user: data.user };
}

export async function saveParticipant(id, participant, isAdmin, patch = {}) {
  if (!supabase || !participant) return;
  if (!isAdmin && patch.startedAt) {
    const { data, error } = await supabase.rpc('start_competition_timer', { p_id: id });
    if (error) throw error;
    return { started_at: data };
  }
  if (!isAdmin && patch.saveDraft) {
    const { data, error } = await supabase.rpc('save_competition_submission_draft', {
      p_id:id, p_project:participant.project || '', p_description:participant.description || '',
      p_technologies:participant.technologies || '', p_api_details:participant.apis || '',
      p_github:participant.github || '', p_live:participant.live || '', p_drive:participant.drive || '',
    });
    if (error) throw error;
    return data;
  }
  if (!isAdmin && patch.submittedAt) {
    const { data, error } = await supabase.rpc('submit_competition_project', {
      p_id: id, p_project: participant.project, p_description: participant.description || '',
      p_technologies: participant.technologies || '', p_api_details: participant.apis || '',
      p_github: participant.github, p_live: participant.live, p_drive: participant.drive,
    });
    if (error) throw error;
    return data;
  }
  const base = {
    phone: participant.phone, payment_ref: participant.paymentRef || null,
    payment_proof_path: participant.paymentProof || null, updated_at: new Date().toISOString(),
  };
  if (isAdmin) {
    const { error } = await supabase.rpc('admin_update_participant', {
      p_id: id,
      p_patch: {
        ...base, payment_status: participant.payment, payment_comment: participant.paymentComment || null,
        winner_status: participant.winnerStatus || 'Not Announced',
        evaluation: participant.evaluation || {}, feedback: participant.feedback || '', evaluated: !!participant.evaluated,
      },
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('participants').update(base).eq('id', id);
    if (error) throw error;
  }
}

export async function requestPasswordReset(email, redirectTo) {
  if (!supabase) throw new Error('Password reset email is unavailable in local demo mode.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(password) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function saveSettings(config) {
  if (!supabase) return;
  const { error } = await supabase.from('competition_settings').update({
    title: config.title, duration_minutes: config.duration, mode: config.mode, task: config.task,
    registration_open: config.registrationOpen, payment_enabled: config.paymentEnabled,
    payment_amount: config.paymentAmount || null, payment_instructions: config.paymentInstructions || null,
    drive_upload_url: config.driveUploadUrl || null, drive_enabled: !!config.driveEnabled,
    results_published: config.resultsPublished, updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) throw error;
}

export async function uploadPaymentProof(file, userId) {
  if (!supabase) return null;
  const path = `${userId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from('payment-proofs').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data, error: urlError } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 300);
  if (urlError) throw urlError;
  return { path, signedUrl: data.signedUrl };
}

export async function signedPaymentProof(path) {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function loadCompetitionResources(competitionId, participantId = null) {
  if (!supabase) return [];
  const base = () => supabase.from('competition_resources').select('*').eq('competition_id', competitionId).order('created_at', { ascending: false });
  const queries = participantId ? [base().is('participant_id',null), base().eq('participant_id',participantId)] : [base().is('participant_id',null)];
  const results = await Promise.all(queries);
  const failure = results.find(result => result.error);
  if (failure) throw failure.error;
  return results.flatMap(result => result.data || []);
}

const safePathPart = value => String(value || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
export async function uploadCompetitionResource({ file, competitionId, participantId, userId, category = 'Other Documents', description = '' }) {
  if (!supabase) throw new Error('Connect Supabase before uploading project files.');
  const parts = String(file.webkitRelativePath || file.name).split(/[\\/]/).map(safePathPart);
  const path = `${competitionId}/${participantId ? userId : `admin/${userId}`}/${crypto.randomUUID()}/${parts.join('/')}`;
  const { error: uploadError } = await supabase.storage.from('competition-files').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (uploadError) throw uploadError;
  const payload = {
    competition_id: competitionId, participant_id: participantId || null,
    source: 'upload', resource_type: 'file', category, display_name: file.webkitRelativePath || file.name,
    description, storage_path: path, mime_type: file.type || 'application/octet-stream', file_size: file.size,
    uploaded_by: userId, visibility: participantId ? 'registered' : 'registered', enabled: true,
  };
  const { data, error } = await supabase.from('competition_resources').insert(payload).select().single();
  if (error) { await supabase.storage.from('competition-files').remove([path]); throw error; }
  return data;
}

export async function saveCompetitionResourceLink({ competitionId, participantId, userId, url, name, category = 'Other Documents', description = '' }) {
  if (!supabase) throw new Error('Connect Supabase before saving resource links.');
  if (!/^https?:\/\//i.test(url)) throw new Error('Enter a valid http or https URL.');
  const { data, error } = await supabase.from('competition_resources').insert({
    competition_id: competitionId, participant_id: participantId || null, source: 'link', resource_type: 'link',
    category, display_name: name || url, description, link_url: url, uploaded_by: userId,
    visibility: 'registered', enabled: true,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function saveGoogleDriveResources({ competitionId, participantId, userId, items }) {
  if (!supabase) throw new Error('Connect Supabase before saving Google Drive selections.');
  if (!items?.length) return [];
  const payload = items.map(item => ({
    competition_id: competitionId, participant_id: participantId || null, source: 'google_drive',
    resource_type: item.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
    category: 'Google Drive', display_name: item.name, google_file_id: item.id,
    link_url: item.url || `https://drive.google.com/open?id=${encodeURIComponent(item.id)}`,
    mime_type: item.mimeType || 'application/octet-stream', file_size: Number(item.size) || null,
    google_metadata: item, uploaded_by: userId, visibility: 'registered', enabled: true,
  }));
  const { data, error } = await supabase.from('competition_resources').insert(payload).select();
  if (error) throw error;
  return data || [];
}

export async function updateCompetitionResource(id, patch) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const allowed = { category: patch.category, description: patch.description, visibility: patch.visibility, enabled: patch.enabled, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('competition_resources').update(allowed).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeCompetitionResource(resource) {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (resource.storage_path) {
    const { error: storageError } = await supabase.storage.from('competition-files').remove([resource.storage_path]);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from('competition_resources').delete().eq('id', resource.id);
  if (error) throw error;
}

export async function resourceDownloadUrl(resource) {
  if (resource.source === 'link' || resource.source === 'google_drive') return resource.link_url;
  const { data, error } = await supabase.storage.from('competition-files').createSignedUrl(resource.storage_path, 300);
  if (error) throw error;
  return data.signedUrl;
}
