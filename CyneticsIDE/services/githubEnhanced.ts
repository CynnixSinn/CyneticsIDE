import { GitHubService } from './github'
import { AIService } from './ai'
import { Octokit } from '@octokit/rest'

interface PullRequestAnalysis {
  impact: 'high' | 'medium' | 'low'
  complexity: number
  risks: string[]
  suggestions: string[]
  affectedAreas: string[]
}

interface CodeReviewFeedback {
  comments: Array<{
    path: string
    line: number
    body: string
    type: 'suggestion' | 'issue' | 'praise'
  }>
  summary: string
  score: number
}

export class EnhancedGitHubService {
  private static instance: EnhancedGitHubService
  private githubService: GitHubService
  private aiService: AIService
  private octokit: Octokit

  private constructor() {
    this.githubService = GitHubService.getInstance()
    this.aiService = AIService.getInstance()
    this.octokit = new Octokit({
      auth: process.env.GITHUB_ACCESS_TOKEN
    })
  }

  static getInstance(): EnhancedGitHubService {
    if (!EnhancedGitHubService.instance) {
      EnhancedGitHubService.instance = new EnhancedGitHubService()
    }
    return EnhancedGitHubService.instance
  }

  async analyzePullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequestAnalysis> {
    // Get PR details
    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    })

    // Get PR changes
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    })

    const prompt = `
      Analyze this pull request:
      
      Title: ${pr.title}
      Description: ${pr.body}
      
      Changed files:
      ${files.map(f => `${f.filename} (${f.changes} changes)`).join('\n')}
      
      Provide analysis in JSON format with:
      1. Impact level (high/medium/low)
      2. Complexity score (0-100)
      3. Potential risks
      4. Suggestions for improvement
      5. Affected areas of the codebase
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async suggestReviewers(owner: string, repo: string, prNumber: number): Promise<string[]> {
    // Get repository contributors
    const { data: contributors } = await this.octokit.repos.listContributors({
      owner,
      repo
    })

    // Get PR files
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    })

    // Get file history for each changed file
    const fileHistories = await Promise.all(
      files.map(file =>
        this.octokit.repos.listCommits({
          owner,
          repo,
          path: file.filename
        })
      )
    )

    const prompt = `
      Suggest reviewers for this PR based on:
      
      Changed files:
      ${files.map(f => f.filename).join('\n')}
      
      File history:
      ${fileHistories.map(h => JSON.stringify(h.data)).join('\n')}
      
      Contributors:
      ${contributors.map(c => c.login).join('\n')}
      
      Return an array of GitHub usernames.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    return JSON.parse(response.text)
  }

  async autoReview(owner: string, repo: string, prNumber: number): Promise<CodeReviewFeedback> {
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    })

    const fileContents = await Promise.all(
      files.map(async file => {
        const { data } = await this.octokit.repos.getContent({
          owner,
          repo,
          path: file.filename,
          ref: file.sha
        })
        return {
          path: file.filename,
          content: Buffer.from(data.content, 'base64').toString()
        }
      })
    )

    const prompt = `
      Review these code changes:
      
      ${fileContents.map(f => `
        File: ${f.path}
        Content:
        ${f.content}
      `).join('\n')}
      
      Provide review feedback in JSON format with:
      1. Inline comments (including line numbers)
      2. Overall summary
      3. Quality score (0-100)
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    const feedback = JSON.parse(response.text)

    // Post review comments
    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      comments: feedback.comments,
      body: feedback.summary,
      event: feedback.score < 60 ? 'REQUEST_CHANGES' : 'APPROVE'
    })

    return feedback
  }

  async generateReleaseNotes(owner: string, repo: string, tagName: string): Promise<string> {
    // Get commits since last release
    const { data: commits } = await this.octokit.repos.listCommits({
      owner,
      repo,
      since: (await this.getLastReleaseDate(owner, repo))?.toISOString()
    })

    const prompt = `
      Generate release notes from these commits:
      
      ${commits.map(c => `${c.sha.slice(0, 7)}: ${c.commit.message}`).join('\n')}
      
      Format the notes with:
      1. Summary of changes
      2. New features
      3. Bug fixes
      4. Breaking changes
      5. Contributors
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    // Create release
    await this.octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      name: `Release ${tagName}`,
      body: response.text,
      draft: true
    })

    return response.text
  }

  private async getLastReleaseDate(owner: string, repo: string): Promise<Date | null> {
    try {
      const { data: latestRelease } = await this.octokit.repos.getLatestRelease({
        owner,
        repo
      })
      return new Date(latestRelease.created_at)
    } catch {
      return null
    }
  }

  async createWorkflowFromDescription(
    owner: string,
    repo: string,
    description: string
  ): Promise<void> {
    const prompt = `
      Create a GitHub Actions workflow from this description:
      ${description}
      
      Return the workflow in YAML format.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: `.github/workflows/generated-workflow.yml`,
      message: 'Add AI-generated workflow',
      content: Buffer.from(response.text).toString('base64')
    })
  }

  async suggestIssueLabels(owner: string, repo: string, issueNumber: number): Promise<string[]> {
    const { data: issue } = await this.octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber
    })

    const prompt = `
      Suggest labels for this issue:
      
      Title: ${issue.title}
      Description: ${issue.body}
      
      Return an array of label names.
    `

    const response = await this.aiService.makeRequest({
      model: 'claude-3',
      prompt
    })

    const labels = JSON.parse(response.text)

    // Add labels to issue
    await this.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels
    })

    return labels
  }
} 