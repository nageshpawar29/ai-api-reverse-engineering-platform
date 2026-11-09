import fs from 'fs';
import path from 'path';

export interface DetectionResult {
  framework: string;
  language: string;
  confidence: number;
  details: string[];
}

export class FrameworkDetector {
  public static async detect(projectDir: string): Promise<DetectionResult> {
    const details: string[] = [];
    let framework = 'unknown';
    let language = 'unknown';
    let confidence = 0.5;

    // 1. Check Python Ecosystem (requirements.txt, Pipfile, pyproject.toml, *.py)
    const pythonSignatures = ['requirements.txt', 'Pipfile', 'pyproject.toml', 'setup.py', 'manage.py', 'main.py', 'app.py'];
    const hasPythonFiles = pythonSignatures.some((sig) => fs.existsSync(path.join(projectDir, sig))) ||
      this.hasFilesWithExtension(projectDir, ['.py']);

    if (hasPythonFiles) {
      language = 'python';
      let content = '';

      // Check requirements or pyproject
      const reqPath = path.join(projectDir, 'requirements.txt');
      const pyprojectPath = path.join(projectDir, 'pyproject.toml');
      const pipfilePath = path.join(projectDir, 'Pipfile');

      if (fs.existsSync(reqPath)) {
        try { content += fs.readFileSync(reqPath, 'utf-8').toLowerCase(); } catch (e) {}
      }
      if (fs.existsSync(pyprojectPath)) {
        try { content += fs.readFileSync(pyprojectPath, 'utf-8').toLowerCase(); } catch (e) {}
      }
      if (fs.existsSync(pipfilePath)) {
        try { content += fs.readFileSync(pipfilePath, 'utf-8').toLowerCase(); } catch (e) {}
      }

      if (content.includes('fastapi') || this.scanCodePattern(projectDir, ['.py'], ['fastapi', '@app.get', '@router.get'])) {
        framework = 'fastapi';
        confidence = 0.95;
        details.push('Detected Python FastAPI framework from dependencies / decorators');
      } else if (content.includes('flask') || this.scanCodePattern(projectDir, ['.py'], ['flask', 'flask(__name__)', '@app.route'])) {
        framework = 'flask';
        confidence = 0.95;
        details.push('Detected Python Flask framework from dependencies / route decorators');
      } else if (content.includes('django') || fs.existsSync(path.join(projectDir, 'manage.py'))) {
        framework = 'django';
        confidence = 0.92;
        details.push('Detected Python Django / Django REST Framework from manage.py / dependencies');
      } else {
        framework = 'fastapi'; // Modern default Python API framework
        confidence = 0.75;
        details.push('Detected Python environment; defaulted to FastAPI parser heuristics');
      }

      return { framework, language, confidence, details };
    }

    // 2. Check Go Ecosystem (go.mod, *.go)
    const goModPath = path.join(projectDir, 'go.mod');
    const hasGoFiles = fs.existsSync(goModPath) || this.hasFilesWithExtension(projectDir, ['.go']);

    if (hasGoFiles) {
      language = 'go';
      let modContent = '';
      if (fs.existsSync(goModPath)) {
        try { modContent = fs.readFileSync(goModPath, 'utf-8').toLowerCase(); } catch (e) {}
      }

      if (modContent.includes('gin-gonic/gin') || this.scanCodePattern(projectDir, ['.go'], ['gin.default', 'gin.new', 'r.get(', 'r.post('])) {
        framework = 'gin';
        confidence = 0.95;
        details.push('Detected Go Gin web framework from go.mod / route patterns');
      } else if (modContent.includes('gofiber/fiber') || this.scanCodePattern(projectDir, ['.go'], ['fiber.new', 'app.get(', 'app.post('])) {
        framework = 'fiber';
        confidence = 0.92;
        details.push('Detected Go Fiber framework from dependencies / router');
      } else if (modContent.includes('go-chi/chi') || this.scanCodePattern(projectDir, ['.go'], ['chi.newrouter'])) {
        framework = 'chi';
        confidence = 0.9;
        details.push('Detected Go Chi lightweight router');
      } else if (modContent.includes('labstack/echo') || this.scanCodePattern(projectDir, ['.go'], ['echo.new'])) {
        framework = 'echo';
        confidence = 0.9;
        details.push('Detected Go Echo web framework');
      } else {
        framework = 'gin'; // Standard modern Go API framework fallback
        confidence = 0.75;
        details.push('Detected Go codebase; defaulted to Gin / Net-HTTP routing heuristics');
      }

      return { framework, language, confidence, details };
    }

    // 3. Check Java / Kotlin Ecosystem (pom.xml, build.gradle, src/main/java)
    const hasPom = fs.existsSync(path.join(projectDir, 'pom.xml'));
    const hasGradle = fs.existsSync(path.join(projectDir, 'build.gradle')) || fs.existsSync(path.join(projectDir, 'build.gradle.kts'));
    const hasJavaFiles = this.hasFilesWithExtension(projectDir, ['.java', '.kt']);

    if (hasPom || hasGradle || hasJavaFiles) {
      language = this.hasFilesWithExtension(projectDir, ['.kt']) ? 'kotlin' : 'java';
      let buildContent = '';
      if (hasPom) {
        try { buildContent += fs.readFileSync(path.join(projectDir, 'pom.xml'), 'utf-8').toLowerCase(); } catch (e) {}
      }
      if (hasGradle) {
        try {
          const gPath = fs.existsSync(path.join(projectDir, 'build.gradle'))
            ? path.join(projectDir, 'build.gradle')
            : path.join(projectDir, 'build.gradle.kts');
          buildContent += fs.readFileSync(gPath, 'utf-8').toLowerCase();
        } catch (e) {}
      }

      if (buildContent.includes('spring-boot') || this.scanCodePattern(projectDir, ['.java', '.kt'], ['@restcontroller', '@getmapping', '@requestmapping'])) {
        framework = 'spring-boot';
        confidence = 0.95;
        details.push('Detected Java Spring Boot framework from annotations / build descriptors');
      } else {
        framework = 'spring-boot';
        confidence = 0.8;
        details.push('Detected Java/Kotlin enterprise project; defaulted to Spring Boot parser heuristics');
      }

      return { framework, language, confidence, details };
    }

    // 4. Check PHP Ecosystem (composer.json, artisan, *.php)
    const composerPath = path.join(projectDir, 'composer.json');
    const hasArtisan = fs.existsSync(path.join(projectDir, 'artisan'));
    const hasPhpFiles = fs.existsSync(composerPath) || hasArtisan || this.hasFilesWithExtension(projectDir, ['.php']);

    if (hasPhpFiles) {
      language = 'php';
      if (hasArtisan || this.scanCodePattern(projectDir, ['.php'], ['route::get', 'route::post', 'illuminate\\'])) {
        framework = 'laravel';
        confidence = 0.95;
        details.push('Detected PHP Laravel framework from artisan / Route facade');
      } else {
        framework = 'laravel';
        confidence = 0.8;
        details.push('Detected PHP project; defaulted to Laravel API routing heuristics');
      }

      return { framework, language, confidence, details };
    }

    // 5. Check Node.js / JavaScript / TypeScript Ecosystem (package.json)
    const packageJsonPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      language = 'javascript';
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        };

        if (allDeps['express']) {
          framework = 'express';
          confidence = 0.95;
          details.push('Detected "express" dependency in package.json');
        } else if (allDeps['fastify']) {
          framework = 'fastify';
          confidence = 0.92;
          details.push('Detected "fastify" dependency in package.json');
        } else if (allDeps['@nestjs/core']) {
          framework = 'nestjs';
          confidence = 0.92;
          details.push('Detected "@nestjs/core" dependency in package.json');
        } else if (allDeps['koa']) {
          framework = 'koa';
          confidence = 0.9;
          details.push('Detected "koa" dependency in package.json');
        }

        if (allDeps['typescript'] || fs.existsSync(path.join(projectDir, 'tsconfig.json'))) {
          language = 'typescript';
          details.push('Detected TypeScript configuration / dependencies');
        }
      } catch (err) {
        details.push('package.json found but could not be parsed');
      }
    }

    // Source file scan fallback for Node / JS / TS
    if (framework === 'unknown') {
      const files = this.scanDirForSignatures(projectDir, ['.js', '.ts', '.mjs', '.cjs'], 30);
      for (const f of files) {
        if (f.endsWith('.ts')) language = 'typescript';

        try {
          const content = fs.readFileSync(f, 'utf-8');
          if (content.includes('express()') || content.includes('express.Router()') || content.includes('.use(')) {
            framework = 'express';
            confidence = 0.85;
            details.push(`Detected Express patterns in ${path.relative(projectDir, f)}`);
            break;
          } else if (content.includes('@Controller(') || content.includes('@Get(')) {
            framework = 'nestjs';
            confidence = 0.9;
            details.push(`Detected NestJS decorators in ${path.relative(projectDir, f)}`);
            break;
          } else if (content.includes('fastify(') || content.includes('fastify.get(')) {
            framework = 'fastify';
            confidence = 0.88;
            details.push(`Detected Fastify patterns in ${path.relative(projectDir, f)}`);
            break;
          }
        } catch (e) {}
      }
    }

    // Fallback if completely unknown
    if (framework === 'unknown') {
      framework = 'express';
      language = 'typescript';
      confidence = 0.6;
      details.push('Defaulted to Express parser heuristics');
    }

    return { framework, language, confidence, details };
  }

  private static hasFilesWithExtension(dir: string, extensions: string[], maxDepth = 4, currentDepth = 0): boolean {
    if (currentDepth > maxDepth || !fs.existsSync(dir)) return false;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '.next', 'venv', '.venv', '__pycache__', 'target', 'vendor'].includes(entry.name)) {
            if (this.hasFilesWithExtension(path.join(dir, entry.name), extensions, maxDepth, currentDepth + 1)) {
              return true;
            }
          }
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) return true;
        }
      }
    } catch (e) {}
    return false;
  }

  private static scanCodePattern(dir: string, extensions: string[], keywords: string[], maxFiles = 25): boolean {
    const files = this.scanDirForSignatures(dir, extensions, maxFiles);
    for (const f of files) {
      try {
        const text = fs.readFileSync(f, 'utf-8').toLowerCase();
        if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  private static scanDirForSignatures(dir: string, extensions: string[], maxFiles = 30): string[] {
    const matched: string[] = [];
    const walk = (current: string) => {
      if (matched.length >= maxFiles) return;
      if (!fs.existsSync(current)) return;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (matched.length >= maxFiles) return;
          const full = path.join(current, entry.name);

          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '.next', 'venv', '.venv', '__pycache__', 'target', 'vendor', '.idea'].includes(entry.name)) {
              walk(full);
            }
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              matched.push(full);
            }
          }
        }
      } catch (e) {}
    };

    walk(dir);
    return matched;
  }
}
