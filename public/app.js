/* ═══════════════════════════════════════════════════════════════
   Python MCQ Exam — Student Client
   ═══════════════════════════════════════════════════════════════ */
const socket = io();

// ── DOM refs ─────────────────────────────────────────────────────
const joinScreen     = document.getElementById("join-screen");
const lobbyScreen    = document.getElementById("lobby-screen");
const gameScreen     = document.getElementById("game-screen");
const finishedScreen = document.getElementById("finished-screen");
const nameInput      = document.getElementById("player-name");
const pinInput       = document.getElementById("game-pin");
const joinBtn        = document.getElementById("join-btn");
const joinError      = document.getElementById("join-error");
const lobbyName      = document.getElementById("lobby-name");
const lobbyCount     = document.getElementById("lobby-count");
const lobbyPlayers   = document.getElementById("lobby-players");
const displayName    = document.getElementById("display-name");
const displayScore   = document.getElementById("display-score");
const displaySolved  = document.getElementById("display-solved");
const displayTotal   = document.getElementById("display-total");
const timerDisplay   = document.getElementById("timer-display");
const riddleCard     = document.getElementById("riddle-card");
const completeCard   = document.getElementById("complete-card");
const riddleCat      = document.getElementById("riddle-category");
const riddleText     = document.getElementById("riddle-text");
const qCurrNum       = document.getElementById("q-curr-num");
const qTotalNum      = document.getElementById("q-total-num");
const optionsContainer = document.getElementById("options-container");
const submitBtn      = document.getElementById("submit-btn");
const feedback       = document.getElementById("feedback");
const lbList         = document.getElementById("leaderboard-list");
const finalScore     = document.getElementById("final-score");
const finFinalScore  = document.getElementById("fin-final-score");
const finFinalRank   = document.getElementById("fin-final-rank");
const finLbList      = document.getElementById("fin-leaderboard-list");
const tabWarningModal = document.getElementById("tab-warning-modal");
const warningCountNum = document.getElementById("warning-count-num");
const resumeQuizBtn   = document.getElementById("resume-quiz-btn");

let myName = "";
let currentRiddleId = null;
let selectedOption = null;
let totalQuestions = 50;
let answeredCount = 0;
let tabSwitchCount = 0;
let lastTabSwitchTime = 0;

// ── Session Storage Helpers ──────────────────────────────────────
const SESSION_KEY = "riddle_quest_player_session";

function saveSession(data) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {}
}

function getSavedSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

// ── Screens ──────────────────────────────────────────────────────
function showScreen(screen) {
  [joinScreen, lobbyScreen, gameScreen, finishedScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

// ── Join ─────────────────────────────────────────────────────────
function joinGame() {
  const name = nameInput.value.trim();
  const pin = pinInput.value.trim();
  if (!name) { joinError.textContent = "Please enter your name!"; return; }
  if (!pin)  { joinError.textContent = "Please enter the Exam PIN!"; return; }
  joinBtn.disabled = true;
  joinBtn.textContent = "Joining...";
  joinError.textContent = "";
  socket.emit("join", { name, pin });
}

joinBtn.addEventListener("click", joinGame);
pinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") joinGame(); });
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") pinInput.focus(); });

// ── Server: joined lobby ─────────────────────────────────────────
socket.on("joined_lobby", (data) => {
  myName = data.name;
  if (data.sessionId) {
    saveSession({
      sessionId: data.sessionId,
      name: data.name,
      pin: pinInput.value.trim() || (getSavedSession() || {}).pin || "",
    });
  }
  lobbyName.textContent = data.name;
  lobbyCount.textContent = data.playerCount;
  renderLobbyPlayers(data.players);
  showScreen(lobbyScreen);
});

socket.on("lobby_update", (data) => {
  lobbyCount.textContent = data.playerCount;
  renderLobbyPlayers(data.players);
});

function renderLobbyPlayers(playersList) {
  lobbyPlayers.innerHTML = playersList
    .map(name => {
      const isMe = name === myName ? " is-me" : "";
      return `<div class="lobby-player${isMe}">🧙‍♂️ ${escHtml(name)}</div>`;
    })
    .join("");
}

// ── Server: game started ─────────────────────────────────────────
socket.on("game_started", (data) => {
  if (data.name) myName = data.name;
  if (data.sessionId) {
    saveSession({
      sessionId: data.sessionId,
      name: myName,
      pin: pinInput.value.trim() || (getSavedSession() || {}).pin || "",
    });
  }
  displayName.textContent = myName;
  displayScore.textContent = data.score || 0;
  totalQuestions = data.total || 50;
  answeredCount = data.answered || data.solved || 0;
  displaySolved.textContent = answeredCount;
  displayTotal.textContent = totalQuestions;
  timerDisplay.textContent = formatTime(data.timeRemaining);
  showScreen(gameScreen);
  if (data.riddle) showRiddle(data.riddle);
  else showComplete(data.score);
});

// ── Server: joined mid-game / restored ───────────────────────────
socket.on("joined", (data) => {
  myName = data.name;
  if (data.sessionId) {
    saveSession({
      sessionId: data.sessionId,
      name: data.name,
      pin: pinInput.value.trim() || (getSavedSession() || {}).pin || "",
    });
  }
  displayName.textContent = data.name;
  displayScore.textContent = data.score || 0;
  totalQuestions = data.total || 50;
  answeredCount = (data.answered != null) ? data.answered : (data.solved || 0);
  displaySolved.textContent = answeredCount;
  displayTotal.textContent = totalQuestions;
  timerDisplay.textContent = formatTime(data.timeRemaining);
  showScreen(gameScreen);
  if (data.riddle) showRiddle(data.riddle);
  else showComplete(data.score);
});

// ── Server: error msg ────────────────────────────────────────────
socket.on("error_msg", (msg) => {
  joinError.textContent = msg;
  joinBtn.disabled = false;
  joinBtn.textContent = "Join Exam";
});

// ── Server: session invalid ──────────────────────────────────────
socket.on("session_invalid", () => {
  clearSession();
  showScreen(joinScreen);
  joinBtn.disabled = false;
  joinBtn.textContent = "Join Exam";
});

// ── Timer tick ───────────────────────────────────────────────────
socket.on("timer_tick", (remaining) => {
  timerDisplay.textContent = formatTime(remaining);
  if (remaining <= 60) {
    timerDisplay.classList.add("danger");
  } else {
    timerDisplay.classList.remove("danger");
  }
});

// ── Game finished ────────────────────────────────────────────────
socket.on("game_finished", (data) => {
  if (tabWarningModal) tabWarningModal.classList.add("hidden");
  if (!myName && getSavedSession()) myName = getSavedSession().name || "";
  const lb = data.leaderboard;
  const myEntry = lb.find(p => p.name === myName);
  const myRank = myEntry ? lb.indexOf(myEntry) + 1 : "—";
  const myScore = myEntry ? myEntry.score : 0;

  finFinalScore.textContent = myScore;
  finFinalRank.textContent = myRank === 1 ? "🥇 1st" : myRank === 2 ? "🥈 2nd" : myRank === 3 ? "🥉 3rd" : `#${myRank}`;

  finLbList.innerHTML = lb.map((p, i) => {
    const rank = i + 1;
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
    const rankClass = rank <= 3 ? ` rank-${rank}` : "";
    const meClass = p.name === myName ? " is-me" : "";
    return `<div class="lb-row${rankClass}${meClass}">
      <span class="lb-rank">${medal}</span>
      <span class="lb-name">${escHtml(p.name)}</span>
      <span class="lb-solved">${p.answered || p.solved}/${p.total}</span>
      <span class="lb-score">${p.score}</span>
    </div>`;
  }).join("");
  showScreen(finishedScreen);
});

// ── MCQ Question display ─────────────────────────────────────────
function showRiddle(r) {
  currentRiddleId = r.id;
  selectedOption = null;
  submitBtn.disabled = true;
  submitBtn.dataset.submitting = "false";
  submitBtn.textContent = "Submit Answer ➔";

  riddleCat.textContent = "🔮 " + (r.category || "Arcane Computing");
  riddleText.textContent = r.question || r.riddle;

  if (qCurrNum) qCurrNum.textContent = Math.min(answeredCount + 1, totalQuestions);
  if (qTotalNum) qTotalNum.textContent = totalQuestions;

  feedback.classList.add("hidden");
  feedback.className = "feedback hidden";
  riddleCard.classList.remove("hidden");
  completeCard.classList.add("hidden");

  const letters = ["A", "B", "C", "D"];
  const opts = r.options || [];

  optionsContainer.innerHTML = opts.map((opt, i) => {
    const letter = letters[i] || (i + 1);
    return `
      <button class="option-card" type="button" data-val="${escHtml(opt)}">
        <span class="option-tag">${letter}</span>
        <span class="option-label">${escHtml(opt)}</span>
      </button>
    `;
  }).join("");

  // Attach selection handlers to options
  const cards = optionsContainer.querySelectorAll(".option-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      if (submitBtn.dataset.submitting === "true") return;
      cards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedOption = card.getAttribute("data-val");
      submitBtn.disabled = false;
    });
  });
}

function showComplete(score) {
  riddleCard.classList.add("hidden");
  completeCard.classList.remove("hidden");
  finalScore.textContent = score;
  displaySolved.textContent = totalQuestions;
}

// ── Submit answer ────────────────────────────────────────────────
function submitAnswer() {
  if (!selectedOption || currentRiddleId == null) return;
  if (submitBtn.dataset.submitting === "true") return;

  submitBtn.dataset.submitting = "true";
  submitBtn.disabled = true;
  submitBtn.textContent = "Checking...";

  // Disable options during submission
  const cards = optionsContainer.querySelectorAll(".option-card");
  cards.forEach(c => c.disabled = true);

  socket.emit("answer", { riddleId: currentRiddleId, answer: selectedOption });
}

submitBtn.addEventListener("click", submitAnswer);

// ── Result ───────────────────────────────────────────────────────
socket.on("result", (data) => {
  feedback.classList.remove("hidden", "correct", "wrong");
  submitBtn.dataset.submitting = "false";

  if (data.answered != null) {
    answeredCount = data.answered;
    displaySolved.textContent = answeredCount;
  }
  if (data.score != null) {
    displayScore.textContent = data.score;
  }

  const cards = optionsContainer.querySelectorAll(".option-card");
  cards.forEach(c => {
    const val = c.getAttribute("data-val");
    if (val === selectedOption) {
      if (data.correct) {
        c.classList.add("correct");
      } else {
        c.classList.add("wrong");
      }
    }
    if (!data.correct && val === data.correctAnswer) {
      c.classList.add("correct");
    }
  });

  if (data.correct) {
    feedback.classList.add("correct");
    feedback.textContent = `✅ Correct! (+${data.points} pts)`;
  } else {
    feedback.classList.add("wrong");
    feedback.textContent = `❌ Incorrect (0 pts). Correct answer: ${data.correctAnswer}`;
  }

  setTimeout(() => {
    if (data.nextRiddle) {
      showRiddle(data.nextRiddle);
    } else {
      showComplete(data.score);
    }
  }, 1300);
});

// ── Leaderboard ──────────────────────────────────────────────────
socket.on("leaderboard", (board) => {
  if (!board.length) {
    lbList.innerHTML = '<p class="lb-empty">Waiting for students...</p>';
    return;
  }
  lbList.innerHTML = board.map((p, i) => {
    const rank = i + 1;
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
    const rankClass = rank <= 3 ? ` rank-${rank}` : "";
    const meClass = p.name === myName ? " is-me" : "";
    return `<div class="lb-row${rankClass}${meClass}">
      <span class="lb-rank">${medal}</span>
      <span class="lb-name">${escHtml(p.name)}</span>
      <span class="lb-solved">${p.answered || p.solved}/${p.total}</span>
      <span class="lb-score">${p.score}</span>
    </div>`;
  }).join("");
});

// ── Game reset / state ───────────────────────────────────────────
socket.on("game_reset", () => {
  clearSession();
  location.reload();
});

socket.on("game_state", (data) => {
  if (data.state === "finished" && !myName) {
    joinError.textContent = "The exam has ended. Ask the instructor to reset.";
    joinBtn.disabled = true;
  }
});

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ── Tab Switching Prevention / Detection ────────────────────────
if (resumeQuizBtn) {
  resumeQuizBtn.addEventListener("click", () => {
    if (tabWarningModal) tabWarningModal.classList.add("hidden");
  });
}

function handleTabSwitch() {
  // Only monitor while player is in active quiz gameplay
  if (!gameScreen.classList.contains("active")) return;
  if (completeCard && !completeCard.classList.contains("hidden")) return;
  if (finishedScreen && finishedScreen.classList.contains("active")) return;

  const now = Date.now();
  if (now - lastTabSwitchTime < 1500) return; // Debounce 1.5s
  lastTabSwitchTime = now;

  tabSwitchCount++;
  if (warningCountNum) warningCountNum.textContent = tabSwitchCount;
  if (tabWarningModal) tabWarningModal.classList.remove("hidden");

  socket.emit("tab_switch", { count: tabSwitchCount });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    handleTabSwitch();
  }
});

window.addEventListener("blur", () => {
  handleTabSwitch();
});

// Prevent selecting or copying questions
if (riddleCard) {
  riddleCard.addEventListener("contextmenu", (e) => e.preventDefault());
  riddleCard.addEventListener("copy", (e) => e.preventDefault());
}

// ── Auto-resume saved session on reload ─────────────────────────
(function checkSavedSession() {
  const savedSession = getSavedSession();
  if (savedSession && savedSession.sessionId) {
    myName = savedSession.name || "";
    nameInput.value = savedSession.name || "";
    pinInput.value = savedSession.pin || "";
    console.log("Resuming student session:", savedSession);
    socket.emit("resume_session", {
      sessionId: savedSession.sessionId,
      pin: savedSession.pin,
    });
  }
})();
