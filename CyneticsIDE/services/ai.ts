import axios from 'axios'

export type AIModel = 'claude-3' | 'llama-3' | 'grok-3' | 'deepseek-r1' | 'gemini-2'

interface AIRequestOptions {
  model: AIModel
  prompt: string
  temperature?: number
  maxTokens?: number
}

interface AIResponse {
  text: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

interface CompletionSuggestion {
  text: string
  displayText: string
  kind: 'function' | 'variable' | 'keyword' | 'property' | 'class' | 'method'
  documentation?: string
}

interface CodeError {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
  source: string
  suggestions?: string[]
}

export class AIService {
  private static instance: AIService
  private apiKey: string = ''
  private completionCache = new Map<string, CompletionSuggestion[]>()
  private errorCheckTimeout: NodeJS.Timeout | null = null

  private constructor() {}

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService()
    }
    return AIService.instance
  }

  setApiKey(key: string) {
    this.apiKey = key
  }

  async generateCode(options: AIRequestOptions): Promise<string> {
    const response = await this.makeRequest({
      ...options,
      prompt: `Generate code: ${options.prompt}`,
    })
    return response.text
  }

  async refactorCode(code: string, instructions: string, model: AIModel = 'claude-3'): Promise<string> {
    const response = await this.makeRequest({
      model,
      prompt: `Refactor this code according to these instructions: ${instructions}\n\nCode:\n${code}`,
    })
    return response.text
  }

  async generateTests(code: string, model: AIModel = 'gemini-2'): Promise<string> {
    const response = await this.makeRequest({
      model,
      prompt: `Generate comprehensive Jest tests for this code:\n${code}`,
    })
    return response.text
  }

  async generateFlowchart(code: string, model: AIModel = 'deepseek-r1'): Promise<string> {
    const response = await this.makeRequest({
      model,
      prompt: `Convert this code to a Mermaid flowchart:\n${code}`,
    })
    return response.text
  }

  async chatAssistant(message: string, context: string = '', model: AIModel = 'grok-3'): Promise<string> {
    const response = await this.makeRequest({
      model,
      prompt: `Context: ${context}\n\nUser: ${message}`,
    })
    return response.text
  }

  async getCompletions(
    code: string,
    position: { line: number; column: number },
    language: string,
    model: AIModel = 'llama-3'
  ): Promise<CompletionSuggestion[]> {
    const cacheKey = `${code}:${position.line}:${position.column}:${language}`
    if (this.completionCache.has(cacheKey)) {
      return this.completionCache.get(cacheKey)!
    }

    const response = await this.makeRequest({
      model,
      prompt: `Generate code completions for ${language} at position ${position.line}:${position.column}:\n\n${code}`,
    })

    try {
      const suggestions = JSON.parse(response.text) as CompletionSuggestion[]
      this.completionCache.set(cacheKey, suggestions)
      return suggestions
    } catch (error) {
      console.error('Failed to parse completion suggestions:', error)
      return []
    }
  }

  async detectErrors(
    code: string,
    language: string,
    model: AIModel = 'claude-3'
  ): Promise<CodeError[]> {
    if (this.errorCheckTimeout) {
      clearTimeout(this.errorCheckTimeout)
    }

    return new Promise((resolve) => {
      this.errorCheckTimeout = setTimeout(async () => {
        try {
          const response = await this.makeRequest({
            model,
            prompt: `Analyze this ${language} code for errors and provide suggestions:\n\n${code}`,
          })

          const errors = JSON.parse(response.text) as CodeError[]
          resolve(errors)
        } catch (error) {
          console.error('Error detection failed:', error)
          resolve([])
        }
      }, 500) // Debounce error checking
    })
  }

  private async makeRequest(options: AIRequestOptions): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('API key not set')
    }

    // This is a placeholder implementation. In a real application,
    // you would make actual API calls to the respective AI services.
    const endpoint = this.getEndpointForModel(options.model)
    
    try {
      const response = await axios.post(endpoint, {
        ...options,
        api_key: this.apiKey,
      })

      return response.data
    } catch (error) {
      console.error('AI request failed:', error)
      throw error
    }
  }

  private getEndpointForModel(model: AIModel): string {
    // Replace these with actual API endpoints
    const endpoints = {
      'claude-3': 'https://api.anthropic.com/v1/complete',
      'llama-3': 'https://api.llama.ai/v1/generate',
      'grok-3': 'https://api.grok.ai/v1/chat',
      'deepseek-r1': 'https://api.deepseek.ai/v1/generate',
      'gemini-2': 'https://api.gemini.ai/v1/generate',
    }
    return endpoints[model]
  }
} 