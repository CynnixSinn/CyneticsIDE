import { AIService } from './ai'

interface DebugContext {
  code: string
  error: string
  stackTrace?: string
  variables?: Record<string, any>
  breakpoints?: number[]
}

interface DebugSuggestion {
  description: string
  solution: string
  confidence: number
  codeChanges?: {
    line: number
    original: string
    suggested: string
  }[]
}

export class DebuggingService {
  private static instance: DebuggingService
  private aiService: AIService
  private debugHistory: Map<string, DebugContext[]> = new Map()

  private constructor() {
    this.aiService = AIService.getInstance()
  }

  static getInstance(): DebuggingService {
    if (!DebuggingService.instance) {
      DebuggingService.instance = new DebuggingService()
    }
    return DebuggingService.instance
  }

  async analyzeError(context: DebugContext): Promise<DebugSuggestion[]> {
    const prompt = `
      Analyze this error and provide debugging suggestions:
      
      Code:
      ${context.code}
      
      Error:
      ${context.error}
      
      ${context.stackTrace ? `Stack Trace:\n${context.stackTrace}` : ''}
      ${context.variables ? `Variables:\n${JSON.stringify(context.variables, null, 2)}` : ''}
      
      Provide suggestions in JSON format with:
      - Description of the issue
      - Proposed solution
      - Confidence level (0-1)
      - Specific code changes if applicable
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    try {
      const suggestions = JSON.parse(response.text) as DebugSuggestion[]
      
      // Store debug context for learning
      this.storeDebugContext(context)
      
      return suggestions
    } catch (error) {
      console.error('Failed to parse debug suggestions:', error)
      return []
    }
  }

  async explainCode(code: string, line: number): Promise<string> {
    const prompt = `
      Explain this code, focusing on line ${line}:
      
      ${code}
      
      Provide a clear, concise explanation of:
      1. What the code does
      2. How line ${line} fits into the overall logic
      3. Potential issues or improvements
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return response.text
  }

  async suggestBreakpoints(code: string): Promise<number[]> {
    const prompt = `
      Analyze this code and suggest strategic breakpoint locations:
      
      ${code}
      
      Return an array of line numbers where breakpoints would be most useful for debugging.
      Consider:
      1. Complex logic branches
      2. Data transformations
      3. Error-prone areas
      4. State changes
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    try {
      return JSON.parse(response.text) as number[]
    } catch (error) {
      console.error('Failed to parse breakpoint suggestions:', error)
      return []
    }
  }

  async analyzeVariableState(
    variables: Record<string, any>,
    context: string
  ): Promise<string> {
    const prompt = `
      Analyze these variable values in the context of the code:
      
      Context:
      ${context}
      
      Variables:
      ${JSON.stringify(variables, null, 2)}
      
      Provide insights about:
      1. Any unexpected values
      2. Potential issues
      3. Suggested improvements
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return response.text
  }

  private storeDebugContext(context: DebugContext) {
    const errorKey = context.error.split('\n')[0] // Use first line as key
    const history = this.debugHistory.get(errorKey) || []
    history.push(context)
    this.debugHistory.set(errorKey, history)
  }

  async learnFromHistory(error: string): Promise<DebugSuggestion[]> {
    const history = this.debugHistory.get(error.split('\n')[0]) || []
    
    if (history.length === 0) return []

    const prompt = `
      Analyze these historical debugging sessions for similar errors:
      
      ${JSON.stringify(history, null, 2)}
      
      Based on past solutions, suggest debugging approaches for this error:
      ${error}
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    try {
      return JSON.parse(response.text) as DebugSuggestion[]
    } catch (error) {
      console.error('Failed to parse historical suggestions:', error)
      return []
    }
  }
} 