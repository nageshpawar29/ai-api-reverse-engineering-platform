import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { getLLMProvider } from '../ai/LLMProvider.js';
import { AppError } from '../middleware/errorHandler.js';
import { ChatMessage } from '../types/index.js';

export const chatRouter = Router();

// GET /api/chat/:id/messages
chatRouter.get('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const history = await db.getChatHistory(projectId);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/:id/ask
chatRouter.post('/:id/ask', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.id as string;
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      throw new AppError('Question prompt is required', 400);
    }

    const analysis = await db.getProjectAnalysis(projectId);
    if (!analysis) throw new AppError('Project analysis not found', 404);

    // Save user message
    const userMessage: ChatMessage = {
      id: `chat-${uuidv4().substring(0, 8)}`,
      projectId,
      role: 'user',
      content: prompt.trim(),
      createdAt: new Date().toISOString(),
    };
    await db.addChatMessage(userMessage);

    // Query LLM provider with grounded AST knowledge
    const llm = getLLMProvider();
    const llmResponse = await llm.answerCodebaseQuestion(prompt.trim(), analysis);

    // Save assistant response
    const assistantMessage: ChatMessage = {
      id: `chat-${uuidv4().substring(0, 8)}`,
      projectId,
      role: 'assistant',
      content: llmResponse.answer,
      citations: llmResponse.citations,
      createdAt: new Date().toISOString(),
    };
    await db.addChatMessage(assistantMessage);

    res.json(assistantMessage);
  } catch (err) {
    next(err);
  }
});
