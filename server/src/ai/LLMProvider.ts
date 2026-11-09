import axios from 'axios';
import { ApiEndpoint, ProjectAnalysis, ChatMessage } from '../types/index.js';

export interface LLMResponse {
  answer: string;
  citations: Array<{ file: string; line?: number; description?: string }>;
}

export interface LLMProvider {
  readonly providerName: string;
  enrichEndpoints(
    endpoints: ApiEndpoint[],
    context: { projectName: string; framework: string }
  ): Promise<ApiEndpoint[]>;
  answerCodebaseQuestion(question: string, knowledge: ProjectAnalysis): Promise<LLMResponse>;
}

/**
 * Heuristic/Rule-Based AI Reasoning Engine (Zero-Config, 100% Offline Resilience)
 */
export class HeuristicLLMProvider implements LLMProvider {
  public readonly providerName = 'Heuristic Local AI Engine';

  public async enrichEndpoints(
    endpoints: ApiEndpoint[],
    context: { projectName: string; framework: string }
  ): Promise<ApiEndpoint[]> {
    return endpoints.map((ep) => {
      const pathParts = ep.path.split('/').filter(Boolean);
      const resource = pathParts[pathParts.length - 1] || 'resource';
      const cleanResource = resource.replace(/^:/, '');

      let purpose = ep.purpose;
      if (!purpose) {
        if (ep.method === 'GET' && ep.path.includes(':')) {
          purpose = `Retrieves specific ${cleanResource} record by its unique identifier. Returns 404 Not Found if resource does not exist.`;
        } else if (ep.method === 'GET') {
          purpose = `Fetches paginated collection of ${cleanResource} items, supporting optional filtering and limit constraints.`;
        } else if (ep.method === 'POST' && (ep.path.includes('login') || ep.path.includes('auth'))) {
          purpose = `Authenticates user credentials and issues a signed JSON Web Token (JWT) session.`;
        } else if (ep.method === 'POST' && ep.path.includes('register')) {
          purpose = `Registers a new user account, hashes credentials, and persists record to the database.`;
        } else if (ep.method === 'POST') {
          purpose = `Creates a new ${cleanResource} entity in the system with validation checks on mandatory payload fields.`;
        } else if (ep.method === 'PUT' || ep.method === 'PATCH') {
          purpose = `Updates existing ${cleanResource} attributes. Replaces or merges state updates based on provided fields.`;
        } else if (ep.method === 'DELETE') {
          purpose = `Deletes or archives the specified ${cleanResource} record permanently from the repository.`;
        } else {
          purpose = `Processes ${ep.method} request against ${ep.path}.`;
        }
      }

      // Add parameter descriptions if missing
      const enrichedParams = ep.parameters.map((p) => {
        let desc = p.description;
        if (!desc) {
          if (p.paramIn === 'path') desc = `Unique path parameter identifier for ${p.name}`;
          else if (p.paramIn === 'query') desc = `Query filter or pagination flag: ${p.name}`;
          else if (p.paramIn === 'body') desc = `Payload attribute for ${p.name}`;
        }
        return { ...p, description: desc };
      });

      return {
        ...ep,
        purpose,
        parameters: enrichedParams,
        summary: ep.summary || `${ep.method} ${ep.path}`,
        detectionType: ep.detectionType, // Preserves DETECTED for AST data
      };
    });
  }

  public async answerCodebaseQuestion(
    question: string,
    knowledge: ProjectAnalysis
  ): Promise<LLMResponse> {
    const q = question.toLowerCase();
    const citations: Array<{ file: string; line?: number; description?: string }> = [];
    let answer = '';

    // Q1: Specific route inquiry (e.g. "What does POST /users do?")
    const methodMatch = q.match(/\b(get|post|put|patch|delete)\b/);
    if (methodMatch) {
      const askedMethod = methodMatch[1].toUpperCase();
      const matchedEndpoint = knowledge.endpoints.find(
        (e) => e.method === askedMethod && (q.includes(e.path.toLowerCase()) || q.includes(e.path.split('/').pop() || ''))
      );

      if (matchedEndpoint) {
        const paramsList = matchedEndpoint.parameters.map((p) => `\`${p.name}\` (${p.paramIn})`).join(', ') || 'None';
        const responsesList = matchedEndpoint.responses.map((r) => `\`${r.statusCode}\``).join(', ') || '200 OK';

        answer = `### Endpoint Analysis: \`${matchedEndpoint.method} ${matchedEndpoint.path}\`\n\n` +
          `• **Purpose**: ${matchedEndpoint.purpose || matchedEndpoint.description}\n` +
          `• **Handler**: \`${matchedEndpoint.controllerName ? `${matchedEndpoint.controllerName}.${matchedEndpoint.handlerFunction}` : matchedEndpoint.handlerFunction}\`\n` +
          `• **Authentication**: ${matchedEndpoint.authRequired ? '🔒 Required (Bearer Token)' : '🌐 Public'}\n` +
          `• **Parameters**: ${paramsList}\n` +
          `• **Observed Status Codes**: ${responsesList}\n` +
          `• **Source Location**: \`${matchedEndpoint.sourceFile}:${matchedEndpoint.lineStart || 1}\``;

        citations.push({
          file: matchedEndpoint.sourceFile,
          line: matchedEndpoint.lineStart,
          description: `Route declaration in ${matchedEndpoint.sourceFile}`,
        });

        return { answer, citations };
      }
    }

    // Q2: Endpoints requiring authentication
    if (
      q.includes('which endpoint') ||
      q.includes('what endpoint') ||
      q.includes('protected') ||
      (q.includes('auth') && !q.includes('/auth/'))
    ) {
      const authEndpoints = knowledge.endpoints.filter((e) => e.authRequired);
      if (authEndpoints.length === 0) {
        answer = `None of the discovered endpoints explicitly require authentication middleware in their route definitions.`;
      } else {
        answer = `The following **${authEndpoints.length} endpoints** require authentication:\n\n` +
          authEndpoints
            .map((e) => `• \`${e.method} ${e.path}\` (Handled by: \`${e.controllerName || e.handlerFunction}\`, source: \`${e.sourceFile}:${e.lineStart || 1}\`)`)
            .join('\n');

        authEndpoints.forEach((e) => {
          citations.push({
            file: e.sourceFile,
            line: e.lineStart,
            description: `Route definition for ${e.method} ${e.path}`,
          });
        });
      }
      return { answer, citations };
    }

    // Q3: Database models inquiry
    if (q.includes('model') || q.includes('database') || q.includes('schema') || q.includes('table') || q.includes('entities')) {
      if (knowledge.models.length === 0) {
        answer = `No database models were found in the scanned codebase.`;
      } else {
        answer = `Discovered **${knowledge.models.length} database entities**:\n\n` +
          knowledge.models
            .map((m) => `• **${m.name}** (${m.ormType || 'ORM'} model in \`${m.sourceFile || 'schema'}\`) with fields: ${m.fields.map((f) => `\`${f.name}\``).join(', ')}`)
            .join('\n\n');

        knowledge.models.forEach((m) => {
          if (m.sourceFile) {
            citations.push({ file: m.sourceFile, description: `Model schema for ${m.name}` });
          }
        });
      }
      return { answer, citations };
    }

    // Q4: Security audit inquiry
    if (q.includes('security') || q.includes('vulnerability') || q.includes('risk') || q.includes('audit')) {
      if (knowledge.securityFindings.length === 0) {
        answer = `Static security scanner reported **0 warnings** for this codebase.`;
      } else {
        answer = `The static analyzer flagged **${knowledge.securityFindings.length} security warnings**:\n\n` +
          knowledge.securityFindings
            .map((f) => `• [**${f.severity.toUpperCase()}**] ${f.title}\n  *Recommendation*: ${f.recommendation} (\`${f.sourceFile}:${f.lineNumber || 1}\`)`)
            .join('\n\n');

        knowledge.securityFindings.forEach((f) => {
          citations.push({ file: f.sourceFile, line: f.lineNumber, description: f.title });
        });
      }
      return { answer, citations };
    }

    // General summary
    answer = `Based on the reverse-engineered knowledge graph for **${knowledge.project.name}**:\n\n` +
      `• **Total Endpoints**: Discovered ${knowledge.endpoints.length} routes across ${new Set(knowledge.endpoints.map((e) => e.sourceFile)).size} route files.\n` +
      `• **Framework**: Detected **${knowledge.project.framework}** with ${knowledge.project.language}.\n` +
      `• **Database**: Identified ${knowledge.models.length} models (${knowledge.models.map((m) => m.name).join(', ') || 'None'}).\n` +
      `• **Security Findings**: ${knowledge.securityFindings.length} potential issues detected.\n\n` +
      `Ask me about specific endpoints (e.g. \`What does GET /api/v1/products do?\`), authentication requirements, or database models!`;

    return { answer, citations };
  }
}

/**
 * Gemini Provider (Active when GEMINI_API_KEY is present)
 */
export class GeminiLLMProvider implements LLMProvider {
  public readonly providerName = 'Google Gemini';
  private apiKey: string;
  private heuristicFallback: HeuristicLLMProvider;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.heuristicFallback = new HeuristicLLMProvider();
  }

  public async enrichEndpoints(
    endpoints: ApiEndpoint[],
    context: { projectName: string; framework: string }
  ): Promise<ApiEndpoint[]> {
    try {
      const prompt = `You are a senior software architect. Analyze these reverse-engineered API endpoints and return enhanced business purpose summaries.\n\nEndpoints:\n` +
        JSON.stringify(
          endpoints.map((e) => ({
            method: e.method,
            path: e.path,
            controller: e.controllerName,
            handler: e.handlerFunction,
            params: e.parameters.map((p) => p.name),
          })),
          null,
          2
        ) +
        `\n\nReturn a JSON array of objects with keys: "path", "method", "purpose". Return only valid JSON.`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
        },
        { timeout: 15000 }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed)) {
          return endpoints.map((ep) => {
            const match = parsed.find(
              (p: any) => p.path === ep.path && p.method?.toUpperCase() === ep.method
            );
            if (match && match.purpose) {
              return { ...ep, purpose: match.purpose, detectionType: 'INFERRED' };
            }
            return ep;
          });
        }
      }
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to heuristic AI engine:', err.message);
    }

    return this.heuristicFallback.enrichEndpoints(endpoints, context);
  }

  public async answerCodebaseQuestion(
    question: string,
    knowledge: ProjectAnalysis
  ): Promise<LLMResponse> {
    try {
      const contextSummary = {
        project: knowledge.project.name,
        framework: knowledge.project.framework,
        endpoints: knowledge.endpoints.map((e) => ({
          method: e.method,
          path: e.path,
          auth: e.authRequired,
          controller: e.controllerName,
          source: `${e.sourceFile}:${e.lineStart || 1}`,
        })),
        models: knowledge.models.map((m) => ({ name: m.name, fields: m.fields.map((f) => f.name) })),
        securityFindingsCount: knowledge.securityFindings.length,
      };

      const prompt = `You are an AI Codebase Intelligence Assistant. Answer the developer's question using ONLY the provided AST reverse-engineered context. Include exact source file citations where applicable.\n\nContext:\n${JSON.stringify(contextSummary, null, 2)}\n\nUser Question:\n${question}`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
        },
        { timeout: 15000 }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        // Collect citations mentioned in the text
        const citations: Array<{ file: string; line?: number }> = [];
        knowledge.endpoints.forEach((ep) => {
          if (text.includes(ep.sourceFile)) {
            citations.push({ file: ep.sourceFile, line: ep.lineStart });
          }
        });
        return { answer: text, citations };
      }
    } catch (err: any) {
      console.warn('Gemini question call failed, using heuristic AI reasoning:', err.message);
    }

    return this.heuristicFallback.answerCodebaseQuestion(question, knowledge);
  }
}

/**
 * Provider Factory
 */
export function getLLMProvider(): LLMProvider {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim()) {
    return new GeminiLLMProvider(geminiKey.trim());
  }
  return new HeuristicLLMProvider();
}
