(function () {
  const PLAYER_ID_KEY = 'diagnose_player_id';
  const ENDED_ROOM_PREFIX = 'diagnose_ended_';
  const STATE_PREFIX = 'diagnose_state_';
  const HELLO_INTERVAL_MS = 5000;

  let cachedPlayerId = '';

  const joinSection = document.getElementById('join-section');
  const waitingSection = document.getElementById('waiting-section');
  const waitingMessageEl = document.getElementById('waiting-message');
  const waitingRoomCodeEl = document.getElementById('waiting-room-code');
  const questionSection = document.getElementById('question-section');
  const summarySection = document.getElementById('summary-section');
  const joinForm = document.getElementById('join-form');
  const roomInput = document.getElementById('room-input');
  const joinFieldErrorEl = document.getElementById('join-field-error');
  const questionBadgeEl = document.getElementById('question-badge');
  const progressStepsEl = document.getElementById('progress-steps');
  const lockStatusEl = document.getElementById('lock-status');
  const caseTextEl = document.getElementById('case-text');
  const questionPromptEl = document.getElementById('question-prompt');
  const answerOptionsEl = document.getElementById('answer-options');
  const lockBtn = document.getElementById('lock-btn');
  const hintBtn = document.getElementById('hint-btn');
  const hintSheet = document.getElementById('hint-sheet');
  const hintBackdrop = document.getElementById('hint-backdrop');
  const hintCloseBtn = document.getElementById('hint-close-btn');
  const hintGotItBtn = document.getElementById('hint-got-it-btn');
  const hintTitleEl = document.getElementById('hint-title');
  const hintNoticeEl = document.getElementById('hint-notice');
  const hintContentEl = document.getElementById('hint-content');
  const hintSheetCard = document.querySelector('.hint-sheet-card');
  const summaryListEl = document.getElementById('summary-list');
  const summaryTotalEl = document.getElementById('summary-total');
  const errorMessageEl = document.getElementById('error-message');
  const disconnectOverlay = document.getElementById('disconnect-overlay');
  const disconnectTitleEl = document.getElementById('disconnect-title');
  const disconnectMessageEl = document.getElementById('disconnect-message');
  const disconnectRetryBtn = document.getElementById('disconnect-retry-btn');

  let channel = null;
  let roomCode = '';
  let helloTimer = null;
  let roomConnected = false;
  let sessionLive = false;
  let currentQuestion = null;
  let currentSelection = null;
  let isLocked = false;
  let showingSummary = false;

  /** @type {{ changeLog: Record<string, string[]>, lockedAnswers: Record<string, string>, lastQuestionIndex: number|null }} */
  let state = createEmptyState();

  function createEmptyState() {
    return {
      changeLog: {},
      lockedAnswers: {},
      lastQuestionIndex: null
    };
  }

  function stateKey(code) {
    return STATE_PREFIX + code.toUpperCase();
  }

  function endedRoomKey(code) {
    return ENDED_ROOM_PREFIX + code.toUpperCase();
  }

  function isRoomMarkedEnded(code) {
    try {
      return sessionStorage.getItem(endedRoomKey(code)) === '1';
    } catch {
      return false;
    }
  }

  function markRoomEnded(code) {
    try {
      sessionStorage.setItem(endedRoomKey(code), '1');
    } catch {
      /* ignore */
    }
  }

  function clearRoomEnded(code) {
    try {
      sessionStorage.removeItem(endedRoomKey(code));
    } catch {
      /* ignore */
    }
  }

  function loadState(code) {
    try {
      const raw = sessionStorage.getItem(stateKey(code));
      if (!raw) {
        return createEmptyState();
      }
      const parsed = JSON.parse(raw);
      return {
        changeLog: parsed.changeLog || {},
        lockedAnswers: parsed.lockedAnswers || {},
        lastQuestionIndex:
          typeof parsed.lastQuestionIndex === 'number' ? parsed.lastQuestionIndex : null
      };
    } catch {
      return createEmptyState();
    }
  }

  function saveState() {
    if (!roomCode) {
      return;
    }
    try {
      sessionStorage.setItem(
        stateKey(roomCode),
        JSON.stringify({
          changeLog: state.changeLog,
          lockedAnswers: state.lockedAnswers,
          lastQuestionIndex: state.lastQuestionIndex
        })
      );
    } catch {
      /* ignore */
    }
  }

  function clearJoinFieldError() {
    joinFieldErrorEl.textContent = '';
    joinFieldErrorEl.classList.add('hidden');
    joinFieldErrorEl.classList.remove('animate-shake');
    roomInput.classList.remove('input-invalid');
    roomInput.removeAttribute('aria-invalid');
  }

  function showJoinFieldError(message) {
    joinFieldErrorEl.textContent = message;
    joinFieldErrorEl.classList.remove('hidden');
    joinFieldErrorEl.classList.remove('animate-shake');
    void joinFieldErrorEl.offsetWidth;
    joinFieldErrorEl.classList.add('animate-shake');
    roomInput.classList.add('input-invalid');
    roomInput.setAttribute('aria-invalid', 'true');
  }

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

  function getPlayerId() {
    if (cachedPlayerId) {
      return cachedPlayerId;
    }

    try {
      cachedPlayerId = sessionStorage.getItem(PLAYER_ID_KEY) || '';
    } catch {
      cachedPlayerId = '';
    }

    if (!cachedPlayerId) {
      cachedPlayerId =
        (window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      try {
        sessionStorage.setItem(PLAYER_ID_KEY, cachedPlayerId);
      } catch {
        /* keep in-memory id */
      }
    }

    return cachedPlayerId;
  }

  function normalizeRoomCode(value) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function readRoomFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return normalizeRoomCode(params.get('room') || '');
  }

  function hideAllSections() {
    closeHint();
    joinSection.classList.add('hidden');
    waitingSection.classList.add('hidden');
    questionSection.classList.add('hidden');
    summarySection.classList.add('hidden');
  }

  function showDisconnectOverlay(title, message, { showRetry = false } = {}) {
    sessionLive = false;
    roomConnected = false;
    hideAllSections();
    disconnectTitleEl.textContent = title;
    disconnectMessageEl.textContent = message;
    disconnectRetryBtn.classList.toggle('hidden', !showRetry);
    disconnectOverlay.classList.remove('hidden');
  }

  function hideDisconnectMessage() {
    disconnectOverlay.classList.add('hidden');
    disconnectTitleEl.textContent = 'Disconnected';
    disconnectMessageEl.textContent = '';
    disconnectRetryBtn.classList.add('hidden');
  }

  function clearHelloTimer() {
    if (helloTimer) {
      clearInterval(helloTimer);
      helloTimer = null;
    }
  }

  function startHelloPulse(activeChannel) {
    clearHelloTimer();
    helloTimer = setInterval(() => {
      if (!roomConnected || sessionLive || !activeChannel) {
        return;
      }
      Diagnose.broadcastPlayerHello(activeChannel).catch(() => {});
    }, HELLO_INTERVAL_MS);
  }

  async function leaveChannel() {
    clearHelloTimer();
    if (!channel) {
      return;
    }
    try {
      await Diagnose.untrackPresence(channel);
      await channel.unsubscribe();
    } catch {
      /* ignore */
    }
    channel = null;
  }

  function showWaiting() {
    hideAllSections();
    hideDisconnectMessage();
    waitingSection.classList.remove('hidden');
    waitingRoomCodeEl.textContent = roomCode ? `Room ${roomCode}` : '';
    waitingMessageEl.textContent = 'The host hasn\'t started the session yet.';
  }

  function showJoin() {
    hideAllSections();
    hideDisconnectMessage();
    joinSection.classList.remove('hidden');
  }

  function activateSession() {
    if (sessionLive) {
      return;
    }
    clearHelloTimer();
    if (roomCode) {
      clearRoomEnded(roomCode);
    }
    sessionLive = true;
  }

  function renderProgressSteps(activeIndex) {
    if (!progressStepsEl) {
      return;
    }

    const total = DiagnoseQuestions.getQuestionCount();
    progressStepsEl.replaceChildren();

    for (let i = 1; i <= total; i += 1) {
      const step = document.createElement('span');
      step.className = 'diagnose-progress-step';
      step.textContent = String(i);
      if (i < activeIndex) {
        step.classList.add('done');
      }
      if (i === activeIndex) {
        step.classList.add('active');
      }
      if (state.lockedAnswers[String(i)]) {
        step.classList.add('locked');
      }
      progressStepsEl.appendChild(step);
    }
  }

  function renderCaseText(segments) {
    caseTextEl.replaceChildren();
    (segments || []).forEach((segment) => {
      if (segment.isNew) {
        const mark = document.createElement('mark');
        mark.className = 'context-new';
        mark.textContent = segment.text;
        caseTextEl.appendChild(mark);
      } else {
        caseTextEl.appendChild(document.createTextNode(segment.text));
      }
    });
  }

  function getLabelsForQuestion(question) {
    if (question?.labels) {
      return question.labels;
    }
    const local = DiagnoseQuestions.getQuestion(question?.index);
    return local?.labels || {};
  }

  function updateOptionSelectionUi() {
    const buttons = answerOptionsEl.querySelectorAll('.diagnose-answer-btn');
    buttons.forEach((btn) => {
      const key = btn.dataset.key;
      const selected = key === currentSelection;
      btn.classList.toggle('selected', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
      btn.disabled = isLocked;
    });
    lockBtn.disabled = isLocked || !currentSelection;
  }

  function commitQuestionAnswer(questionIndex, answerKey) {
    if (questionIndex == null || !answerKey) {
      return;
    }

    const indexKey = String(questionIndex);
    const log = state.changeLog[indexKey] ? state.changeLog[indexKey].slice() : [];

    if (log.length === 0 || log[log.length - 1] !== answerKey) {
      log.push(answerKey);
    }

    state.changeLog[indexKey] = log;
    state.lockedAnswers[indexKey] = answerKey;
    saveState();
  }

  function updateLiveChangeHint() {
    if (!currentQuestion || isLocked) {
      return;
    }

    const log = state.changeLog[String(currentQuestion.index)] || [];
    const changes = countChanges(log);
    if (!currentSelection) {
      lockStatusEl.textContent = 'Select an answer, then lock it in';
    } else if (changes === 0) {
      lockStatusEl.textContent = 'Tap Lock in when you are sure';
    } else if (changes === 1) {
      lockStatusEl.textContent = 'Changed once — lock in when ready';
    } else {
      lockStatusEl.textContent = `Changed ${changes} times — lock in when ready`;
    }
  }

  function selectAnswer(key) {
    if (isLocked || !currentQuestion) {
      return;
    }

    const indexKey = String(currentQuestion.index);
    const log = state.changeLog[indexKey] ? state.changeLog[indexKey].slice() : [];

    if (log.length === 0 || log[log.length - 1] !== key) {
      log.push(key);
      state.changeLog[indexKey] = log;
      saveState();
    }

    currentSelection = key;
    updateOptionSelectionUi();
    updateLiveChangeHint();
  }

  function renderAnswerOptions(question) {
    answerOptionsEl.replaceChildren();
    const labels = getLabelsForQuestion(question);
    const keys = question.options || DiagnoseQuestions.getOptionKeys();

    keys.forEach((key) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'diagnose-answer-btn';
      button.dataset.key = key;

      const letter = document.createElement('span');
      letter.className = 'diagnose-answer-letter';
      letter.textContent = key;

      const label = document.createElement('span');
      label.className = 'diagnose-answer-label';
      label.textContent = labels[key] || key;

      button.appendChild(letter);
      button.appendChild(label);
      button.addEventListener('click', () => selectAnswer(key));
      answerOptionsEl.appendChild(button);
    });

    updateOptionSelectionUi();
  }

  function showQuestionUi() {
    hideAllSections();
    hideDisconnectMessage();
    questionSection.classList.remove('hidden');
  }

  function fillHint(questionIndex) {
    const hint = DiagnoseQuestions.getHint(questionIndex);
    if (!hintBtn) {
      return;
    }
    if (!hint) {
      hintBtn.classList.add('hidden');
      closeHint();
      return;
    }

    hintBtn.classList.remove('hidden');
    if (hintTitleEl) {
      hintTitleEl.textContent = hint.title || 'Hint';
    }
    if (hintNoticeEl) {
      hintNoticeEl.replaceChildren();
      if (hint.notice) {
        const noticeTitle = document.createElement('p');
        noticeTitle.className = 'hint-notice-title';
        noticeTitle.textContent = hint.notice.title || '';
        const noticeBody = document.createElement('p');
        noticeBody.className = 'hint-notice-body';
        noticeBody.textContent = hint.notice.body || '';
        hintNoticeEl.appendChild(noticeTitle);
        hintNoticeEl.appendChild(noticeBody);
        hintNoticeEl.classList.remove('hidden');
      } else {
        hintNoticeEl.classList.add('hidden');
      }
    }
    if (!hintContentEl) {
      return;
    }

    hintContentEl.replaceChildren();
    (hint.parts || []).forEach((part) => {
      if (!part || !part.type) {
        return;
      }

      if (part.type === 'text') {
        const p = document.createElement('p');
        p.className = 'hint-body';
        p.textContent = part.value || '';
        hintContentEl.appendChild(p);
        return;
      }

      if (part.type === 'heading') {
        const h = document.createElement('p');
        h.className = 'hint-heading';
        h.textContent = part.value || '';
        hintContentEl.appendChild(h);
        return;
      }

      if (part.type === 'label') {
        const label = document.createElement('p');
        label.className = 'hint-items-label';
        label.textContent = part.value || '';
        hintContentEl.appendChild(label);
        return;
      }

      if (part.type === 'list') {
        const list = document.createElement('ul');
        list.className = 'hint-items';
        (part.items || []).forEach((item) => {
          const li = document.createElement('li');
          li.textContent = item;
          list.appendChild(li);
        });
        hintContentEl.appendChild(list);
      }
    });
  }

  function resetHintSheetPosition() {
    if (!hintSheetCard) {
      return;
    }
    hintSheetCard.style.transition = '';
    hintSheetCard.style.transform = '';
    if (hintSheet) {
      hintSheet.style.setProperty('--hint-drag', '0px');
    }
  }

  function openHint() {
    if (!hintSheet || hintBtn?.classList.contains('hidden')) {
      return;
    }
    resetHintSheetPosition();
    hintSheet.classList.remove('hidden');
    hintSheet.hidden = false;
    document.body.classList.add('hint-open');
    if (hintBtn) {
      hintBtn.setAttribute('aria-expanded', 'true');
      hintBtn.classList.add('is-open');
    }
    if (hintCloseBtn) {
      hintCloseBtn.focus();
    }
  }

  function closeHint() {
    if (!hintSheet) {
      return;
    }
    hintSheet.classList.add('hidden');
    hintSheet.hidden = true;
    document.body.classList.remove('hint-open');
    resetHintSheetPosition();
    if (hintBtn) {
      hintBtn.setAttribute('aria-expanded', 'false');
      hintBtn.classList.remove('is-open');
    }
  }

  function setupHintSwipe() {
    if (!hintSheetCard) {
      return;
    }

    let startY = 0;
    let currentY = 0;
    let dragging = false;
    let startedOnHandle = false;

    function isFromHandle(target) {
      return Boolean(
        target &&
          (target.classList?.contains('hint-sheet-handle') ||
            target.classList?.contains('hint-sheet-head') ||
            target.classList?.contains('hint-sheet-kicker') ||
            target.closest?.('.hint-sheet-handle') ||
            target.closest?.('.hint-sheet-head'))
      );
    }

    function onTouchStart(event) {
      if (!event.touches || event.touches.length !== 1) {
        return;
      }
      startY = event.touches[0].clientY;
      currentY = startY;
      startedOnHandle = isFromHandle(event.target);
      dragging = startedOnHandle || hintSheetCard.scrollTop <= 0;
      hintSheetCard.style.transition = 'none';
    }

    function onTouchMove(event) {
      if (!dragging || !event.touches || event.touches.length !== 1) {
        return;
      }

      currentY = event.touches[0].clientY;
      const delta = currentY - startY;

      if (!startedOnHandle && hintSheetCard.scrollTop > 0 && delta > 0) {
        dragging = false;
        hintSheetCard.style.transform = '';
        return;
      }

      if (delta <= 0) {
        hintSheetCard.style.transform = '';
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      hintSheetCard.style.transform = `translateY(${delta}px)`;
    }

    function onTouchEnd() {
      if (!dragging) {
        return;
      }

      const delta = currentY - startY;
      dragging = false;
      hintSheetCard.style.transition = 'transform 0.22s ease-out';

      if (delta > 90) {
        hintSheetCard.style.transform = 'translateY(110%)';
        window.setTimeout(() => {
          closeHint();
        }, 180);
        return;
      }

      hintSheetCard.style.transform = '';
      window.setTimeout(() => {
        if (hintSheetCard) {
          hintSheetCard.style.transition = '';
        }
      }, 220);
    }

    hintSheetCard.addEventListener('touchstart', onTouchStart, { passive: true });
    hintSheetCard.addEventListener('touchmove', onTouchMove, { passive: false });
    hintSheetCard.addEventListener('touchend', onTouchEnd);
    hintSheetCard.addEventListener('touchcancel', onTouchEnd);
  }

  function toggleHint() {
    if (hintSheet && !hintSheet.hidden) {
      closeHint();
    } else {
      openHint();
    }
  }

  function applyQuestion(payload) {
    const incomingIndex = Number(payload && payload.index);
    if (!Number.isFinite(incomingIndex) || incomingIndex < 1) {
      return;
    }

    activateSession();

    const previousIndex = state.lastQuestionIndex;

    // Host resends the same question on a timer — don't reset the answering UI
    if (
      previousIndex === incomingIndex &&
      currentQuestion &&
      Number(currentQuestion.index) === incomingIndex &&
      !showingSummary
    ) {
      return;
    }

    showingSummary = false;

    // Host moved on: keep whatever they last picked (don't wipe change history)
    if (previousIndex != null && previousIndex !== incomingIndex) {
      const prevKey = String(previousIndex);
      if (!state.lockedAnswers[prevKey]) {
        const prevLog = state.changeLog[prevKey] || [];
        const answer =
          (currentQuestion && Number(currentQuestion.index) === previousIndex
            ? currentSelection
            : null) || (prevLog.length ? prevLog[prevLog.length - 1] : null);
        if (answer) {
          commitQuestionAnswer(previousIndex, answer);
        }
      }
    }

    currentQuestion = payload;
    state.lastQuestionIndex = incomingIndex;
    saveState();

    const indexKey = String(incomingIndex);
    const alreadyLocked = Boolean(state.lockedAnswers[indexKey]);
    isLocked = alreadyLocked;
    currentSelection = alreadyLocked
      ? state.lockedAnswers[indexKey]
      : null;

    if (!alreadyLocked && state.changeLog[indexKey]?.length) {
      const log = state.changeLog[indexKey];
      currentSelection = log[log.length - 1];
    }

    const total = DiagnoseQuestions.getQuestionCount();
    questionBadgeEl.textContent = `Question ${incomingIndex} of ${total}`;
    renderProgressSteps(incomingIndex);
    questionPromptEl.textContent = payload.prompt || '';
    renderCaseText(payload.segments);
    renderAnswerOptions(payload);
    fillHint(incomingIndex);
    closeHint();

    if (isLocked) {
      lockBtn.textContent = 'Answer locked';
      lockStatusEl.textContent =
        incomingIndex >= total
          ? 'Answer locked'
          : 'Answer locked — waiting for next question';
      if (incomingIndex >= total) {
        showSummary();
        return;
      }
    } else {
      lockBtn.textContent = 'Lock in answer';
      updateLiveChangeHint();
    }

    showQuestionUi();
  }

  function countChanges(log) {
    if (!log || log.length <= 1) {
      return 0;
    }
    return log.length - 1;
  }

  function getFinalAnswer(questionIndex) {
    const key = String(questionIndex);
    if (state.lockedAnswers[key]) {
      return state.lockedAnswers[key];
    }
    const log = state.changeLog[key] || [];
    return log.length ? log[log.length - 1] : null;
  }

  function computeTotalChanges() {
    const totalQuestions = DiagnoseQuestions.getQuestionCount();
    let withinChanges = 0;
    let crossChanges = 0;

    for (let i = 1; i <= totalQuestions; i += 1) {
      const log = state.changeLog[String(i)] || [];
      withinChanges += countChanges(log);

      if (i > 1) {
        const prev = getFinalAnswer(i - 1);
        const finalAnswer = getFinalAnswer(i);
        if (prev && finalAnswer && prev !== finalAnswer) {
          crossChanges += 1;
        }
      }
    }

    return withinChanges + crossChanges;
  }

  async function sendChangeSummary() {
    if (!channel || !roomConnected) {
      return;
    }
    try {
      await Diagnose.broadcastChangeSummary(
        channel,
        getPlayerId(),
        computeTotalChanges(),
        currentQuestion ? Number(currentQuestion.index) : 0
      );
    } catch {
      /* host may already have ended */
    }
  }

  function buildJourney(sequence, labels, { showQuestionTags = false } = {}) {
    const journey = document.createElement('div');
    journey.className = 'diagnose-journey';

    sequence.forEach((entry, index) => {
      const key = typeof entry === 'string' ? entry : entry.key;
      const tag = typeof entry === 'string' ? null : entry.tag;

      if (index > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'diagnose-journey-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        journey.appendChild(arrow);
      }

      const node = document.createElement('div');
      node.className = 'diagnose-journey-node';
      if (index === 0) {
        node.classList.add('start');
      }
      if (index === sequence.length - 1) {
        node.classList.add('final');
      }
      if (index > 0 && index < sequence.length - 1) {
        node.classList.add('mid');
      }

      if (showQuestionTags && tag) {
        const qtag = document.createElement('span');
        qtag.className = 'diagnose-journey-qtag';
        qtag.textContent = tag;
        node.appendChild(qtag);
      }

      const letter = document.createElement('span');
      letter.className = 'diagnose-journey-letter';
      letter.textContent = key;

      const name = document.createElement('span');
      name.className = 'diagnose-journey-name';
      name.textContent = labels[key] || key;

      node.appendChild(letter);
      node.appendChild(name);
      node.title = labels[key] || key;
      journey.appendChild(node);
    });

    return journey;
  }

  async function showSummary() {
    showingSummary = true;
    hideAllSections();
    hideDisconnectMessage();
    summarySection.classList.remove('hidden');

    if (currentQuestion && currentSelection) {
      commitQuestionAnswer(currentQuestion.index, currentSelection);
    }

    summaryListEl.replaceChildren();

    const totalQuestions = DiagnoseQuestions.getQuestionCount();
    const finals = [];

    for (let i = 1; i <= totalQuestions; i += 1) {
      const finalAnswer = getFinalAnswer(i);
      if (finalAnswer) {
        finals.push({ key: finalAnswer, tag: `Q${i}` });
      }
    }

    const totalChanges = computeTotalChanges();

    const pathItem = document.createElement('li');
    pathItem.className = 'diagnose-summary-item diagnose-summary-overall';
    if (totalChanges > 0) {
      pathItem.classList.add('has-changes');
    }

    const pathHead = document.createElement('div');
    pathHead.className = 'diagnose-summary-head';
    const pathTitle = document.createElement('p');
    pathTitle.className = 'diagnose-summary-q';
    pathTitle.textContent = 'Your path';
    const pathBadge = document.createElement('span');
    pathBadge.className = 'diagnose-summary-badge';
    pathBadge.textContent =
      totalChanges === 0
        ? '0 changes'
        : totalChanges === 1
          ? '1 change'
          : `${totalChanges} changes`;
    if (totalChanges === 0) {
      pathBadge.classList.add('zero');
    }
    pathHead.appendChild(pathTitle);
    pathHead.appendChild(pathBadge);
    pathItem.appendChild(pathHead);

    if (finals.length > 0) {
      const labelMap = {};
      DiagnoseQuestions.getOptionKeys().forEach((key) => {
        labelMap[key] = DiagnoseQuestions.getOptionLabel(
          DiagnoseQuestions.getQuestion(1),
          key
        );
      });
      labelMap.E = DiagnoseQuestions.getOptionLabel(
        DiagnoseQuestions.getQuestion(totalQuestions),
        'E'
      );
      pathItem.appendChild(
        buildJourney(finals, labelMap, { showQuestionTags: true })
      );
    } else {
      const empty = document.createElement('p');
      empty.className = 'diagnose-summary-empty';
      empty.textContent = 'No answers recorded';
      pathItem.appendChild(empty);
    }

    summaryListEl.appendChild(pathItem);

    summaryTotalEl.textContent =
      totalChanges === 0
        ? 'You made no answer changes.'
        : totalChanges === 1
          ? 'You changed your answer 1 time.'
          : `You changed your answer ${totalChanges} times.`;

    await sendChangeSummary();
  }

  async function lockInAnswer() {
    if (!channel || !currentQuestion || !currentSelection || isLocked) {
      return;
    }

    clearError();
    lockBtn.disabled = true;
    lockBtn.textContent = 'Locking…';

    const questionIndex = Number(currentQuestion.index);

    try {
      await Diagnose.broadcastAnswerLocked(channel, getPlayerId(), questionIndex);
      isLocked = true;
      commitQuestionAnswer(questionIndex, currentSelection);
      updateOptionSelectionUi();
      lockBtn.textContent = 'Answer locked';
      await sendChangeSummary();

      const total = DiagnoseQuestions.getQuestionCount();
      if (questionIndex >= total) {
        lockStatusEl.textContent = 'Answer locked';
        await showSummary();
      } else {
        lockStatusEl.textContent = 'Answer locked — waiting for next question';
      }
    } catch (error) {
      lockBtn.disabled = false;
      lockBtn.textContent = 'Lock in answer';
      showError(error.message || 'Could not lock in your answer.');
    }
  }

  function handleConnectionLost(title, message) {
    clearHelloTimer();
    showDisconnectOverlay(title, message, { showRetry: true });
  }

  async function joinRoom(code) {
    clearError();
    clearJoinFieldError();

    const normalized = normalizeRoomCode(code);
    if (normalized.length < 4) {
      showJoinFieldError('Enter the room code from the host.');
      return;
    }

    if (isRoomMarkedEnded(normalized)) {
      showDisconnectOverlay(
        'Session ended',
        'This room has already ended. Ask the host for a new code.',
        { showRetry: false }
      );
      return;
    }

    await leaveChannel();
    roomCode = normalized;
    state = loadState(roomCode);
    sessionLive = false;
    roomConnected = false;
    currentQuestion = null;
    currentSelection = null;
    isLocked = false;
    showingSummary = false;

    const joinButton = joinForm.querySelector('button[type="submit"]');
    if (joinButton) {
      joinButton.disabled = true;
      joinButton.textContent = 'Joining…';
    }

    try {
      const supabase = Diagnose.createSupabaseClient();
      channel = await Diagnose.joinRoomChannel(supabase, roomCode, {
        presenceKey: getPlayerId(),
        onStatus(status) {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            handleConnectionLost(
              'Connection lost',
              'Could not stay connected to the room. Check your connection and try again.'
            );
          }
        },
        onSetup(ch) {
          Diagnose.onSessionStart(ch, () => {
            activateSession();
            if (!currentQuestion && !showingSummary) {
              waitingMessageEl.textContent = 'Session started — waiting for the first question…';
              showWaiting();
            }
          });

          Diagnose.onQuestionUpdate(ch, (payload) => {
            applyQuestion(payload);
          });

          Diagnose.onSessionEnd(ch, async () => {
            markRoomEnded(roomCode);
            const hasAnswers =
              showingSummary ||
              Object.keys(state.lockedAnswers).length > 0 ||
              Boolean(currentSelection);
            if (hasAnswers) {
              await showSummary();
              await leaveChannel();
              return;
            }
            await leaveChannel();
            showDisconnectOverlay(
              'Session ended',
              'The host ended this session.',
              { showRetry: false }
            );
          });
        }
      });

      await Diagnose.trackPlayerPresence(channel, getPlayerId());
      roomConnected = true;
      await Diagnose.broadcastPlayerHello(channel).catch(() => {});
      startHelloPulse(channel);

      // If already finished this room (Q6 locked), show private summary
      const lastIndex = DiagnoseQuestions.getQuestionCount();
      if (state.lockedAnswers[String(lastIndex)]) {
        sessionLive = true;
        showSummary();
      } else {
        // Wait for host pulse (session-start + question-update) so we sync to live question
        showWaiting();
        if (sessionLive || state.lastQuestionIndex) {
          waitingMessageEl.textContent =
            'Reconnected — waiting for the current question…';
        }
      }

      const url = new URL(window.location.href);
      url.searchParams.set('room', roomCode);
      window.history.replaceState({}, '', url);
    } catch (error) {
      roomConnected = false;
      showError(error.message || 'Could not join room.');
      showJoin();
    } finally {
      if (joinButton) {
        joinButton.disabled = false;
        joinButton.textContent = "Let's go";
      }
    }
  }

  joinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    joinRoom(roomInput.value);
  });

  lockBtn.addEventListener('click', lockInAnswer);

  if (hintBtn) {
    hintBtn.addEventListener('click', toggleHint);
  }
  if (hintBackdrop) {
    hintBackdrop.addEventListener('click', closeHint);
  }
  if (hintCloseBtn) {
    hintCloseBtn.addEventListener('click', closeHint);
  }
  if (hintGotItBtn) {
    hintGotItBtn.addEventListener('click', closeHint);
  }
  setupHintSwipe();
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeHint();
    }
  });

  disconnectRetryBtn.addEventListener('click', () => {
    hideDisconnectMessage();
    if (roomCode) {
      joinRoom(roomCode);
    } else {
      showJoin();
    }
  });

  const fromUrl = readRoomFromUrl();
  if (fromUrl) {
    roomInput.value = fromUrl;
    joinRoom(fromUrl);
  } else {
    showJoin();
  }
})();
