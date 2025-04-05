import { AIService } from './ai'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface TestResult {
  success: boolean
  output: string
  coverage?: {
    statements: number
    branches: number
    functions: number
    lines: number
  }
}

interface TestCase {
  description: string
  code: string
  expectedResult: any
}

export class TestingService {
  private static instance: TestingService
  private aiService: AIService

  private constructor() {
    this.aiService = AIService.getInstance()
  }

  static getInstance(): TestingService {
    if (!TestingService.instance) {
      TestingService.instance = new TestingService()
    }
    return TestingService.instance
  }

  async generateTests(
    sourceCode: string,
    filePath: string,
    language: string
  ): Promise<string> {
    // Use AI to analyze the code and generate test cases
    const testCases = await this.generateTestCases(sourceCode, language)
    
    // Generate Jest test file
    const testCode = this.createTestFile(sourceCode, testCases, filePath)
    
    // Save the test file
    await this.saveTestFile(testCode, filePath)
    
    return testCode
  }

  private async generateTestCases(code: string, language: string): Promise<TestCase[]> {
    const prompt = `
      Analyze this ${language} code and generate comprehensive test cases.
      Include edge cases, error conditions, and typical usage scenarios.
      Return the result as a JSON array of test cases with description, code, and expectedResult.
      
      Code to analyze:
      ${code}
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    try {
      return JSON.parse(response.text)
    } catch (error) {
      console.error('Failed to parse test cases:', error)
      return []
    }
  }

  private createTestFile(sourceCode: string, testCases: TestCase[], filePath: string): string {
    const fileName = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '')
    
    return `
      import { ${fileName} } from '${filePath}'
      
      describe('${fileName}', () => {
        ${testCases.map(testCase => `
          test('${testCase.description}', () => {
            ${testCase.code}
            expect(result).toEqual(${JSON.stringify(testCase.expectedResult)})
          })
        `).join('\n')}
      })
    `
  }

  private async saveTestFile(testCode: string, sourcePath: string): Promise<void> {
    const dir = sourcePath.split('/').slice(0, -1).join('/')
    const fileName = sourcePath.split('/').pop()?.replace(/\.[^/.]+$/, '')
    const testDir = join(dir, '__tests__')
    
    try {
      await mkdir(testDir, { recursive: true })
      await writeFile(
        join(testDir, `${fileName}.test.ts`),
        testCode,
        'utf-8'
      )
    } catch (error) {
      console.error('Failed to save test file:', error)
      throw error
    }
  }

  async runTests(testPath: string): Promise<TestResult> {
    try {
      const { stdout, stderr } = await execAsync(`jest ${testPath} --coverage`)
      
      // Parse coverage from Jest output
      const coverage = this.parseCoverage(stdout)
      
      return {
        success: !stderr,
        output: stdout,
        coverage
      }
    } catch (error: any) {
      return {
        success: false,
        output: error.message
      }
    }
  }

  private parseCoverage(output: string): TestResult['coverage'] {
    // Extract coverage information from Jest output
    const coverageMatch = output.match(/All files[^\n]*\n\s*([0-9.]+)[^0-9]*([0-9.]+)[^0-9]*([0-9.]+)[^0-9]*([0-9.]+)/)
    
    if (coverageMatch) {
      return {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4])
      }
    }
    
    return undefined
  }
} 