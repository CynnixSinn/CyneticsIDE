import { AIService } from './ai'
import { GitHubService } from './github'
import { TestingService } from './testing'

interface CodeReviewComment {
  path: string
  line: number
  message: string
  severity: 'error' | 'warning' | 'suggestion' | 'praise'
  suggestions?: string[]
}

interface ReviewResult {
  comments: CodeReviewComment[]
  summary: string
  score: number
  testResults?: {
    passed: boolean
    coverage: number
    details: string
  }
}

export class CodeReviewService {
  private static instance: CodeReviewService
  private aiService: AIService
  private githubService: GitHubService
  private testingService: TestingService

  private constructor() {
    this.aiService = AIService.getInstance()
    this.githubService = GitHubService.getInstance()
    this.testingService = TestingService.getInstance()
  }

  static getInstance(): CodeReviewService {
    if (!CodeReviewService.instance) {
      CodeReviewService.instance = new CodeReviewService()
    }
    return CodeReviewService.instance
  }

  async reviewPullRequest(
    repo: string,
    prNumber: number,
    options: {
      runTests?: boolean
      checkStyle?: boolean
      securityScan?: boolean
    } = {}
  ): Promise<ReviewResult> {
    const changes = await this.githubService.getPullRequestChanges(repo, prNumber)
    const comments: CodeReviewComment[] = []
    let totalScore = 0

    // Review each changed file
    for (const file of changes) {
      const fileComments = await this.reviewFile(file.content, file.path, options)
      comments.push(...fileComments)
      
      // Calculate score based on comment severity
      totalScore += this.calculateScore(fileComments)
    }

    // Run tests if requested
    let testResults
    if (options.runTests) {
      testResults = await this.runTestSuite(changes)
    }

    // Generate review summary
    const summary = await this.generateReviewSummary(comments, testResults)

    // Post review to GitHub
    await this.submitGitHubReview(repo, prNumber, comments, summary)

    return {
      comments,
      summary,
      score: totalScore,
      testResults
    }
  }

  private async reviewFile(
    content: string,
    path: string,
    options: {
      checkStyle?: boolean
      securityScan?: boolean
    }
  ): Promise<CodeReviewComment[]> {
    const comments: CodeReviewComment[] = []

    // AI-powered code analysis
    const analysisPrompt = `
      Review this code for:
      1. Code quality and best practices
      2. Potential bugs and edge cases
      3. Performance issues
      4. ${options.checkStyle ? 'Style guide compliance' : ''}
      5. ${options.securityScan ? 'Security vulnerabilities' : ''}

      File: ${path}
      Content:
      ${content}

      Return the review comments as a JSON array with line numbers, severity, and suggestions.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt: analysisPrompt
    })

    try {
      const aiComments = JSON.parse(response.text)
      comments.push(...aiComments)
    } catch (error) {
      console.error('Failed to parse AI review comments:', error)
    }

    return comments
  }

  private async runTestSuite(
    changes: Array<{ path: string; content: string }>
  ): Promise<ReviewResult['testResults']> {
    let totalCoverage = 0
    let passedTests = 0
    let totalTests = 0
    let details = ''

    for (const file of changes) {
      if (file.path.endsWith('.ts') || file.path.endsWith('.js')) {
        const testResult = await this.testingService.runTests(file.path)
        
        if (testResult.coverage) {
          totalCoverage += testResult.coverage.lines
          totalTests++
        }

        if (testResult.success) {
          passedTests++
        }

        details += `\n${file.path}: ${testResult.success ? '✅' : '❌'}\n${testResult.output}\n`
      }
    }

    return {
      passed: passedTests === totalTests,
      coverage: totalTests > 0 ? totalCoverage / totalTests : 0,
      details
    }
  }

  private calculateScore(comments: CodeReviewComment[]): number {
    const severityScores = {
      error: -5,
      warning: -2,
      suggestion: -1,
      praise: 2
    }

    return comments.reduce((score, comment) => 
      score + severityScores[comment.severity], 0)
  }

  private async generateReviewSummary(
    comments: CodeReviewComment[],
    testResults?: ReviewResult['testResults']
  ): Promise<string> {
    const prompt = `
      Generate a concise but informative code review summary based on these review comments
      and test results. Include key findings, patterns, and recommendations.

      Review Comments:
      ${JSON.stringify(comments, null, 2)}

      Test Results:
      ${JSON.stringify(testResults, null, 2)}
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return response.text
  }

  private async submitGitHubReview(
    repo: string,
    prNumber: number,
    comments: CodeReviewComment[],
    summary: string
  ): Promise<void> {
    await this.githubService.createReview(repo, prNumber, {
      body: summary,
      comments: comments.map(comment => ({
        path: comment.path,
        line: comment.line,
        body: `**${comment.severity.toUpperCase()}**: ${comment.message}${
          comment.suggestions ? '\n\nSuggestions:\n' + comment.suggestions.join('\n') : ''
        }`
      })),
      event: comments.some(c => c.severity === 'error') ? 'REQUEST_CHANGES' : 'APPROVE'
    })
  }
} 