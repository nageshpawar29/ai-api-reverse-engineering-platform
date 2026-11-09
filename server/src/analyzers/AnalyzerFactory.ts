import { FrameworkAnalyzer, AnalysisEngineResult } from './FrameworkAnalyzer.js';
import { ExpressAnalyzer } from './express/ExpressAnalyzer.js';
import { PythonAnalyzer } from './python/PythonAnalyzer.js';
import { GoAnalyzer } from './go/GoAnalyzer.js';
import { JavaAnalyzer } from './java/JavaAnalyzer.js';

export class AnalyzerFactory {
  public static getAnalyzer(language: string, framework: string): FrameworkAnalyzer {
    const lang = (language || '').toLowerCase();
    const fw = (framework || '').toLowerCase();

    // 1. Python Ecosystem
    if (lang === 'python' || ['fastapi', 'flask', 'django'].includes(fw)) {
      return new PythonAnalyzer();
    }

    // 2. Go Ecosystem
    if (lang === 'go' || ['gin', 'fiber', 'chi', 'echo', 'nethttp'].includes(fw)) {
      return new GoAnalyzer();
    }

    // 3. Java / Kotlin Ecosystem
    if (lang === 'java' || lang === 'kotlin' || fw === 'spring-boot') {
      return new JavaAnalyzer();
    }

    // 4. Default Node.js / TypeScript / Express Ecosystem
    return new ExpressAnalyzer();
  }

  /**
   * Universal Polyglot Analyzer: Runs multi-language endpoint discovery
   * across any repository that mixes services (e.g. Node + Python + Go microservices).
   */
  public static async analyzePolyglot(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const analyzers: FrameworkAnalyzer[] = [
      new ExpressAnalyzer(),
      new PythonAnalyzer(),
      new GoAnalyzer(),
      new JavaAnalyzer(),
    ];

    const aggregatedResult: AnalysisEngineResult = {
      endpoints: [],
      models: [],
      dependencies: [],
      securityFindings: [],
      fileCount: 0,
    };

    for (const analyzer of analyzers) {
      try {
        const canHandle = await analyzer.detect(projectDir);
        if (canHandle) {
          const res = await analyzer.analyze(projectDir, projectId);
          aggregatedResult.endpoints.push(...res.endpoints);
          aggregatedResult.models.push(...res.models);
          aggregatedResult.dependencies.push(...res.dependencies);
          aggregatedResult.securityFindings.push(...res.securityFindings);
          aggregatedResult.fileCount += res.fileCount;
        }
      } catch (err) {
        console.warn(`Polyglot analyzer error with ${analyzer.name}:`, err);
      }
    }

    return aggregatedResult;
  }
}
