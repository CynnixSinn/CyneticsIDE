import { useState, useEffect } from 'react'
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiCode, FiLock } from 'react-icons/fi'
import { CodeAnalysisService } from '@/services/codeAnalysis'
import type { CodeMetrics, CodeIssue } from '@/services/codeAnalysis'

interface CodeAnalysisProps {
  code: string
  language: string
}

export default function CodeAnalysis({ code, language }: CodeAnalysisProps) {
  const [metrics, setMetrics] = useState<CodeMetrics | null>(null)
  const [issues, setIssues] = useState<CodeIssue[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState<'metrics' | 'issues' | 'suggestions'>('metrics')
  const analysis = CodeAnalysisService.getInstance()

  useEffect(() => {
    analyzeCode()
  }, [code, language])

  async function analyzeCode() {
    setIsAnalyzing(true)
    try {
      const results = await analysis.analyzeCode(code, language)
      setMetrics(results.metrics)
      setIssues(results.issues)
      setSuggestions(results.suggestions)
    } catch (error) {
      console.error('Code analysis failed:', error)
    }
    setIsAnalyzing(false)
  }

  function getMetricColor(value: number): string {
    if (value >= 80) return 'text-green-400'
    if (value >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  function getIssueSeverityColor(severity: CodeIssue['severity']): string {
    switch (severity) {
      case 'high':
        return 'bg-red-900 bg-opacity-20 border-red-500'
      case 'medium':
        return 'bg-yellow-900 bg-opacity-20 border-yellow-500'
      case 'low':
        return 'bg-blue-900 bg-opacity-20 border-blue-500'
      default:
        return 'bg-gray-900 bg-opacity-20 border-gray-500'
    }
  }

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Code Analysis</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`p-2 rounded ${
              activeTab === 'metrics'
                ? 'bg-white bg-opacity-10'
                : 'hover:bg-white hover:bg-opacity-5'
            }`}
            title="Quality Metrics"
          >
            <FiActivity size={20} />
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`p-2 rounded ${
              activeTab === 'issues'
                ? 'bg-white bg-opacity-10'
                : 'hover:bg-white hover:bg-opacity-5'
            }`}
            title="Issues"
          >
            <FiAlertTriangle size={20} />
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`p-2 rounded ${
              activeTab === 'suggestions'
                ? 'bg-white bg-opacity-10'
                : 'hover:bg-white hover:bg-opacity-5'
            }`}
            title="Suggestions"
          >
            <FiCode size={20} />
          </button>
        </div>
      </div>

      {isAnalyzing ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : (
        <>
          {activeTab === 'metrics' && metrics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white bg-opacity-5 rounded">
                  <div className="text-sm font-medium mb-1">Complexity</div>
                  <div className={getMetricColor(metrics.complexity)}>
                    {metrics.complexity}/100
                  </div>
                </div>
                <div className="p-3 bg-white bg-opacity-5 rounded">
                  <div className="text-sm font-medium mb-1">Maintainability</div>
                  <div className={getMetricColor(metrics.maintainability)}>
                    {metrics.maintainability}/100
                  </div>
                </div>
                <div className="p-3 bg-white bg-opacity-5 rounded">
                  <div className="text-sm font-medium mb-1">Testability</div>
                  <div className={getMetricColor(metrics.testability)}>
                    {metrics.testability}/100
                  </div>
                </div>
                <div className="p-3 bg-white bg-opacity-5 rounded">
                  <div className="text-sm font-medium mb-1">Security</div>
                  <div className={getMetricColor(metrics.security)}>
                    {metrics.security}/100
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'issues' && (
            <div className="space-y-2">
              {issues.map((issue, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border ${getIssueSeverityColor(
                    issue.severity
                  )}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        {issue.type === 'security' && <FiLock className="mr-2" />}
                        <span className="font-medium">{issue.type}</span>
                      </div>
                      <div className="text-sm mt-1">{issue.description}</div>
                    </div>
                    <div className="text-xs uppercase">
                      {issue.severity}
                    </div>
                  </div>
                  {issue.suggestion && (
                    <div className="mt-2 text-sm text-green-400">
                      <FiCheckCircle className="inline-block mr-1" />
                      {issue.suggestion}
                    </div>
                  )}
                  {issue.line && (
                    <div className="mt-2 text-xs text-gray-400">
                      Line {issue.line}
                      {issue.column && `, Column ${issue.column}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'suggestions' && (
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-3 bg-white bg-opacity-5 rounded text-sm"
                >
                  <FiCode className="inline-block mr-2" />
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
} 