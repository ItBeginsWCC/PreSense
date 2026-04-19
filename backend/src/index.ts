import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Configure for Google AI Studio (Generative AI)
// Using gemini-2.5-flash based on user's quota
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MOCK_KEY');

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

    incident.questions.push({ role: 'user', text: answer });

    const hasApiKey = process.env.GEMINI_API_KEY && 
                      process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' &&
                      process.env.GEMINI_API_KEY.length > 10;
    console.log('Using real AI:', !!hasApiKey)

    // 1. Generate NEXT question
    try {
      let nextQuestion = "";
      if (hasApiKey) {
        // Primary: 2.5 Flash
        const modelName = "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName });
        const history = incident.questions.map(q => `${q.role === 'ai' ? 'AI' : 'User'}: ${q.text}`).join('\n');
        
        const questionPrompt = `
          You are an EMT pre-arrival questionnaire assistant. Your role is to gather patient information for emergency responders.

          CONTEXT:
          Initial dispatch note (the user's first input): "${incident.dispatchNote}"
          Assessment history so far:
          ${history}

          CRITICAL RULES:
          1. ANALYZE the initial dispatch note. If it already contains the "Chief Complaint" (e.g., "My chest hurts"), do NOT ask "What is going on today?". Instead, acknowledge it briefly and move to the next logical question.
          2. Ask ONLY one question at a time.
          3. Do NOT provide diagnosis, interpretation, or advice.
          4. Do NOT include introductions, acknowledgments, or transition phrases.
          5. Use short, clear, direct questions.
          6. Automatically respond in the same language as the patient.

          ASSESSMENT FLOW (Skip steps if already answered in dispatch or history):
          1. Chief Complaint (If not in dispatch note)
          2. Signs & Symptoms
          3. Allergies
          4. Medications
          5. Past Medical History
          6. Last Oral Intake
          7. Events Leading Up
          8. OPQRST (If pain/trauma mentioned)

          GOAL:
          Generate the single best next question to help the EMTs.
        `;

        const result = await model.generateContent(questionPrompt);
        nextQuestion = result.response.text();
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
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const history = incident.questions.map(q => `${q.role === 'ai' ? 'AI' : 'User'}: ${q.text}`).join('\n');
        const summaryPrompt = `
          As a medical dispatcher, analyze this emergency transcript:
          Initial Dispatch: "${incident.dispatchNote}"
          Transcript:
          ${history}

          Provide a JSON object with:
          1. "priority": One of "CRITICAL", "URGENT", "STABLE"
          2. "report": A 2-3 bullet point summary for the EMTs en route.
          
          Return ONLY the JSON.
        `;
        const result = await model.generateContent(summaryPrompt);
        summaryText = result.response.text().replace(/```json|```/g, '').trim();
        console.log('Generated Summary Text:', summaryText);
      } else {
        summaryText = getMockResponse('summary');
      }

      const parsedSummary = JSON.parse(summaryText);
      console.log('Parsed Summary:', parsedSummary);
      
      // Ensure report is a string for the frontend (split('\n') support)
      if (Array.isArray(parsedSummary.report)) {
        parsedSummary.report = parsedSummary.report.join('\n');
      } else if (typeof parsedSummary.report !== 'string') {
        parsedSummary.report = String(parsedSummary.report || '');
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
