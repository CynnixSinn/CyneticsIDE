import { AIService } from './ai'

interface CodeMetrics {
  complexity: number
  maintainability: number
  testability: number
  reusability: number
  security: number
}

interface CodeIssue {
  type: 'security' | 'performance' | 'maintainability' | 'bug'
  severity: 'high' | 'medium' | 'low'
  description: string
  suggestion: string
  line?: number
  column?: number
}

interface DependencyGraph {
  nodes: Array<{
    id: string
    type: 'function' | 'class' | 'variable' | 'import'
    name: string
  }>
  edges: Array<{
    source: string
    target: string
    type: 'calls' | 'imports' | 'extends' | 'uses'
  }>
}

export class CodeAnalysisService {
  private static instance: CodeAnalysisService
  private aiService: AIService

  private constructor() {
    this.aiService = AIService.getInstance()
  }

  static getInstance(): CodeAnalysisService {
    if (!CodeAnalysisService.instance) {
      CodeAnalysisService.instance = new CodeAnalysisService()
    }
    return CodeAnalysisService.instance
  }

  async analyzeCode(code: string, language: string): Promise<{
    metrics: CodeMetrics
    issues: CodeIssue[]
    suggestions: string[]
  }> {
    const prompt = `
      Analyze this ${language} code:
      
      ${code}
      
      Provide analysis in JSON format with:
      1. Code quality metrics (0-100)
      2. Potential issues and their severity
      3. Improvement suggestions
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async generateDependencyGraph(code: string, language: string): Promise<DependencyGraph> {
    const prompt = `
      Generate a dependency graph for this ${language} code:
      
      ${code}
      
      Return in JSON format with:
      1. Nodes (functions, classes, variables, imports)
      2. Edges (relationships between nodes)
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async suggestRefactoring(code: string, language: string): Promise<{
    suggestions: Array<{
      type: string
      description: string
      before: string
      after: string
    }>
  }> {
    const prompt = `
      Suggest refactoring improvements for this ${language} code:
      
      ${code}
      
      Consider:
      1. Design patterns
      2. Code organization
      3. Performance optimization
      4. Best practices
      
      Return suggestions in JSON format with before/after examples.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async generateDocumentation(code: string, language: string): Promise<string> {
    const prompt = `
      Generate comprehensive documentation for this ${language} code:
      
      ${code}
      
      Include:
      1. Overview
      2. Function/class documentation
      3. Usage examples
      4. Dependencies
      5. Error handling
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return response.text
  }

  async analyzePerformance(code: string, language: string): Promise<{
    hotspots: Array<{
      line: number
      description: string
      impact: 'high' | 'medium' | 'low'
      suggestion: string
    }>
    overallScore: number
  }> {
    const prompt = `
      Analyze performance characteristics of this ${language} code:
      
      ${code}
      
      Identify:
      1. Performance hotspots
      2. Time complexity issues
      3. Memory usage concerns
      4. Optimization opportunities
      
      Return analysis in JSON format.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async suggestTests(code: string, language: string): Promise<{
    unitTests: string[]
    integrationTests: string[]
    coverage: {
      statements: number
      branches: number
      functions: number
      lines: number
    }
  }> {
    const prompt = `
      Suggest tests for this ${language} code:
      
      ${code}
      
      Generate:
      1. Unit test cases
      2. Integration test scenarios
      3. Expected coverage metrics
      
      Return in JSON format with test code.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async checkSecurityVulnerabilities(code: string, language: string): Promise<{
    vulnerabilities: Array<{
      type: string
      severity: 'critical' | 'high' | 'medium' | 'low'
      description: string
      remediation: string
      cwe?: string
    }>
  }> {
    const prompt = `
      Analyze this ${language} code for security vulnerabilities:
      
      ${code}
      
      Check for:
      1. Common vulnerabilities (XSS, CSRF, etc.)
      2. Input validation issues
      3. Authentication/authorization flaws
      4. Data exposure risks
      
      Return findings in JSON format with CWE references.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }
} 