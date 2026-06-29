import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createHash } from "node:crypto";

dotenv.config({ path: "./.env", override: true });

const app = express();
const PORT = process.env.PORT || 3000;
const AI_KEY = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
const AI_PROVIDER = AI_KEY?.startsWith("gsk_") ? "groq" : "openai";
const AI_MODEL =
  process.env.AI_MODEL || (AI_PROVIDER === "groq" ? "llama-3.1-8b-instant" : "gpt-4.1");

app.use(cors());
app.use(express.json());
app.use(express.static("."));

let db;

const demoQuestions = [
  "What is a variable in programming?",
  "What is the difference between an array and an object?",
  "What is a function and why do we use it?",
  "Explain a loop with one simple example.",
  "What is the difference between let, const, and var in JavaScript?",
  "What is an API?",
  "What is a database and why is it used?",
  "What is the difference between frontend and backend development?",
  "What is debugging?",
  "Explain object-oriented programming in simple words."
];

const openai = new OpenAI({
  apiKey: AI_KEY,
  baseURL: AI_PROVIDER === "groq" ? "https://api.groq.com/openai/v1" : undefined
});

function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

async function initDB() {
  db = await open({
    filename: "./interview-data.db",
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      language TEXT NOT NULL,
      domain TEXT NOT NULL,
      level TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      feedback TEXT NOT NULL,
      score INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      domain TEXT NOT NULL,
      level TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureColumn("users", "created_at", "TEXT");
  await ensureColumn("accounts", "created_at", "TEXT");
  await ensureColumn("interviews", "score", "INTEGER");
  await ensureColumn("interviews", "created_at", "TEXT");
  await ensureColumn("questions", "created_at", "TEXT");

  console.log("Database connected");
}

async function ensureColumn(tableName, columnName, columnSql) {
  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`);
  }
}

function getRandomDemoQuestion() {
  return demoQuestions[Math.floor(Math.random() * demoQuestions.length)];
}

function extractScore(feedback) {
  const match = feedback.match(/(?:score|rating)?\s*:?\s*(\d{1,2})(?:\s*\/\s*10)?/i);
  if (!match) return null;

  const score = Number(match[1]);
  return score >= 0 && score <= 10 ? score : null;
}

function parseEvaluation(rawText) {
  try {
    const cleaned = rawText.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(cleaned);
    const score = Number(parsed.score);

    if (Number.isFinite(score) && score >= 0 && score <= 10) {
      return {
        score: Math.round(score),
        feedback: String(parsed.feedback || "").trim(),
        improvement: String(parsed.improvement || "").trim()
      };
    }
  } catch (error) {
    // Fall back to text parsing below.
  }

  const feedbackMatch = rawText.match(/feedback:\s*([\s\S]*?)(?:\n\s*[-*]?\s*improvement:|\n\s*[-*]?\s*score:|$)/i);
  const improvementMatch = rawText.match(/improvement:\s*([\s\S]*)/i);

  return {
    score: extractScore(rawText),
    feedback: (feedbackMatch?.[1] || rawText).replace(/\*\*/g, "").trim(),
    improvement: (improvementMatch?.[1] || "").replace(/\*\*/g, "").trim()
  };
}

async function askAI(prompt) {
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3
  });

  return response.choices?.[0]?.message?.content?.trim() || "";
}

async function getLatestUser() {
  return db.get(`
    SELECT *
    FROM users
    ORDER BY id DESC
    LIMIT 1
  `);
}

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "." });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/ai-status", (req, res) => {
  res.json({
    provider: AI_KEY ? AI_PROVIDER : "demo",
    model: AI_KEY ? AI_MODEL : "demo",
    mode: AI_KEY ? "configured" : "demo",
    message: AI_KEY
      ? `${AI_PROVIDER.toUpperCase()} key found. Chat will use ${AI_MODEL} when the API request succeeds.`
      : "Demo mode is active. Add OPENAI_API_KEY or GROQ_API_KEY in .env for real AI replies."
  });
});

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    if (username.trim().length < 3 || password.trim().length < 4) {
      return res.status(400).json({ error: "Username must be 3+ chars and password 4+ chars" });
    }

    const normalizedUsername = username.trim().toLowerCase();

    if (normalizedUsername === "admin") {
      return res.status(409).json({ error: "This username already exists" });
    }

    const existing = await db.get(
      `SELECT id FROM accounts WHERE lower(username) = lower(?)`,
      [username.trim()]
    );

    if (existing) {
      return res.status(409).json({ error: "This username already exists" });
    }

    await db.exec("DELETE FROM users");
    await db.exec("DELETE FROM interviews");
    await db.exec("DELETE FROM questions");
    await db.exec("DELETE FROM accounts");

    await db.run(
      `INSERT INTO accounts (username, password_hash) VALUES (?, ?)`,
      [username.trim(), hashPassword(password.trim())]
    );

    res.json({ message: "Account created successfully. Previous data has been cleared." });
  } catch (error) {
    console.error("REGISTER ERROR:", error.message);
    res.status(500).json({ error: "Failed to create account" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    if (username.trim() === "admin" && password.trim() === "1234") {
      return res.json({ message: "Login successful", username: "admin" });
    }

    const account = await db.get(
      `SELECT username, password_hash FROM accounts WHERE lower(username) = lower(?)`,
      [username.trim()]
    );

    if (!account || account.password_hash !== hashPassword(password.trim())) {
      return res.status(401).json({ error: "Wrong username or password" });
    }

    res.json({ message: "Login successful", username: account.username });
  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    res.status(500).json({ error: "Failed to login" });
  }
});

app.post("/save-user", async (req, res) => {
  try {
    const { name, email, company, language, domain, level } = req.body;

    if (!name || !email || !company || !language || !domain || !level) {
      return res.status(400).json({ error: "All profile fields are required" });
    }

    const result = await db.run(
      `INSERT INTO users (name, email, company, language, domain, level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), email.trim(), company.trim(), language.trim(), domain.trim(), level.trim()]
    );

    res.json({ message: "User data saved successfully", id: result.lastID });
  } catch (error) {
    console.error("SAVE USER ERROR:", error.message);
    res.status(500).json({ error: "Failed to save user data" });
  }
});

app.get("/get-user", async (req, res) => {
  try {
    const user = await getLatestUser();
    res.json(user || {});
  } catch (error) {
    console.error("GET USER ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

app.get("/questions", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT id, question, domain, level, created_at
      FROM questions
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("QUESTIONS ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

app.post("/questions", async (req, res) => {
  try {
    const { question, domain, level } = req.body;

    if (!question || !domain || !level) {
      return res.status(400).json({ error: "Question, domain, and level are required" });
    }

    const result = await db.run(
      `INSERT INTO questions (question, domain, level) VALUES (?, ?, ?)`,
      [question.trim(), domain.trim(), level.trim()]
    );

    res.json({
      message: "Question saved successfully",
      question: {
        id: result.lastID,
        question: question.trim(),
        domain: domain.trim(),
        level: level.trim()
      }
    });
  } catch (error) {
    console.error("SAVE QUESTION ERROR:", error.message);
    res.status(500).json({ error: "Failed to save question" });
  }
});

app.post("/roadmap", async (req, res) => {
  const { company, language, domain, level } = req.body;

  if (!company || !language || !domain || !level) {
    return res.status(400).json({ error: "Company, language, domain, and level are required" });
  }

  try {
    const roadmap = await askAI(`Create a simple 5-step interview preparation roadmap.

Company: ${company}
Programming Language: ${language}
Field: ${domain}
Level: ${level}

Keep it short, clear, and student-friendly.`);

    res.json({ roadmap });
  } catch (error) {
    const roadmap = `Step 1: Strengthen ${language} fundamentals
Step 2: Practice ${domain} concepts with small projects
Step 3: Solve common ${company} interview questions
Step 4: Prepare clear HR and communication answers
Step 5: Take mock interviews and revise weak topics`;

    res.json({ roadmap });
  }
});

app.get("/question", async (req, res) => {
  try {
    const user = await getLatestUser();
    const savedQuestions = user
      ? await db.all(
          `
          SELECT question
          FROM questions
          WHERE lower(domain) = lower(?) AND lower(level) = lower(?)
          ORDER BY random()
          LIMIT 1
        `,
          [user.domain, user.level]
        )
      : [];

    if (savedQuestions.length) {
      return res.json({ question: savedQuestions[0].question, source: "saved" });
    }

    const anySavedQuestion = await db.get(`
      SELECT question
      FROM questions
      ORDER BY random()
      LIMIT 1
    `);

    if (anySavedQuestion) {
      return res.json({ question: anySavedQuestion.question, source: "saved" });
    }

    const context = user
      ? `Ask one ${user.level} level interview question for ${user.domain} using ${user.language}.`
      : "Ask one basic programming interview question for a beginner.";

    const question = await askAI(`${context} Return only the question.`);

    res.json({ question });
  } catch (error) {
    res.json({ question: getRandomDemoQuestion() });
  }
});

app.post("/evaluate", async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: "Question and answer are required" });
    }

    const rawEvaluation = await askAI(`You are an interview evaluator.
Evaluate this answer strictly but fairly.

Return ONLY valid JSON. Do not use markdown. Do not add extra text.
Use this exact shape:
{
  "score": 0,
  "feedback": "short feedback in simple English",
  "improvement": "one specific way to improve"
}

Score rules:
0-2 = wrong or empty
3-4 = weak/basic
5-6 = average
7-8 = good
9-10 = excellent

Question: ${question}

Answer: ${answer}
`);

    const evaluation = parseEvaluation(rawEvaluation);
    const score = evaluation.score;
    const feedback = `Real AI Score: ${score ?? "N/A"}/10
Feedback: ${evaluation.feedback || rawEvaluation}
Improve: ${evaluation.improvement || "Add clearer examples and structure."}`;

    await db.run(
      `INSERT INTO interviews (question, answer, feedback, score) VALUES (?, ?, ?, ?)`,
      [question, answer, feedback, score]
    );

    res.json({ feedback, score, mode: "real" });
  } catch (error) {
    const feedback =
      "Demo Score: 6/10\nFeedback: Good attempt. Try to explain your answer in a clearer and more structured way.\nImprove: Add one example and use simple steps.";
    const score = 6;

    await db.run(
      `INSERT INTO interviews (question, answer, feedback, score) VALUES (?, ?, ?, ?)`,
      [req.body.question || "Demo question", req.body.answer || "No answer", feedback, score]
    );

    res.json({ feedback, score, mode: "demo" });
  }
});

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const user = await getLatestUser();
    const profileText = user
      ? `Student profile: ${user.name}, preparing for ${user.company}, ${user.domain}, ${user.language}, ${user.level} level.`
      : "No profile saved yet.";

    const reply = await askAI(`${profileText}

User question: ${message}

Reply like a helpful interview preparation coach. Keep it short, simple, and practical.`);

    res.json({ reply, mode: "real", provider: AI_PROVIDER, model: AI_MODEL });
  } catch (error) {
    res.json({
      mode: "demo",
      reply:
        "Demo mode: I can help you prepare. Add a valid OpenAI API key in .env for real AI replies."
    });
  }
});

app.get("/interviews", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT id, question, answer, feedback, score, created_at
      FROM interviews
      ORDER BY id DESC
      LIMIT 5
    `);

    res.json(rows);
  } catch (error) {
    console.error("INTERVIEWS ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch interview history" });
  }
});

app.get("/stats", async (req, res) => {
  try {
    const stats = await db.get(`
      SELECT
        COUNT(*) AS totalInterviews,
        ROUND(AVG(score), 1) AS averageScore
      FROM interviews
      WHERE score IS NOT NULL
    `);

    res.json({
      totalInterviews: stats?.totalInterviews || 0,
      averageScore: stats?.averageScore || 0
    });
  } catch (error) {
    console.error("STATS ERROR:", error.message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
