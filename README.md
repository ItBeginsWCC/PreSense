# PreSense: Emergency Support Module

PreSense is an AI-powered emergency assessment tool designed to bridge the gap between a 911 call and EMT arrival. It uses Gemini AI to perform real-time triage and patient assessment.

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ItBeginsWCC/PreSense.git
   cd PreSense
   ```

2. **Setup the Backend:**
   ```bash
   cd backend
   npm install
   ```

3. **Setup the Frontend:**
   ```bash
   cd ../frontend
   npm install
   ```

### Configuration

1. Create a `.env` file in the `backend` directory:
   ```bash
   touch backend/.env
   ```
2. Add your Gemini API key to `backend/.env`:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   PORT=3001
   ```
   *(If you don't have a key yet, the app will automatically run in **Mock AI Mode** for testing).*

### Running the Application

You will need two terminal windows open:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

### Accessing the App

- **Frontend URL:** `http://localhost:5173`
- **Dispatch Simulator:** `http://localhost:5173/dispatch`
- **Caller UI:** Generated dynamically by Dispatch.
- **EMT Dashboard:** Generated dynamically by Dispatch.

## 🛠 Tech Stack

- **Frontend:** React, TypeScript, Vite, Socket.io-client.
- **Backend:** Node.js, Express, Socket.io, Google Generative AI SDK.
- **AI:** Google Gemma 3 4B (Instruction Tuned).

## 🛡 Security Note
The `.env` file is included in `.gitignore` to prevent sensitive API keys from being leaked to GitHub. Always keep your keys private.
