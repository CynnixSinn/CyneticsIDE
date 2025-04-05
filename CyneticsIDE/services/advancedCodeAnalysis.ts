import { AIService } from './ai'
import { CodeAnalysisService } from './codeAnalysis'

interface ArchitectureAnalysis {
  patterns: Array<{
    name: string
    confidence: number
    description: string
    suggestions: string[]
  }>
  dependencies: {
    circular: string[][]
    unused: string[]
    missing: string[]
  }
  layering: {
    violations: Array<{
      from: string
      to: string
      rule: string
    }>
    suggestions: string[]
  }
}

interface CodeSmell {
  type: string
  location: {
    file: string
    startLine: number
    endLine: number
  }
  severity: 'high' | 'medium' | 'low'
  description: string
  refactoringStrategy: string
  impact: string[]
}

interface TechnicalDebt {
  category: 'architecture' | 'code' | 'test' | 'documentation'
  description: string
  impact: number // 0-100
  effort: number // Story points or days
  suggestions: string[]
}

interface APIAnalysis {
  endpoints: Array<{
    path: string
    method: string
    parameters: Array<{
      name: string
      type: string
      required: boolean
    }>
    responses: Record<string, {
      description: string
      schema: any
    }>
    security: string[]
    issues: string[]
  }>
  suggestions: {
    security: string[]
    performance: string[]
    documentation: string[]
  }
}

export class AdvancedCodeAnalysis {
  private static instance: AdvancedCodeAnalysis
  private aiService: AIService
  private basicAnalysis: CodeAnalysisService

  private constructor() {
    this.aiService = AIService.getInstance()
    this.basicAnalysis = CodeAnalysisService.getInstance()
  }

  static getInstance(): AdvancedCodeAnalysis {
    if (!AdvancedCodeAnalysis.instance) {
      AdvancedCodeAnalysis.instance = new AdvancedCodeAnalysis()
    }
    return AdvancedCodeAnalysis.instance
  }

  async analyzeArchitecture(
    files: Array<{ path: string; content: string }>
  ): Promise<ArchitectureAnalysis> {
    const prompt = `
      Analyze the architecture of this codebase:
      
      ${files.map(f => `
        File: ${f.path}
        Content:
        ${f.content}
      `).join('\n\n')}
      
      Provide analysis in JSON format with:
      1. Design patterns detected
      2. Dependency analysis
      3. Layering violations
      4. Architecture improvement suggestions
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async detectCodeSmells(
    code: string,
    language: string
  ): Promise<CodeSmell[]> {
    const prompt = `
      Detect code smells in this ${language} code:
      
      ${code}
      
      Look for:
      1. Long methods/functions
      2. Duplicate code
      3. Large classes
      4. Complex conditionals
      5. Dead code
      6. Data clumps
      7. Feature envy
      8. Primitive obsession
      
      Return in JSON format with locations and refactoring strategies.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async analyzeTechnicalDebt(
    files: Array<{ path: string; content: string }>
  ): Promise<TechnicalDebt[]> {
    const prompt = `
      Analyze technical debt in this codebase:
      
      ${files.map(f => `
        File: ${f.path}
        Content:
        ${f.content}
      `).join('\n\n')}
      
      Categories to consider:
      1. Architecture debt
      2. Code debt
      3. Test debt
      4. Documentation debt
      
      Return in JSON format with impact scores and remediation suggestions.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async analyzeAPI(code: string): Promise<APIAnalysis> {
    const prompt = `
      Analyze this API code:
      
      ${code}
      
      Provide:
      1. Endpoint documentation
      2. Security analysis
      3. Performance considerations
      4. API best practices review
      
      Return in JSON format with detailed endpoint information and suggestions.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async suggestOptimizations(
    code: string,
    language: string,
    type: 'performance' | 'memory' | 'network' | 'all' = 'all'
  ): Promise<{
    suggestions: Array<{
      type: string
      description: string
      impact: 'high' | 'medium' | 'low'
      implementation: string
      tradeoffs: string[]
    }>
  }> {
    const prompt = `
      Suggest optimizations for this ${language} code:
      
      ${code}
      
      Focus on ${type === 'all' ? 'all aspects' : type} optimization.
      Consider:
      1. Algorithm efficiency
      2. Resource usage
      3. Caching strategies
      4. Parallel processing
      5. Data structure choices
      
      Return in JSON format with detailed implementation suggestions.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async generateMetrics(
    files: Array<{ path: string; content: string }>
  ): Promise<{
    overall: {
      maintainability: number
      reliability: number
      security: number
      performance: number
    }
    files: Array<{
      path: string
      metrics: {
        complexity: number
        coverage: number
        duplication: number
        issues: number
      }
    }>
  }> {
    // First get basic metrics
    const basicMetrics = await Promise.all(
      files.map(async file => {
        const analysis = await this.basicAnalysis.analyzeCode(
          file.content,
          file.path.split('.').pop() || ''
        )
        return {
          path: file.path,
          metrics: analysis.metrics
        }
      })
    )

    // Then get advanced metrics using AI
    const prompt = `
      Generate detailed metrics for this codebase:
      
      ${files.map(f => `
        File: ${f.path}
        Content:
        ${f.content}
      `).join('\n\n')}
      
      Consider:
      1. Overall architecture quality
      2. Code maintainability
      3. System reliability
      4. Security posture
      5. Performance characteristics
      
      Return in JSON format with both overall and per-file metrics.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }
} 