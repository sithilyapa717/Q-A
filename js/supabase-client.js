const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function getConfig() {
  const config = window.DIAGNOSE_CONFIG;
  if (!config?.SUPABASE_URL || !config?.SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured.');
  }
  if (
    config.SUPABASE_URL.includes('YOUR_PROJECT') ||
    config.SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY')
  ) {
    throw new Error('Replace placeholder Supabase credentials in js/config.js.');
  }
  if (
    config.SUPABASE_URL.includes('supabase.com/dashboard') ||
    config.SUPABASE_URL.includes('/rest/v1') ||
    !config.SUPABASE_URL.includes('.supabase.co')
  ) {
    throw new Error(
      'SUPABASE_URL must be your Project URL (e.g. https://xxxx.supabase.co), ' +
        'not the dashboard link or REST endpoint. Find it in Project Settings → API.'
    );
  }
  return config;
}

function normalizeSupabaseUrl(url) {
  return url.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
}

function createSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig();
  return window.supabase.createClient(normalizeSupabaseUrl(SUPABASE_URL), SUPABASE_ANON_KEY);
}

function generateRoomCode(length = 6) {
  let code = '';
  const random = window.crypto.getRandomValues(new Uint32Array(length));
  for (let i = 0; i < length; i += 1) {
    code += ROOM_CHARS[random[i] % ROOM_CHARS.length];
  }
  return code;
}

function channelName(roomCode) {
  return `diagnose:${roomCode.toUpperCase()}`;
}

async function joinRoomChannel(supabase, roomCode, options = {}) {
  const { onStatus, presenceKey, onSetup } = options;
  const config = {
    broadcast: { self: false }
  };

  if (presenceKey) {
    config.presence = { key: presenceKey };
  }

  const channel = supabase.channel(channelName(roomCode), { config });

  if (onSetup) {
    onSetup(channel);
  }

  return new Promise((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (onStatus) {
        onStatus(status, err);
      }
      if (status === 'SUBSCRIBED') {
        resolve(channel);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        const detail = err?.message ? ` ${err.message}` : '';
        reject(new Error(`Could not join room (${status}).${detail}`));
      }
    });
  });
}

function countConnectedPlayers(presenceState) {
  if (!presenceState || typeof presenceState !== 'object') {
    return 0;
  }

  return Object.entries(presenceState).reduce((total, [key, presences]) => {
    if (key === 'host') {
      return total;
    }
    return total + (Array.isArray(presences) ? presences.length : 0);
  }, 0);
}

function onPlayerCountChange(channel, handler) {
  const emit = () => {
    handler(countConnectedPlayers(channel.presenceState()));
  };

  channel.on('presence', { event: 'sync' }, emit);
  channel.on('presence', { event: 'join' }, emit);
  channel.on('presence', { event: 'leave' }, emit);
}

async function trackPlayerPresence(channel, playerId) {
  const status = await channel.track({
    playerId,
    role: 'player',
    online_at: new Date().toISOString()
  });

  if (status !== 'ok') {
    throw new Error('Could not register presence.');
  }
}

async function untrackPresence(channel) {
  if (!channel) {
    return;
  }

  try {
    await channel.untrack();
  } catch {
    /* ignore */
  }
}

function onSessionEnd(channel, handler) {
  channel.on('broadcast', { event: 'session-end' }, () => {
    handler();
  });
}

function onSessionStart(channel, handler) {
  channel.on('broadcast', { event: 'session-start' }, ({ payload }) => {
    handler(payload || { live: true });
  });
}

function onPlayerHello(channel, handler) {
  channel.on('broadcast', { event: 'player-hello' }, () => {
    handler();
  });
}

function onQuestionUpdate(channel, handler) {
  channel.on('broadcast', { event: 'question-update' }, ({ payload }) => {
    handler(payload);
  });
}

function onAnswerLocked(channel, handler) {
  channel.on('broadcast', { event: 'answer-locked' }, ({ payload }) => {
    handler(payload);
  });
}

async function broadcastSessionStart(channel, extra = {}) {
  const status = await channel.send({
    type: 'broadcast',
    event: 'session-start',
    payload: { live: true, ...extra }
  });

  if (status !== 'ok') {
    throw new Error('Could not start session for players.');
  }
}

async function broadcastSessionEnd(channel) {
  const status = await channel.send({
    type: 'broadcast',
    event: 'session-end',
    payload: { reason: 'host_ended' }
  });

  if (status !== 'ok') {
    throw new Error('Could not notify players that the session ended.');
  }
}

async function broadcastPlayerHello(channel) {
  const status = await channel.send({
    type: 'broadcast',
    event: 'player-hello',
    payload: { ts: Date.now() }
  });

  if (status !== 'ok') {
    throw new Error('Could not reach the host.');
  }
}

async function broadcastQuestionUpdate(channel, questionPayload) {
  const status = await channel.send({
    type: 'broadcast',
    event: 'question-update',
    payload: questionPayload
  });

  if (status !== 'ok') {
    throw new Error('Could not send the current question.');
  }
}

async function broadcastAnswerLocked(channel, playerId, questionIndex) {
  const status = await channel.send({
    type: 'broadcast',
    event: 'answer-locked',
    payload: { playerId, questionIndex }
  });

  if (status !== 'ok') {
    throw new Error('Could not lock in your answer. Check your connection.');
  }
}

window.Diagnose = {
  getConfig,
  createSupabaseClient,
  generateRoomCode,
  channelName,
  joinRoomChannel,
  countConnectedPlayers,
  trackPlayerPresence,
  untrackPresence,
  broadcastSessionStart,
  broadcastSessionEnd,
  broadcastPlayerHello,
  broadcastQuestionUpdate,
  broadcastAnswerLocked,
  onSessionEnd,
  onSessionStart,
  onPlayerHello,
  onQuestionUpdate,
  onAnswerLocked,
  onPlayerCountChange
};
