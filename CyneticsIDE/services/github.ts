import axios from 'axios'

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string
  private: boolean
  default_branch: string
  created_at: string
  updated_at: string
}

export interface GitHubBranch {
  name: string
  commit: {
    sha: string
    url: string
  }
}

export interface GitHubCommit {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
}

export class GitHubService {
  private static instance: GitHubService
  private token: string = ''
  private baseUrl = 'https://api.github.com'

  private constructor() {}

  static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService()
    }
    return GitHubService.instance
  }

  setToken(token: string) {
    this.token = token
  }

  private get headers() {
    return {
      Authorization: `token ${this.token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  }

  async listRepositories(): Promise<GitHubRepo[]> {
    const response = await axios.get(`${this.baseUrl}/user/repos`, {
      headers: this.headers
    })
    return response.data
  }

  async createRepository(name: string, description: string, isPrivate: boolean): Promise<GitHubRepo> {
    const response = await axios.post(`${this.baseUrl}/user/repos`, {
      name,
      description,
      private: isPrivate,
      auto_init: true
    }, {
      headers: this.headers
    })
    return response.data
  }

  async listBranches(repo: string): Promise<GitHubBranch[]> {
    const response = await axios.get(`${this.baseUrl}/repos/${repo}/branches`, {
      headers: this.headers
    })
    return response.data
  }

  async createBranch(repo: string, branchName: string, fromBranch: string): Promise<void> {
    const baseRef = await axios.get(`${this.baseUrl}/repos/${repo}/git/ref/heads/${fromBranch}`, {
      headers: this.headers
    })

    await axios.post(`${this.baseUrl}/repos/${repo}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha: baseRef.data.object.sha
    }, {
      headers: this.headers
    })
  }

  async commitChanges(
    repo: string,
    branch: string,
    files: { path: string; content: string }[],
    message: string
  ): Promise<void> {
    // Get the latest commit SHA
    const ref = await axios.get(
      `${this.baseUrl}/repos/${repo}/git/ref/heads/${branch}`,
      { headers: this.headers }
    )
    const latestCommit = ref.data.object.sha

    // Create blobs for each file
    const fileBlobs = await Promise.all(
      files.map(file =>
        axios.post(`${this.baseUrl}/repos/${repo}/git/blobs`, {
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64'
        }, {
          headers: this.headers
        })
      )
    )

    // Create a tree with the new files
    const tree = await axios.post(`${this.baseUrl}/repos/${repo}/git/trees`, {
      base_tree: latestCommit,
      tree: files.map((file, index) => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: fileBlobs[index].data.sha
      }))
    }, {
      headers: this.headers
    })

    // Create a commit
    const commit = await axios.post(`${this.baseUrl}/repos/${repo}/git/commits`, {
      message,
      tree: tree.data.sha,
      parents: [latestCommit]
    }, {
      headers: this.headers
    })

    // Update the reference
    await axios.patch(
      `${this.baseUrl}/repos/${repo}/git/refs/heads/${branch}`,
      { sha: commit.data.sha },
      { headers: this.headers }
    )
  }

  async generateCommitMessage(changes: { path: string; content: string }[]): Promise<string> {
    // Use AI to generate a commit message based on the changes
    const changedFiles = changes.map(c => c.path).join(', ')
    return `Update ${changedFiles}`
  }
} 