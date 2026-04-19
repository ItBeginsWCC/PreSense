import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'MOCK_KEY',
});

// Mock AI Fallback for testing without an API key
const getMockResponse = (type: 'question' | 'summary', incident?: Incident) => {
  if (type === 'question') {
    const mockQuestions = [
      "Is the patient currently conscious and breathing?",
      "Are they experiencing any chest pain or severe pressure?",
      "Is there any visible bleeding or obvious injury?",
      "Do they have a history of heart conditions or diabetes?",
      "Are they currently taking any prescription medications?"
    ];
    // Return a question based on history length to simulate progress
    const index = Math.min((incident?.questions.length || 0) / 2, mockQuestions.length - 1);
    return mockQuestions[Math.floor(index)] + " (Mock AI)";
  } else {
    return JSON.stringify({
      priority: "URGENT",
      report: "- Mock Report: Assessment in progress\n- Patient is currently stable\n- Monitoring for updates"
    });
  }
};

// In-memory store for demo
interface Incident {
  id: string;
  dispatchNote: string;
  status: 'active' | 'resolved';
  questions: { role: 'ai' | 'user'; text: string }[];
  summary: {
    priority: 'CRITICAL' | 'URGENT' | 'STABLE' | 'UNKNOWN';
    report: string;
  };
}

const incidents: Record<string, Incident> = {};

app.post('/api/incidents', (req, res) => {
  const { dispatchNote } = req.body;
  const id = Math.random().toString(36).substring(2, 9);
  
  const newIncident: Incident = {
    id,
    dispatchNote,
    status: 'active',
    questions: [],
    summary: {
      priority: 'UNKNOWN',
      report: 'Awaiting caller assessment...'
    }
  };
  
  incidents[id] = newIncident;
  res.status(201).json(newIncident);
});

app.get('/api/incidents/:id', (req, res) => {
  const incident = incidents[req.params.id];
  if (incident) {
    res.json(incident);
  } else {
    res.status(404).json({ error: 'Incident not found' });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-incident', (id: string) => {
    socket.join(id);
    console.log(`Socket ${socket.id} joined incident ${id}`);
  });

  socket.on('submit-answer', async ({ id, answer }: { id: string; answer: string }) => {
    const incident = incidents[id];
    if (!incident) return;

    // Add user answer to history
    incident.questions.push({ role: 'user', text: answer });

    const hasApiKey = process.env.GEMINI_API_KEY && 
                      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' &&
                      process.env.GEMINI_API_KEY.length > 10;
    console.log('Using real AI:', !!hasApiKey)

    // 1. Generate NEXT question
    try {
      let nextQuestion = "";
      if (hasApiKey) {
        const history = incident.questions.map(q => `${q.role === 'ai' ? 'AI' : 'User'}: ${q.text}`).join('\n');
        const questionPrompt = `
           
          Initial dispatch note: "${incident.dispatchNote}"
          History of assessment so far:
          ${history}
          
          You are an EMT pre-arrival questionnaire assistant. Your role is to gather patient information for emergency responders.

          CRITICAL RULES:
          - Do NOT provide diagnosis, interpretation, or advice.
          - Ask ONLY one question at a time.
          - Do NOT include introductions, acknowledgments, or transition phrases.
          - Start immediately with the first question.
          - Use short, clear, direct questions suitable for emergencies.
          - Automatically respond in the same language as the patient.
          - Internally record all responses in English.

          ASSESSMENT FLOW:

          1. Chief Complaint
          Ask: "What is going on today?"

          2. SAMPLE History

          S - Signs & Symptoms
          Ask about current symptoms.

          A - Allergies
          Ask: "Do you have any allergies?"

          M - Medications
          Ask: "Are you taking any medications?"
          If patient reports a condition:
          - Ask if they have medication for it
          - Ask if they have taken it
          - Ask when they last took it
          - Ask the name of the medication

          P - Past Medical History
          Ask: "Do you have any medical conditions?"
          If yes, trigger medication follow-up above.

          L - Last Oral Intake
          Ask: "When did you last eat or drink?"

          E - Events Leading Up
          Ask: "What happened before this started?"

          3. OPQRST (ONLY if pain or trauma is mentioned)

          O - "When did it start?"
          P - "What makes it better or worse?"
          Q - "What does it feel like?"
          R - "Does the pain move anywhere?"
          S - "Rate the pain from 0 to 10."
          T - "Has it changed over time?"

          4. Closing
          Ask: "Are you feeling anything else or any other discomfort?"

          If yes:
          - Ask follow-up questions one at a time for each issue.

          FINAL RULE:
          Always end with an open-ended question allowing the patient to report new symptoms.

        `;
        const result = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: questionPrompt,
});

nextQuestion = result.text || "";
      } else {
        nextQuestion = getMockResponse('question', incident);
      }
      
      nextQuestion = nextQuestion.replace(/^AI:\s*/i, '').trim();

      incident.questions.push({ role: 'ai', text: nextQuestion });
      io.to(id).emit('next-question', nextQuestion);
    } catch (error) {
      console.error('Error generating next question:', error);
      const fallback = getMockResponse('question', incident);
      incident.questions.push({ role: 'ai', text: fallback });
      io.to(id).emit('next-question', fallback);
    }

    // 2. Generate UPDATED Summary
    try {
      let summaryText = "";
      if (hasApiKey) {
        const history = incident.questions.map(q => `${q.role === 'ai' ? 'AI' : 'User'}: ${q.text}`).join('\n');
        const summaryPrompt = `
          As a medical dispatcher, analyze this emergency transcript:
          Initial Dispatch: "${incident.dispatchNote}"
          Transcript:
          ${history}

          Provide a JSON object with:
          1. "priority": One of "CRITICAL", "URGENT", "STABLE"
          2. "report": A 2-3 bullet point summary for the EMTs en route.
          
          
        `;
        const summaryResult = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: summaryPrompt,
    });

    summaryText = (summaryResult.text || "").replace(/```json|```/g, '').trim();
  } else {
    summaryText = getMockResponse('summary');
  }

      const parsedSummary = JSON.parse(summaryText);
      if (Array.isArray(parsedSummary.report)) {
        parsedSummary.report = parsedSummary.report.join('\n');
      }
      
      incident.summary = parsedSummary;
      io.to(id).emit('summary-update', incident.summary);
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
