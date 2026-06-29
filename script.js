const API_URL = window.location.origin;

function login() {
  let user = document.getElementById("username").value;
  let pass = document.getElementById("password").value;

  if (user === "admin" && pass === "1234") {
    window.location.href = "dashboard.html";
  } else {
    alert("Wrong username or password");
  }
}

function startPrep() {
  window.location.href = "interview.html";
}

function goToProfile() {
  window.location.href = "profile.html";
}

function goBack() {
  window.location.href = "dashboard.html";
}

function logout() {
  window.location.href = "login.html";
}

async function createRoadmap() {
  let company = document.getElementById("company").value;
  let language = document.getElementById("language").value;
  let domain = document.getElementById("domain").value;
  let level = document.getElementById("level").value;

  if (company === "" || language === "" || domain === "" || level === "") {
    alert("Please fill all details first");
    return;
  }

  // 👉 Save user data to database
  try {
    await fetch(`${API_URL}/save-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Himanshu",
        email: "himanshu@email.com",
        company,
        language,
        domain,
        level
      })
    });
  } catch (error) {
    console.log("User save failed");
  }


  app.get("/get-user", async (req, res) => {
  try {
    const user = await db.get(`
      SELECT * FROM users
      ORDER BY id DESC
      LIMIT 1
    `);

    res.json(user || {});
  } catch (error) {
    console.error("GET USER ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

  // 👉 Generate roadmap (local fallback always works)
  let roadmap = `
Step 1: Learn and strengthen ${language} fundamentals
Step 2: Build concepts in ${domain}
Step 3: Practice interview questions for ${company}
Step 4: Improve communication and HR interview responses
Step 5: Attempt mock interviews and revise weak topics
  `;

  document.getElementById("roadmapOutput").innerText = roadmap;
}

 
let questions = [];
let currentIndex = -1;

async function loadQuestion() {
  try {
    let res = await fetch(`${API_URL}/question`);
    let data = await res.json();

    let questionText;

    if (!data.question) {
      let demoQuestions = [
        "What is a variable in programming?",
        "Explain difference between array and object.",
        "What is a function?",
        "What is a loop?"
      ];

      questionText =
        demoQuestions[Math.floor(Math.random() * demoQuestions.length)];
    } else {
      questionText = data.question;
    }

    questions.push(questionText);
    currentIndex++;
    document.getElementById("question").innerText = questionText;
  } catch (error) {
    let demoQuestions = [
      "What is a variable in programming?",
      "Explain difference between array and object.",
      "What is a function?",
      "What is a loop?"
    ];

    let questionText =
      demoQuestions[Math.floor(Math.random() * demoQuestions.length)];

    questions.push(questionText);
    currentIndex++;
    document.getElementById("question").innerText = questionText;
  }
}

async function submitAnswer() {
  let answer = document.getElementById("answer").value;

  if (answer === "") {
    alert("Write something first");
    return;
  }

  try {
    let res = await fetch(`${API_URL}/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: questions[currentIndex],
        answer: answer
      })
    });

    let data = await res.json();

    document.getElementById("feedback").innerText =
      data.feedback ||
      "Answer submitted. Feedback service is currently unavailable.";
  } catch (error) {
    document.getElementById("feedback").innerText =
      "Demo Feedback: Good attempt. Try to explain in a more clear and structured way.";
  }
}

function nextQuestion() {
  loadQuestion();
  document.getElementById("answer").value = "";
  document.getElementById("feedback").innerText =
    "Feedback will appear here after submission.";
}

function previousQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    document.getElementById("question").innerText = questions[currentIndex];
    document.getElementById("answer").value = "";
    document.getElementById("feedback").innerText =
      "Feedback will appear here after submission.";
  } else {
    document.getElementById("feedback").innerText =
      "No previous question available.";
  }
}



async function loadProfileData() {
  try {
    let res = await fetch(`${API_URL}/get-user`);
    let data = await res.json();

    document.getElementById("profileName").innerText = data.name || "Not available";
    document.getElementById("profileEmail").innerText = data.email || "Not available";
    document.getElementById("profileCompany").innerText = data.company || "Not available";
    document.getElementById("profileLanguage").innerText = data.language || "Not available";
    document.getElementById("profileDomain").innerText = data.domain || "Not available";
    document.getElementById("profileLevel").innerText = data.level || "Not available";
  } catch (error) {
    document.getElementById("profileName").innerText = "Error";
    document.getElementById("profileEmail").innerText = "Error";
    document.getElementById("profileCompany").innerText = "Error";
    document.getElementById("profileLanguage").innerText = "Error";
    document.getElementById("profileDomain").innerText = "Error";
    document.getElementById("profileLevel").innerText = "Error";
  }
}

window.onload = function () {
  if (window.location.pathname.includes("interview.html")) {
    loadQuestion();
  }

  if (window.location.pathname.includes("profile.html")) {
    loadProfileData();
  }
};
