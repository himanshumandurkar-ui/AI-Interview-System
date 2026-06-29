import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

dotenv.config({ path: "./.env", override: true });

const app = express();
app.use(cors());
app.use(express.json());

let db;

async function initDB() {
  db = await open({
    filename: "./database.db",
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      company TEXT,
      language TEXT,
      domain TEXT,
      level TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT,
      answer TEXT,
      feedback TEXT
    );
  `);

  console.log("Database connected");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("Server is working");
});

app.get("/question", async (req, res) => {
  try {
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: "Ask one basic programming interview question for a beginner."
    });

    res.json({
      question: response.output_text
    });

  } catch (error) {
    console.log("AI FAILED → Using demo questions");

    const demoQuestions = [
      "What is a variable in programming?",
      "Explain difference between array and object.",
      "What is a function?",
      "What is a loop?"
    ];

    const question =
      demoQuestions[Math.floor(Math.random() * demoQuestions.length)];

    res.json({ question });
  }
});
app.post("/evaluate", async (req, res) => {
  try {
    const { question, answer } = req.body;

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: `Question: ${question}

Answer: ${answer}

Give short feedback in simple English and a score out of 10.`
    });

    const feedback = response.output_text;

    await db.run(
      `INSERT INTO interviews (question, answer, feedback) VALUES (?, ?, ?)`,
      [question, answer, feedback]
    );

    res.json({ feedback });
  } catch (error) {
    console.error("EVALUATE ERROR:", error.message);

    const feedback =
      "Demo Feedback: Good attempt. Try to explain your answer in a clearer and more structured way.";

    await db.run(
      `INSERT INTO interviews (question, answer, feedback) VALUES (?, ?, ?)`,
      [req.body.question, req.body.answer, feedback]
    );

    res.json({ feedback });
  }
});

app.post("/roadmap", async (req, res) => {
  try {
    const { company, language, domain, level } = req.body;

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: `Create a simple 5-step interview preparation roadmap.

Company: ${company}
Programming Language: ${language}
Field: ${domain}
Level: ${level}

Keep it short, clear, and student-friendly.`
    });

    res.json({
      roadmap: response.output_text
    });

  } catch (error) {
    console.log("AI ROADMAP FAILED → Using basic roadmap");

    const roadmap = `Step 1: Learn and strengthen ${language} fundamentals
Step 2: Build concepts in ${domain}
Step 3: Practice interview questions for ${company}
Step 4: Improve communication and HR interview responses
Step 5: Attempt mock interviews and revise weak topics`;

    res.json({ roadmap });
  }
});
 ;

    const roadmap = `Step 1: Learn and strengthen ${language} fundamentals
Step 2: Build concepts in ${domain}
Step 3: Practice interview questions for ${company}
Step 4: Improve communication and HR interview responses
Step 5: Attempt mock interviews and revise weak topics`;

  

app.post("/save-user", async (req, res) => {
  try {
    const { name, email, company, language, domain, level } = req.body;

    await db.run(
      `INSERT INTO users (name, email, company, language, domain, level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, company, language, domain, level]
    );

    res.json({ message: "User data saved successfully" });
  } catch (error) {
    console.error("SAVE USER ERROR:", error.message);
    res.status(500).json({ error: "Failed to save user data" });
  }
});

initDB().then(() => {
  app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
  });
});

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