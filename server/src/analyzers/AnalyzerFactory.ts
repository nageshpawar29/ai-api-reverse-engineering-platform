import { FrameworkAnalyzer, AnalysisEngineResult } from './FrameworkAnalyzer.js';
import { ExpressAnalyzer } from './express/ExpressAnalyzer.js';
import { PythonAnalyzer } from './python/PythonAnalyzer.js';
import { GoAnalyzer } from './go/GoAnalyzer.js';
import { JavaAnalyzer } from './java/JavaAnalyzer.js';
import { PhpAnalyzer } from './php/PhpAnalyzer.js';
import { DotNetAnalyzer } from './dotnet/DotNetAnalyzer.js';
import { UniversalAnalyzer } from './universal/UniversalAnalyzer.js';

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

    // 4. PHP Ecosystem
    if (lang === 'php' || ['laravel', 'symfony', 'lumen'].includes(fw)) {
      return new PhpAnalyzer();
    }

    // 5. C# / .NET Ecosystem
    if (
      lang === 'csharp' ||
      lang === 'c#' ||
      lang === 'dotnet' ||
      ['aspnet', 'aspnetcore', 'webapi'].includes(fw)
    ) {
      return new DotNetAnalyzer();
    }

    // 6. Default Node.js / TypeScript / Express Ecosystem
    return new ExpressAnalyzer();
  }

  /**
   * Universal Polyglot Analyzer: Runs multi-language endpoint & model discovery
   * across any repository that mixes services (e.g. Node + Python + Go microservices,
   * PHP, .NET, Next.js, or raw SQL tables).
   */
  public static async analyzePolyglot(projectDir: string, projectId: string): Promise<AnalysisEngineResult> {
    const analyzers: FrameworkAnalyzer[] = [
      new ExpressAnalyzer(),
      new PythonAnalyzer(),
      new GoAnalyzer(),
      new JavaAnalyzer(),
      new PhpAnalyzer(),
      new DotNetAnalyzer(),
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
          // Deduplicate endpoints by method + path
          for (const ep of res.endpoints) {
            if (!aggregatedResult.endpoints.some((e) => e.method === ep.method && e.path === ep.path)) {
              aggregatedResult.endpoints.push(ep);
            }
          }
          // Deduplicate models by name
          for (const m of res.models) {
            if (!aggregatedResult.models.some((em) => em.name.toLowerCase() === m.name.toLowerCase())) {
              aggregatedResult.models.push(m);
            }
          }
          aggregatedResult.dependencies.push(...res.dependencies);
          aggregatedResult.securityFindings.push(...res.securityFindings);
          aggregatedResult.fileCount += res.fileCount;
        }
      } catch (err) {
        console.warn(`Polyglot analyzer error with ${analyzer.name}:`, err);
      }
    }

    // Universal Heuristic & AST Fallback: If 0 endpoints OR 0 models found, or to catch Next.js/SQL
    if (aggregatedResult.endpoints.length === 0 || aggregatedResult.models.length === 0) {
      try {
        const universal = new UniversalAnalyzer();
        const uniRes = await universal.analyze(projectDir, projectId);
        for (const ep of uniRes.endpoints) {
          if (!aggregatedResult.endpoints.some((e) => e.method === ep.method && e.path === ep.path)) {
            aggregatedResult.endpoints.push(ep);
          }
        }
        for (const m of uniRes.models) {
          if (!aggregatedResult.models.some((em) => em.name.toLowerCase() === m.name.toLowerCase())) {
            aggregatedResult.models.push(m);
          }
        }
        aggregatedResult.dependencies.push(...uniRes.dependencies);
        aggregatedResult.securityFindings.push(...uniRes.securityFindings);
        aggregatedResult.fileCount = Math.max(aggregatedResult.fileCount, uniRes.fileCount);
      } catch (err) {
        console.warn('Universal analyzer error:', err);
      }
    }

    return aggregatedResult;
  }
}
