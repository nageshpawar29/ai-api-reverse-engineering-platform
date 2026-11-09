# AI API Reverse-Engineering Platform
> **Turn any undocumented backend into a fully documented, testable API in minutes — not hours.**

An enterprise-grade developer tool that ingests backend source code (via ZIP upload or GitHub repository URL), performs **100% deterministic Abstract Syntax Tree (AST) static analysis**, enriches the discovery with **AI reasoning**, and generates interactive Swagger specs, Postman collections, CI/CD pipeline flows, database ER diagrams, static security audits, and Jest test suites in one unified dashboard.

---

## 🌟 Key Features

| Feature | Description | Engine |
| :--- | :--- | :--- |
| **AST Route Discovery** | Discovers HTTP methods, route paths, mount prefixes, middleware chains, and handler controllers. | `@babel/parser` + `@babel/traverse` |
| **Controller Analysis** | Automatically infers request bodies, query parameters, path variables (`:id`), and observed HTTP status codes (`200`, `201`, `400`, `401`, `404`, `500`). | Static AST inspection |
| **OpenAPI 3.0 / Swagger** | Generates standards-compliant OpenAPI 3.0.3 JSON & YAML specifications. Includes an embedded, interactive **Swagger UI**. | Spec Generator |
| **Postman Collection** | Generates exportable Postman Collection v2.1.0 JSON with environments, path variables, and sample payloads. | Spec Generator |
| **CI/CD Pipeline Flow** | Interactive visual flow connecting `Route → Controller → Service → Model → Database`. | `@xyflow/react` (React Flow) |
| **Database ER Diagrams** | Parses Prisma schemas, Sequelize models, and Mongoose schemas into interactive Mermaid ER diagrams. | `mermaid.js` + AST Parser |
| **Static Security Audit** | Flags missing authentication on state-modifying routes, missing validation schemas, hardcoded secrets, SQL injection patterns, and dynamic `eval()` calls. | Static Security Scanner |
| **Jest Test Generation** | Synthesizes runnable Jest + Supertest test suites covering happy paths, auth gates, and boundary validations. | Code Synthesizer |
| **Interactive API Playground** | Built-in request console with custom headers, query params, auth tokens, and **SSRF Protection**. | Sandboxed Proxy |
| **AI Codebase Assistant** | Conversational Q&A grounded in the AST knowledge model with exact file citations and line numbers. | LLM Provider (Gemini / Claude / OpenAI / Offline Heuristic) |

---

## 🏗️ Architecture & Pipeline Flow

```
                      [ User Source Code ]
                       (ZIP / GitHub Repo)
                                │
                                ▼
                   ┌─────────────────────────┐
                   │  Ingestion & Extraction │
                   │  (Safe Zip Slip Defense)│
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │   Framework Detection   │
                   │ (package.json & imports)│
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │  AST Static Analysis    │
                   │ (Routes, Handlers, ORM) │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │   AI Reasoning Layer    │
                   │ (Purpose, Context, Edge)│
                   └────────────┬────────────┘
                                │
                                ▼
            ┌─────────────────────────────────────────┐
            │   Unified Intermediate Representation   │
            │   (DETECTED vs. INFERRED vs. UNKNOWN)   │
            └────────────┬────────────────────────────┘
                         │
      ┌──────────────────┼──────────────────┬──────────────────┐
      ▼                  ▼                  ▼                  ▼
[OpenAPI / Swagger] [Postman v2.1] [Dependency Graph] [Security & Tests]
```

### The Credibility Standard: DETECTED vs. INFERRED
To ensure developer trust, the platform explicitly classifies all metadata:
- **`DETECTED`**: 100% deterministic facts extracted directly from the Abstract Syntax Tree (AST line numbers, handler names, destructuring patterns, schema relations).
- **`INFERRED`**: Contextual explanations and edge cases synthesized by the AI reasoning layer.
- **`UNKNOWN`**: Explicitly marked when confidence cannot be verified statically.

---

## 🔒 Security Sandbox Principles
1. **Untrusted Code Execution Guarantee**:
   Uploaded codebases are **NEVER executed**. The platform never runs `npm install`, `npm start`, or arbitrary shell scripts. All route discovery is achieved purely via static lexical and syntactic AST analysis.
2. **Zip Slip Prevention**:
   ZIP extraction normalizes paths and enforces strict boundary containment to prevent directory traversal attacks (`../`).
3. **SSRF Guardrails**:
   The interactive API testing console blocks requests targeting internal cloud metadata IP ranges (`169.254.169.254`, `metadata.google.internal`).

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **PostgreSQL** *(Optional)*: If PostgreSQL is not installed locally, the platform automatically runs on a persistent local store without requiring any external database setup!

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone <repo-url>
cd "Reverse API Engineering"

# Install all dependencies (Server + Client)
npm install --workspace=server
npm install --workspace=client
```

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```
Key configuration values in `.env`:
```env
PORT=5001
FRONTEND_URL=http://localhost:5173

# Optional: Add Gemini / OpenAI key for LLM reasoning (platform works 100% offline if blank)
GEMINI_API_KEY=
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reverse_api_platform
```

### 3. Run the Platform
You can start both the backend server and frontend client with a single command:
```bash
npm run dev
```

Or run them individually:
```bash
# Terminal 1: Backend Server (Port 5001)
npm run dev --workspace=server

# Terminal 2: Frontend Client (Port 5173)
npm run dev --workspace=client
```

Open your browser at **`http://localhost:5173`**.

---

## 🧪 Testing with the Built-in Demo Backend

The platform includes a complete, realistic multi-tiered Express API under `/examples/demo-api`:
- **Auth Routes**: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`
- **Product Routes**: `/api/v1/products/`, `/api/v1/products/:id` (Full CRUD)
- **User Routes**: `/api/v1/users/`, `/api/v1/users/:id`
- **Middleware**: JWT authentication (`requireAuth`), input validators
- **Prisma Schema**: `User`, `Product`, `Order`, `OrderItem`

### To run the demo:
1. Navigate to **`http://localhost:5173/projects/new`**.
2. Click the **"Instant Demo Backend"** tab.
3. Click **"Run Instant Analysis on Demo Backend"**.
4. Watch the real-time pipeline detect Express, parse the AST, generate Swagger, Postman, ER diagrams, and open the complete intelligence dashboard!

---

## 📂 Project Structure

```
/
├── client/                     # Frontend Application (React, Vite, TypeScript, Tailwind)
│   ├── src/
│   │   ├── api/               # Axios API client
│   │   ├── components/        # Navbar, Sidebar, ProjectLayout
│   │   ├── pages/             # Dashboard, Endpoints, Swagger, Postman, Graph, DB, Security, Tests, Playground, Chat
│   │   ├── types/             # Domain TypeScript interfaces
│   │   └── App.tsx            # React Router v7 configuration
│   └── package.json
│
├── server/                     # Backend Engine (Node.js, Express, AST Parsers, TypeScript)
│   ├── src/
│   │   ├── ai/                # LLMProvider abstraction (Gemini / Claude / Heuristic)
│   │   ├── analyzers/         # AST static analysis engines
│   │   │   ├── express/       # Express route & controller AST extractors
│   │   │   ├── database/      # Prisma, Sequelize, Mongoose schema extractors
│   │   │   └── security/      # Static security scanner
│   │   ├── db/                # PostgreSQL schema migrations & dual-mode store
│   │   ├── generators/        # OpenAPI 3.0, Postman 2.1, and Jest test generators
│   │   ├── routes/            # REST API endpoints (analysis, projects, artifacts, chat)
│   │   └── services/          # Safe ZIP ingestion & pipeline orchestrator
│   └── package.json
│
├── examples/
│   └── demo-api/              # Sample Express + Prisma + Auth backend for verification
│
├── package.json               # Root monorepo orchestration
├── .env.example               # Environment variables template
└── README.md                  # Project documentation
```

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React, `@xyflow/react` (React Flow), `swagger-ui-react`, `mermaid.js`, React Router.
- **Backend**: Node.js, Express, TypeScript, `@babel/parser`, `@babel/traverse`, `adm-zip`, `pg` (PostgreSQL client), `yaml`, `axios`.
- **AI / LLM**: Pluggable provider architecture with support for Google Gemini, OpenAI, Claude, and local offline heuristic reasoning.
