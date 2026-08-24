(function () {
  const QR_SIZE = 320;
  const QR_ZOOM_SIZE = 560;
  const QR_DOWNLOAD_SIZE = 800;
  const HOST_PASSWORD_KEY = 'diagnose_host_password_ok';
  const SESSION_PULSE_MS = 4000;

  const setupSection = document.getElementById('setup-section');
  const hostSetupForm = document.getElementById('host-setup-form');
  const hostPasswordInput = document.getElementById('host-password');
  const hostFieldErrorEl = document.getElementById('host-field-error');
  const roomSection = document.getElementById('room-section');
  const createRoomBtn = document.getElementById('create-room-btn');
  const startSessionBtn = document.getElementById('start-session-btn');
  const endSessionBtn = document.getElementById('end-session-btn');
  const endSessionBtn2 = document.getElementById('end-session-btn-2');
  const prevQuestionBtn = document.getElementById('prev-question-btn');
  const nextQuestionBtn = document.getElementById('next-question-btn');
  const resendQuestionBtn = document.getElementById('resend-question-btn');
  const toggleResultsBtn = document.getElementById('toggle-results-btn');
  const questionJumpEl = document.getElementById('question-jump');
  const roomCodeEl = document.getElementById('room-code');
  const qrCodeEl = document.getElementById('qr-code');
  const zoomQrBtn = document.getElementById('zoom-qr-btn');
  const downloadQrBtn = document.getElementById('download-qr-btn');
  const qrZoomOverlay = document.getElementById('qr-zoom-overlay');
  const qrZoomImage = document.getElementById('qr-zoom-image');
  const qrZoomRoomCode = document.getElementById('qr-zoom-room-code');
  const closeQrZoomBtn = document.getElementById('close-qr-zoom-btn');
  const sessionStatusEl = document.getElementById('session-status');
  const playerCountEl = document.getElementById('player-count');
  const livePlayerCountEl = document.getElementById('live-player-count');
  const questionSection = document.getElementById('question-section');
  const questionIndicatorEl = document.getElementById('question-indicator');
  const lockCountEl = document.getElementById('lock-count');
  const questionPreviewEl = document.getElementById('question-preview');
  const questionPromptDisplayEl = document.getElementById('question-prompt-display');
  const projectOptionsEl = document.getElementById('project-options');
  const questionStatusEl = document.getElementById('question-status');
  const avgRevealEl = document.getElementById('avg-reveal');
  const avgChangesEl = document.getElementById('avg-changes');
  const errorMessageEl = document.getElementById('error-message');
  const hostTopbar = document.getElementById('host-topbar');

  let channel = null;
  let currentRoomCode = '';
  let endingSession = false;
  let sessionLive = false;
  let currentQuestionIndex = 0;
  let playerCount = 0;
  let locksByQuestion = new Map();
  let playerChanges = new Map();
  let sessionPulseTimer = null;
  let sessionPulseBusy = false;
  let navigating = false;
  let resultsVisible = false;

  function showError(message) {
    errorMessageEl.textContent = message;
    errorMessageEl.classList.remove('hidden');
    errorMessageEl.classList.remove('animate-shake');
    void errorMessageEl.offsetWidth;
    errorMessageEl.classList.add('animate-shake');
  }

  function clearError() {
    errorMessageEl.textContent = '';
    errorMessageEl.classList.add('hidden');
  }

  function clearHostFieldError() {
    hostFieldErrorEl.textContent = '';
    hostFieldErrorEl.classList.add('hidden');
    hostPasswordInput.classList.remove('input-invalid');
    hostPasswordInput.removeAttribute('aria-invalid');
  }

  function showHostFieldError(message) {
    hostFieldErrorEl.textContent = message;
    hostFieldErrorEl.classList.remove('hidden');
    hostPasswordInput.classList.add('input-invalid');
    hostPasswordInput.setAttribute('aria-invalid', 'true');
  }

  function isLocalHost() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  function normalizeOrigin(value) {
    const trimmed = value.trim().replace(/\/+$/, '');
    if (!trimmed) {
      return '';
    }
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    return new URL(withProtocol).origin;
  }

  function getConfiguredOrigin() {
    try {
      const fromConfig = window.DIAGNOSE_CONFIG?.PUBLIC_BASE_URL;
      if (typeof fromConfig === 'string' && fromConfig.trim()) {
        return normalizeOrigin(fromConfig);
      }
    } catch {
      /* ignore */
    }
    return '';
  }

  function getSavedLanOrigin() {
    try {
      const saved = sessionStorage.getItem('diagnose_lan_origin');
      if (saved) {
        return normalizeOrigin(saved);
      }
    } catch {
      /* ignore */
    }
    return '';
  }

  function getJoinOrigin() {
    const configured = getConfiguredOrigin();
    if (configured) {
      return configured;
    }

    const saved = getSavedLanOrigin();
    if (saved) {
      return saved;
    }

    if (!isLocalHost()) {
      return window.location.origin;
    }

    return window.location.origin;
  }

  function buildJoinUrl(roomCode) {
    const origin = getJoinOrigin() || window.location.origin;
    const url = new URL('/client', origin);
    url.searchParams.set('room', roomCode);
    return url.toString();
  }

  function buildQrImageUrl(joinUrl, size = QR_SIZE) {
    return (
      'https://api.qrserver.com/v1/create-qr-code/?size=' +
      size +
      'x' +
      size +
      '&data=' +
      encodeURIComponent(joinUrl)
    );
  }

  function setQrCode(joinUrl) {
    qrCodeEl.src = buildQrImageUrl(joinUrl, QR_SIZE);
    if (!qrZoomOverlay.hidden) {
      qrZoomImage.src = buildQrImageUrl(joinUrl, QR_ZOOM_SIZE);
    }
  }

  function renderZoomRoomCode(code) {
    qrZoomRoomCode.replaceChildren();
    qrZoomRoomCode.setAttribute('aria-label', `Room code ${code}`);

    for (const char of code) {
      const letter = document.createElement('span');
      letter.className = 'qr-zoom-letter';
      letter.textContent = char;
      qrZoomRoomCode.appendChild(letter);
    }
  }

  function openQrZoom() {
    if (!currentRoomCode) {
      return;
    }

    const joinUrl = buildJoinUrl(currentRoomCode);
    qrZoomImage.src = buildQrImageUrl(joinUrl, QR_ZOOM_SIZE);
    renderZoomRoomCode(currentRoomCode);
    qrZoomOverlay.classList.remove('hidden');
    qrZoomOverlay.hidden = false;
    document.body.classList.add('qr-zoom-open');
    closeQrZoomBtn.focus();
  }

  function closeQrZoom() {
    qrZoomOverlay.classList.add('hidden');
    qrZoomOverlay.hidden = true;
    document.body.classList.remove('qr-zoom-open');
  }

  function updateRoomLinks() {
    if (!currentRoomCode) {
      return;
    }

    const joinUrl = buildJoinUrl(currentRoomCode);
    setQrCode(joinUrl);
    qrCodeEl.alt = 'QR code to join as participant';
    renderZoomRoomCode(currentRoomCode);
  }

  async function downloadQrCode() {
    if (!currentRoomCode) {
      return;
    }

    clearError();
    downloadQrBtn.disabled = true;
    downloadQrBtn.textContent = 'Downloading…';

    const joinUrl = buildJoinUrl(currentRoomCode);
    const qrUrl = buildQrImageUrl(joinUrl, QR_DOWNLOAD_SIZE);
    const filename = `diagnose-${currentRoomCode}-qr.png`;

    try {
      const response = await fetch(qrUrl);
      if (!response.ok) {
        throw new Error('Could not download QR code.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      showError(error.message || 'Could not download QR code.');
    } finally {
      downloadQrBtn.disabled = false;
      downloadQrBtn.textContent = 'Download QR';
    }
  }

  function updatePlayerCount(count) {
    playerCount = count;
    playerCountEl.textContent = String(count);
    if (livePlayerCountEl) {
      livePlayerCountEl.textContent = String(count);
    }
    updateLockCountDisplay();
  }

  function locksForQuestion(questionIndex) {
    const key = Number(questionIndex);
    let locked = locksByQuestion.get(key);
    if (!locked) {
      locked = new Set();
      locksByQuestion.set(key, locked);
    }
    return locked;
  }

  function updateLockCountDisplay() {
    const locked = locksForQuestion(currentQuestionIndex);
    lockCountEl.textContent = `Locked in ${locked.size} / ${playerCount}`;
    if (resultsVisible) {
      updateHostResults();
    }
  }

  function unwrapBroadcast(raw) {
    if (!raw || typeof raw !== 'object') {
      return {};
    }
    if (raw.payload && typeof raw.payload === 'object' && (raw.payload.playerId || raw.payload.questionIndex != null)) {
      return { ...raw, ...raw.payload };
    }
    return raw;
  }

  function recordAnswerLocked(raw) {
    const payload = unwrapBroadcast(raw);
    const playerId = String(payload.playerId || '').trim();
    if (!playerId) {
      return;
    }

    const questionIndex = Number(payload.questionIndex);
    const q = Number.isFinite(questionIndex) && questionIndex > 0
      ? questionIndex
      : currentQuestionIndex;

    locksForQuestion(q).add(playerId);
    if (q === Number(currentQuestionIndex)) {
      updateLockCountDisplay();
    }
  }

  function formatAverage(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function updateHostResults() {
    if (!avgChangesEl) {
      return;
    }

    const totals = [...playerChanges.values()];
    const participants = Math.max(playerCount, totals.length);
    if (!participants) {
      avgChangesEl.textContent = '—';
      return;
    }

    const sum = totals.reduce((acc, value) => acc + value, 0);
    avgChangesEl.textContent = formatAverage(sum / participants);
  }

  function applyResultsVisibility() {
    if (avgRevealEl) {
      avgRevealEl.classList.toggle('hidden', !resultsVisible);
    }
    if (toggleResultsBtn) {
      toggleResultsBtn.textContent = resultsVisible ? 'Hide average' : 'Reveal average';
      toggleResultsBtn.setAttribute('aria-pressed', resultsVisible ? 'true' : 'false');
      toggleResultsBtn.classList.toggle('is-revealed', resultsVisible);
    }
    if (resultsVisible) {
      updateHostResults();
    }
  }

  function toggleResults() {
    resultsVisible = !resultsVisible;
    applyResultsVisibility();
  }

  function recordChangeSummary(raw) {
    const payload = unwrapBroadcast(raw);
    const playerId = String(payload.playerId || '').trim();
    if (!playerId) {
      return;
    }
    const count = Number(payload.totalChanges);
    if (!Number.isFinite(count) || count < 0) {
      return;
    }
    playerChanges.set(playerId, Math.round(count));

    const questionIndex = Number(payload.questionIndex);
    if (Number.isFinite(questionIndex) && questionIndex > 0) {
      locksForQuestion(questionIndex).add(playerId);
      if (questionIndex === Number(currentQuestionIndex)) {
        updateLockCountDisplay();
      }
    }

    if (resultsVisible) {
      updateHostResults();
    }
  }

  function resetLocksForQuestion() {
    locksByQuestion.set(Number(currentQuestionIndex), new Set());
    updateLockCountDisplay();
  }

  function setNavEnabled(enabled) {
    prevQuestionBtn.disabled = !enabled || currentQuestionIndex <= 1;
    nextQuestionBtn.disabled =
      !enabled || currentQuestionIndex >= DiagnoseQuestions.getQuestionCount();
    resendQuestionBtn.disabled = !enabled;
    questionJumpEl.querySelectorAll('button').forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  function renderJumpButtons() {
    questionJumpEl.replaceChildren();
    const total = DiagnoseQuestions.getQuestionCount();
    for (let i = 1; i <= total; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'diagnose-jump-btn';
      btn.dataset.index = String(i);
      btn.textContent = String(i);
      btn.setAttribute('aria-label', `Go to question ${i}`);
      btn.addEventListener('click', () => goToQuestion(i));
      questionJumpEl.appendChild(btn);
    }
  }

  function renderQuestionPreview(question) {
    questionPreviewEl.replaceChildren();
    question.segments.forEach((segment) => {
      if (segment.isNew) {
        const mark = document.createElement('mark');
        mark.className = 'context-new';
        mark.textContent = segment.text;
        questionPreviewEl.appendChild(mark);
      } else {
        questionPreviewEl.appendChild(document.createTextNode(segment.text));
      }
    });

    if (questionPromptDisplayEl) {
      questionPromptDisplayEl.textContent = question.prompt;
    }

    if (projectOptionsEl) {
      projectOptionsEl.replaceChildren();
      DiagnoseQuestions.getOptionKeys().forEach((key) => {
        const li = document.createElement('li');
        const letter = document.createElement('span');
        letter.className = 'diagnose-project-option-letter';
        letter.textContent = key;
        const label = document.createElement('span');
        label.textContent = DiagnoseQuestions.getOptionLabel(question, key);
        li.appendChild(letter);
        li.appendChild(label);
        projectOptionsEl.appendChild(li);
      });
    }
  }

  function updateQuestionUi() {
    const total = DiagnoseQuestions.getQuestionCount();
    const question = DiagnoseQuestions.getQuestion(currentQuestionIndex);
    if (!question) {
      return;
    }

    questionIndicatorEl.textContent = `Question ${currentQuestionIndex} of ${total}`;
    renderQuestionPreview(question);
    updateLockCountDisplay();

    questionJumpEl.querySelectorAll('.diagnose-jump-btn').forEach((btn) => {
      const index = Number(btn.dataset.index);
      btn.classList.toggle('active', index === currentQuestionIndex);
      btn.setAttribute('aria-current', index === currentQuestionIndex ? 'true' : 'false');
    });

    const isFirst = currentQuestionIndex <= 1;
    const isLast = currentQuestionIndex >= total;
    prevQuestionBtn.disabled = navigating || isFirst;
    nextQuestionBtn.disabled = navigating || isLast;
    nextQuestionBtn.textContent = isLast ? 'Last question' : 'Next →';
    resendQuestionBtn.disabled = navigating;
    applyResultsVisibility();

    questionStatusEl.textContent = isLast ? 'Last question' : '';
  }

  async function sendCurrentQuestion() {
    if (!channel || !currentQuestionIndex) {
      return;
    }

    const question = DiagnoseQuestions.getQuestion(currentQuestionIndex);
    if (!question) {
      return;
    }

    await Diagnose.broadcastQuestionUpdate(
      channel,
      DiagnoseQuestions.toBroadcastPayload(question)
    );
  }

  async function notifySessionLive() {
    if (!channel || !sessionLive || sessionPulseBusy) {
      return;
    }
    sessionPulseBusy = true;
    try {
      await Diagnose.broadcastSessionStart(channel, {
        questionIndex: currentQuestionIndex
      });
      if (currentQuestionIndex > 0) {
        await sendCurrentQuestion();
      }
    } catch {
      /* best effort */
    } finally {
      sessionPulseBusy = false;
    }
  }

  function stopSessionPulse() {
    if (sessionPulseTimer) {
      clearInterval(sessionPulseTimer);
      sessionPulseTimer = null;
    }
  }

  function startSessionPulse() {
    stopSessionPulse();
    notifySessionLive();
    sessionPulseTimer = setInterval(notifySessionLive, SESSION_PULSE_MS);
  }

  async function goToQuestion(index, { resetLocks = false } = {}) {
    clearError();
    if (!channel || !sessionLive || navigating) {
      return;
    }

    const total = DiagnoseQuestions.getQuestionCount();
    if (index < 1 || index > total || index === currentQuestionIndex) {
      return;
    }

    navigating = true;
    setNavEnabled(false);
    const previous = currentQuestionIndex;

    try {
      currentQuestionIndex = index;
      if (resetLocks) {
        resetLocksForQuestion();
      }
      await sendCurrentQuestion();
      updateQuestionUi();
      sessionStatusEl.textContent = `Question ${currentQuestionIndex} sent to participants`;
    } catch (error) {
      currentQuestionIndex = previous;
      showError(error.message || 'Could not change question.');
      updateQuestionUi();
    } finally {
      navigating = false;
      updateQuestionUi();
    }
  }

  async function startSession() {
    clearError();
    if (!channel) {
      showError('Create a room first.');
      return;
    }

    startSessionBtn.disabled = true;
    startSessionBtn.textContent = 'Starting…';

    try {
      sessionLive = true;
      currentQuestionIndex = 1;
      locksByQuestion = new Map();
      resetLocksForQuestion();
      playerChanges = new Map();
      resultsVisible = false;
      applyResultsVisibility();
      renderJumpButtons();
      await Diagnose.broadcastSessionStart(channel, {
        questionIndex: currentQuestionIndex
      });
      await sendCurrentQuestion();
      startSessionPulse();

      questionSection.classList.remove('hidden');
      roomSection.classList.add('hidden');
      document.getElementById('host-main').classList.add('host-live');
      if (hostTopbar) {
        hostTopbar.classList.add('hidden');
      }
      updateQuestionUi();
      sessionStatusEl.textContent = 'Session live';
      startSessionBtn.textContent = 'Session live';
    } catch (error) {
      sessionLive = false;
      currentQuestionIndex = 0;
      startSessionBtn.disabled = false;
      startSessionBtn.textContent = 'Start session';
      showError(error.message || 'Could not start session.');
    }
  }

  async function resendQuestion() {
    clearError();
    if (!channel || !sessionLive || navigating) {
      return;
    }

    navigating = true;
    resendQuestionBtn.disabled = true;
    resendQuestionBtn.textContent = 'Sending…';

    try {
      await notifySessionLive();
      questionStatusEl.textContent = `Question ${currentQuestionIndex} resent to participants`;
    } catch (error) {
      showError(error.message || 'Could not resend question.');
    } finally {
      navigating = false;
      resendQuestionBtn.textContent = 'Resend to late joiners';
      updateQuestionUi();
    }
  }

  async function endSession() {
    if (endingSession || !channel) {
      return;
    }

    endingSession = true;
    clearError();
    stopSessionPulse();
    endSessionBtn.disabled = true;
    endSessionBtn2.disabled = true;
    setNavEnabled(false);

    try {
      await Diagnose.broadcastSessionEnd(channel);
    } catch (error) {
      showError(error.message || 'Could not end session for everyone.');
    }

    if (sessionLive || playerChanges.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      if (resultsVisible) {
        updateHostResults();
      }
    }

    try {
      await Diagnose.untrackPresence(channel);
      await channel.unsubscribe();
    } catch {
      /* ignore */
    }

    channel = null;
    sessionLive = false;
    currentQuestionIndex = 0;
    locksByQuestion = new Map();
    sessionStatusEl.textContent = 'Session ended';
    questionStatusEl.textContent = 'Session ended. Refresh to create a new room.';
    startSessionBtn.disabled = true;
    startSessionBtn.textContent = 'Session ended';
    endingSession = false;
  }

  function verifyHostPassword(password) {
    const config = Diagnose.getConfig();
    const expected = config.HOST_PASSWORD;
    if (!expected || expected === 'YOUR_HOST_PASSWORD') {
      throw new Error('Host password is not configured in js/config.js.');
    }
    if (password !== expected) {
      throw new Error('Incorrect host password.');
    }
  }

  function wasPasswordAccepted() {
    try {
      return sessionStorage.getItem(HOST_PASSWORD_KEY) === '1';
    } catch {
      return false;
    }
  }

  function markPasswordAccepted() {
    try {
      sessionStorage.setItem(HOST_PASSWORD_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  async function createRoom(event) {
    event.preventDefault();
    clearError();
    clearHostFieldError();

    const passwordField = document.getElementById('password-field');
    const needsPassword = !wasPasswordAccepted();

    if (needsPassword) {
      const password = hostPasswordInput.value;
      try {
        verifyHostPassword(password);
        markPasswordAccepted();
        passwordField.classList.add('hidden');
      } catch (error) {
        showHostFieldError(error.message);
        return;
      }
    }

    createRoomBtn.disabled = true;
    createRoomBtn.textContent = 'Creating…';

    try {
      const supabase = Diagnose.createSupabaseClient();
      const roomCode = Diagnose.generateRoomCode();
      channel = await Diagnose.joinRoomChannel(supabase, roomCode, {
        presenceKey: 'host',
        onSetup(ch) {
          Diagnose.onAnswerLocked(ch, recordAnswerLocked);

          Diagnose.onChangeSummary(ch, recordChangeSummary);

          Diagnose.onPlayerHello(ch, () => {
            notifySessionLive();
          });

          Diagnose.onPlayerCountChange(ch, updatePlayerCount);
        }
      });

      currentRoomCode = roomCode;
      roomCodeEl.textContent = roomCode;
      updatePlayerCount(Diagnose.countConnectedPlayers(channel.presenceState()));
      updateRoomLinks();
      setupSection.classList.add('hidden');
      roomSection.classList.remove('hidden');
      sessionStatusEl.textContent = 'Waiting for participants — then Start session';
    } catch (error) {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Create room';
      showError(error.message || 'Could not create room.');
    }
  }

  function initPasswordUi() {
    const passwordField = document.getElementById('password-field');
    if (wasPasswordAccepted()) {
      passwordField.classList.add('hidden');
    }
  }

  hostSetupForm.addEventListener('submit', createRoom);
  startSessionBtn.addEventListener('click', startSession);
  endSessionBtn.addEventListener('click', endSession);
  endSessionBtn2.addEventListener('click', endSession);
  prevQuestionBtn.addEventListener('click', () => goToQuestion(currentQuestionIndex - 1));
  nextQuestionBtn.addEventListener('click', () => goToQuestion(currentQuestionIndex + 1));
  resendQuestionBtn.addEventListener('click', resendQuestion);
  if (toggleResultsBtn) {
    toggleResultsBtn.addEventListener('click', toggleResults);
  }
  zoomQrBtn.addEventListener('click', openQrZoom);
  closeQrZoomBtn.addEventListener('click', closeQrZoom);
  downloadQrBtn.addEventListener('click', downloadQrCode);

  qrZoomOverlay.addEventListener('click', (event) => {
    if (event.target === qrZoomOverlay) {
      closeQrZoom();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !qrZoomOverlay.hidden) {
      closeQrZoom();
    }
  });

  window.addEventListener('beforeunload', () => {
    stopSessionPulse();
    if (channel) {
      channel.unsubscribe();
    }
  });

  initPasswordUi();
})();
