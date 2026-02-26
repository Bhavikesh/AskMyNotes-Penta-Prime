# 📚 AskMyNotes — Penta Prime

An AI-powered study assistant that lets you upload your notes and interact with them through intelligent Q&A, voice-based teaching, study mode quizzes, and performance analytics.

Built with **FastAPI** + **React** | Powered by **Groq LLaMA 3.3**, **FAISS**, and **Supabase**

---

## ✨ Features

| Feature | Description |
|---|---|
| **Document Upload** | Upload PDF, DOCX, and HTML notes organized by subject |
| **Smart Q&A** | Ask questions and get AI-generated answers grounded in your notes (RAG) |
| **Voice Teacher** | Speak your questions and hear answers read back to you |
| **Study Mode** | Auto-generate MCQ and short-answer questions from your notes |
| **Analytics** | Track your performance across subjects and question types |
| **Subject Management** | Organize documents into up to 3 subjects per user |

---

## 🏗️ Tech Stack

### Backend
- **FastAPI** — High-performance async API framework
- **Groq (LLaMA 3.3 70B)** — LLM for answer generation & question creation
- **Sentence Transformers (all-mpnet-base-v2)** — Document embeddings
- **FAISS** — Vector similarity search
- **Supabase** — Database & storage (PostgreSQL)
- **PyMuPDF / python-docx** — Document parsing

### Frontend
- **React 19** — UI framework
- **Vite** — Build tool
- **Tailwind CSS** — Styling
- **TanStack React Query** — Server state management
- **Axios** — HTTP client
- **Lucide React** — Icons

---

## 📁 Project Structure

```
├── app/
│   ├── main.py                 # FastAPI app entrypoint
│   ├── config.py               # Settings & environment config
│   ├── models/                 # Pydantic request/response models
│   ├── routers/                # API route handlers
│   │   ├── upload.py           # Document upload endpoints
│   │   ├── subjects.py         # Subject CRUD
│   │   ├── askmynotes.py       # RAG Q&A endpoint
│   │   ├── study_mode.py       # Quiz generation & evaluation
│   │   ├── analytics.py        # Performance analytics
│   │   ├── voice.py            # Voice teacher (STT + TTS)
│   │   └── documents.py        # Document management
│   └── services/               # Business logic layer
│       ├── rag_service.py      # Retrieval-Augmented Generation
│       ├── embedding_service.py
│       ├── vector_store.py     # FAISS vector store
│       ├── study_mode_service.py
│       ├── analytics_service.py
│       ├── speech_to_text.py
│       ├── text_to_speech.py
│       └── supabase_service.py
├── frontend/
│   └── src/
│       ├── components/         # React UI components
│       ├── api/                # Axios client & endpoint definitions
│       ├── hooks/              # Custom React hooks
│       └── utils/              # Helpers & formatters
├── scripts/                    # SQL migration scripts
├── Dockerfile
├── railway.toml                # Railway deployment config
└── requirements.txt
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- A **Groq** API key → [console.groq.com](https://console.groq.com)
- A **Supabase** project → [supabase.com](https://supabase.com)

### 1. Clone the Repository

```bash
git clone https://github.com/Bhavikesh/AskMyNotes-Penta-Prime.git
cd AskMyNotes-Penta-Prime
```

### 2. Backend Setup

```bash
# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:

```env
BEARER_TOKEN=your-bearer-token
GROQ_API_KEY=your-groq-api-key
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
```

### 4. Set Up the Database

Run the SQL scripts in your Supabase SQL editor:

```
scripts/supabase_schema.sql
scripts/voice_migration.sql
```

### 5. Start the Backend

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at **http://localhost:8000** and docs at **http://localhost:8000/docs**

### 6. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at **http://localhost:5173**

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload/` | Upload a document to a subject |
| `GET` | `/upload/allowed-types` | Get supported file types |
| `POST` | `/subjects/` | Create a new subject |
| `GET` | `/subjects/` | List all subjects for a user |
| `DELETE` | `/subjects/{id}` | Delete a subject |
| `POST` | `/askmynotes/query` | Ask a question about your notes |
| `POST` | `/study-mode/` | Generate study questions |
| `POST` | `/study-mode/evaluate` | Evaluate short-answer responses |
| `GET` | `/analytics/performance` | Get performance analytics |
| `POST` | `/voice/query` | Voice-based Q&A (audio input) |
| `POST` | `/voice/query-text` | Voice-based Q&A (text input) |
| `POST` | `/voice/session/new` | Start a new voice session |
| `GET` | `/voice/session/{id}/history` | Get voice session history |
| `GET` | `/health` | Health check |

Full interactive docs available at `/docs` (Swagger UI).

---

## 🐳 Docker

```bash
docker build -t askmynotes .
docker run -p 8000:8000 --env-file .env askmynotes
```

---

## 🚄 Deploy on Railway

This project includes a `railway.toml` for one-click deployment on [Railway](https://railway.app):

1. Push your code to GitHub
2. Connect the repo on Railway
3. Add your environment variables in the Railway dashboard
4. Deploy!

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

---

## 👥 Team — Penta Prime

Built with ❤️ for HackRX
