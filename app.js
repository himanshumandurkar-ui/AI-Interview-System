const API_URL = window.location.origin;
let authMode = "login";

let questions = [];
let currentIndex = -1;

function setAuthStatus(message) {
  setText("authStatus", message);
}

function showLogin(message = "Enter your username and password.") {
  authMode = "login";
  setText("authTitle", "AI Interview System");
  setText("authHelp", "Login to continue managing your profile, questions, practice, and progress.");
  setText("authAction", "Login");
  setText("authToggle", "Create New Account");
  setText("authStatus", message);

  const action = document.getElementById("authAction");
  const toggle = document.getElementById("authToggle");
  if (action) action.onclick = login;
  if (toggle) toggle.onclick = showRegister;
}

function showRegister() {
  authMode = "register";
  setText("authTitle", "Create Account");
  setText("authHelp", "Create your own login, then continue to the home page.");
  setText("authAction", "Create Account");
  setText("authToggle", "Back to Login");
  setText("authStatus", "Use at least 3 letters for username and 4 letters for password.");

  const action = document.getElementById("authAction");
  const toggle = document.getElementById("authToggle");
  if (action) action.onclick = register;
  if (toggle) toggle.onclick = showLogin;
}

async function login() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  if (!user || !pass) {
    setAuthStatus("Please enter username and password.");
    return;
  }

  setAuthStatus("Checking login...");

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username: user, password: pass })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Wrong username or password");
    }

    sessionStorage.setItem("loggedInUser", data.username || user);
    window.location.href = "home.html";
  } catch (error) {
    setAuthStatus(error.message || "Wrong username or password");
  }
}

async function register() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  if (!user || !pass) {
    setAuthStatus("Please enter username and password.");
    return;
  }

  setAuthStatus("Creating account...");

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username: user, password: pass })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Could not create account");
    }

    showLogin("Account created. You can login now.");
  } catch (error) {
    setAuthStatus(error.message || "Could not create account");
  }
}

function startPrep() {
  window.location.href = "interview.html";
}

function goToProfile() {
  window.location.href = "profile.html";
}

function goHome() {
  window.location.href = "home.html";
}

function goToDashboard() {
  window.location.href = "dashboard.html";
}

function goBack() {
  window.location.href = "dashboard.html";
}

function logout() {
  window.location.href = "login.html";
}

async function loadHomePage() {
  const user = sessionStorage.getItem("loggedInUser") || "Student";
  setText("homeUserName", user);

  try {
    const res = await fetch(`${API_URL}/get-user`);
    const profile = await res.json();
    setText("homeUserName", profile.name || user);
  } catch (error) {
    setText("homeUserName", user);
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerText = value;
}

function setScorePanel(score, mode) {
  const scoreValue = document.getElementById("scoreValue");
  const scoreMode = document.getElementById("scoreMode");

  if (scoreValue) {
    scoreValue.innerText = `Score: ${score ?? "--"}/10`;
  }

  if (scoreMode) {
    const isReal = mode === "real";
    scoreMode.innerText = isReal ? "Real AI Score" : mode === "demo" ? "Demo Score" : "Waiting";
    scoreMode.className = `ai-mode-badge ${isReal ? "real-ai" : "demo-ai"}`;
  }
}

function setButtonLoading(id, isLoading, loadingText) {
  const button = document.getElementById(id);
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.innerText;
    button.innerText = loadingText;
    button.disabled = true;
    button.classList.add("is-loading");
  } else {
    button.innerText = button.dataset.originalText || button.innerText;
    button.disabled = false;
    button.classList.remove("is-loading");
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getProfileForm() {
  return {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    company: document.getElementById("company").value.trim(),
    language: document.getElementById("language").value.trim(),
    domain: document.getElementById("domain").value.trim(),
    level: document.getElementById("level").value.trim()
  };
}

function validateProfile(profile) {
  return Object.values(profile).every(Boolean);
}

async function saveUser(profile) {
  const res = await fetch(`${API_URL}/save-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(profile)
  });

  if (!res.ok) {
    throw new Error("Unable to save user data");
  }
}

function localRoadmap(profile) {
  return `Step 1: Strengthen ${profile.language} fundamentals
Step 2: Practice ${profile.domain} concepts with small projects
Step 3: Solve common ${profile.company} interview questions
Step 4: Prepare clear HR and communication answers
Step 5: Take mock interviews and revise weak topics`;
}

async function createRoadmap() {
  const profile = await saveProfileFromDashboard().catch(() => null);
  if (!profile) {
    setText("saveStatus", "Could not save profile. Check that the server is running.");
    return;
  }

  setText("roadmapOutput", "Creating your roadmap...");
  await generateAIRoadmap(profile);
}

async function saveProfileFromDashboard() {
  const profile = getProfileForm();

  if (!validateProfile(profile)) {
    alert("Please fill all profile details first");
    return null;
  }

  setText("saveStatus", "Saving your details...");
  await saveUser(profile);
  setText("saveStatus", "Profile saved successfully.");
  return profile;
}

async function generateAIRoadmap(existingProfile) {
  const profile = existingProfile || (await saveProfileFromDashboard().catch(() => null));

  if (!profile || !validateProfile(profile)) {
    return;
  }

  setText("roadmapOutput", "Generating AI roadmap...");
  setText("saveStatus", "Generating AI roadmap...");
  setButtonLoading("regenerateRoadmapBtn", true, "Generating AI Roadmap...");

  try {
    const res = await fetch(`${API_URL}/roadmap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profile)
    });

    const data = await res.json();
    setText("roadmapOutput", data.roadmap || localRoadmap(profile));
    setText("saveStatus", "AI roadmap generated successfully.");
  } catch (error) {
    setText("roadmapOutput", localRoadmap(profile));
    setText("saveStatus", "AI service unavailable. Local roadmap generated.");
  } finally {
    setButtonLoading("regenerateRoadmapBtn", false);
  }
}

async function addQuestion() {
  const question = document.getElementById("customQuestion").value.trim();
  const domain = document.getElementById("questionDomain").value.trim();
  const level = document.getElementById("questionLevel").value.trim();

  if (!question || !domain || !level) {
    alert("Please fill question, domain, and level");
    return;
  }

  setText("questionStatus", "Saving question...");

  try {
    const res = await fetch(`${API_URL}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ question, domain, level })
    });

    if (!res.ok) {
      throw new Error("Unable to save question");
    }

    document.getElementById("customQuestion").value = "";
    setText("questionStatus", "Question saved. It can now appear in interview practice.");
    await loadSavedQuestions();
  } catch (error) {
    setText("questionStatus", "Could not save question. Check that the server is running.");
  }
}

async function loadSavedQuestions() {
  const list = document.getElementById("questionList");
  if (!list) return;

  try {
    const res = await fetch(`${API_URL}/questions`);
    const questionsData = await res.json();

    if (!questionsData.length) {
      list.innerHTML = "<p>No custom questions added yet.</p>";
      return;
    }

    list.innerHTML = questionsData
      .slice(0, 5)
      .map(
        (item) => `
          <div class="history-item">
            <strong>${escapeHTML(item.question)}</strong>
            <p>${escapeHTML(item.domain)} - ${escapeHTML(item.level)}</p>
          </div>
        `
      )
      .join("");
  } catch (error) {
    list.innerHTML = "<p>Unable to load saved questions.</p>";
  }
}

async function loadQuestion() {
  setText("question", "Loading question...");

  try {
    const res = await fetch(`${API_URL}/question`);
    const data = await res.json();
    const questionText = data.question || "What is a function?";

    questions.push(questionText);
    currentIndex++;
    setText("question", questionText);
  } catch (error) {
    const fallback = "What is a variable in programming?";
    questions.push(fallback);
    currentIndex++;
    setText("question", fallback);
  }
}

async function submitAnswer() {
  const answer = document.getElementById("answer").value.trim();

  if (!answer) {
    alert("Write something first");
    return;
  }

  setText("feedback", "Checking your answer...");

  try {
    const res = await fetch(`${API_URL}/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: questions[currentIndex],
        answer
      })
    });

    const data = await res.json();
    setText("feedback", data.feedback || "Answer submitted. Feedback service is currently unavailable.");
    setScorePanel(data.score, data.mode);
  } catch (error) {
    setText(
      "feedback",
      "Could not reach the AI scoring service. Start the server and try again."
    );
    setScorePanel(null, "demo");
  }
}

function nextQuestion() {
  document.getElementById("answer").value = "";
  setText("feedback", "Feedback will appear here after submission.");
  setScorePanel(null, "waiting");
  loadQuestion();
}

function previousQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    document.getElementById("answer").value = "";
    setText("question", questions[currentIndex]);
    setText("feedback", "Feedback will appear here after submission.");
    setScorePanel(null, "waiting");
  } else {
    setText("feedback", "No previous question available.");
  }
}

async function loadProfileData() {
  try {
    const [userRes, statsRes, historyRes] = await Promise.all([
      fetch(`${API_URL}/get-user`),
      fetch(`${API_URL}/stats`),
      fetch(`${API_URL}/interviews`)
    ]);

    const user = await userRes.json();
    const stats = await statsRes.json();
    const history = await historyRes.json();

    setText("profileName", user.name || "Not available");
    setText("profileEmail", user.email || "Not available");
    setText("profileCompany", user.company || "Not available");
    setText("profileLanguage", user.language || "Not available");
    setText("profileDomain", user.domain || "Not available");
    setText("profileLevel", user.level || "Not available");
    setText("totalInterviews", stats.totalInterviews || 0);
    setText("averageScore", `${stats.averageScore || 0}/10`);

    const historyBox = document.getElementById("historyList");
    if (historyBox) {
      if (!history.length) {
        historyBox.innerHTML = "<p>No interview attempts yet.</p>";
      } else {
        historyBox.innerHTML = history
          .map(
            (item) => `
              <div class="history-item">
                <strong>${escapeHTML(item.question)}</strong>
                <p>${escapeHTML(item.feedback)}</p>
                <span>Score: ${escapeHTML(item.score || "N/A")}/10</span>
              </div>
            `
          )
          .join("");
      }
    }
  } catch (error) {
    setText("profileName", "Error");
    setText("profileEmail", "Error");
    setText("profileCompany", "Error");
    setText("profileLanguage", "Error");
    setText("profileDomain", "Error");
    setText("profileLevel", "Error");
  }
}

function addChatMessage(text, type) {
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  const message = document.createElement("div");
  message.className = `chat-message ${type === "user" ? "user-message" : "bot-message"}`;
  message.innerText = text;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  if (!input) return;

  const message = input.value.trim();

  if (!message) {
    alert("Please write your question first");
    return;
  }

  input.value = "";
  addChatMessage(message, "user");
  addChatMessage("Thinking...", "bot");

  const chatMessages = document.getElementById("chatMessages");
  const thinkingMessage = chatMessages?.lastElementChild;

  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    if (thinkingMessage) {
      thinkingMessage.innerText = data.reply || "I am ready to help with your interview preparation.";
    }

    updateAIBadge(data.mode);
  } catch (error) {
    if (thinkingMessage) {
      thinkingMessage.innerText =
        "Chat service is offline. Start the server, then try again.";
    }
  }
}

function setupChatInput() {
  const input = document.getElementById("chatInput");
  if (!input) return;

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      sendChatMessage();
    }
  });
}

async function loadAIStatus() {
  const badge = document.getElementById("aiModeBadge");
  if (!badge) return;

  try {
    const res = await fetch(`${API_URL}/ai-status`);
    const data = await res.json();
    const isConfigured = data.mode === "configured";

    badge.innerText = isConfigured ? "AI Key Found" : "Demo AI";
    badge.className = `ai-mode-badge ${isConfigured ? "configured-ai" : "demo-ai"}`;
    badge.title = data.message || "";
  } catch (error) {
    badge.innerText = "Offline";
    badge.className = "ai-mode-badge demo-ai";
  }
}

function updateAIBadge(mode) {
  const badge = document.getElementById("aiModeBadge");
  if (!badge || !mode) return;

  const isReal = mode === "real";
  badge.innerText = isReal ? "Real AI" : "Demo AI";
  badge.className = `ai-mode-badge ${isReal ? "real-ai" : "demo-ai"}`;
}

window.onload = function () {
  if (window.location.pathname.includes("home.html")) {
    loadHomePage();
  }

  if (window.location.pathname.includes("dashboard.html")) {
    loadSavedQuestions();
  }

  if (window.location.pathname.includes("interview.html")) {
    loadQuestion();
  }

  if (window.location.pathname.includes("profile.html")) {
    loadProfileData();
    setupChatInput();
    loadAIStatus();
  }
};
