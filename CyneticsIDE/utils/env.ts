interface EnvVar {
  name: string
  required: boolean
  pattern?: RegExp
  example: string
}

const envVars: EnvVar[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    pattern: /^https:\/\/.+\.supabase\.co$/,
    example: 'https://your-project.supabase.co'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    example: 'your-anon-key'
  },
  {
    name: 'NEXT_PUBLIC_SOCKET_URL',
    required: true,
    pattern: /^https?:\/\/.+/,
    example: 'http://localhost:3001'
  },
  {
    name: 'GITHUB_CLIENT_ID',
    required: true,
    example: 'github-oauth-client-id'
  },
  {
    name: 'GITHUB_CLIENT_SECRET',
    required: true,
    example: 'github-oauth-client-secret'
  },
  {
    name: 'AI_SERVICE_CLAUDE_KEY',
    required: false,
    pattern: /^sk-claude-[a-zA-Z0-9]+$/,
    example: 'sk-claude-xxxx'
  },
  {
    name: 'AI_SERVICE_LLAMA_KEY',
    required: false,
    pattern: /^sk-llama-[a-zA-Z0-9]+$/,
    example: 'sk-llama-xxxx'
  },
  {
    name: 'JWT_SECRET',
    required: true,
    pattern: /.{32,}/,
    example: 'generate-a-secure-random-string'
  }
]

export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const envVar of envVars) {
    const value = process.env[envVar.name]

    if (envVar.required && !value) {
      errors.push(`Missing required environment variable: ${envVar.name}`)
      continue
    }

    if (value && envVar.pattern && !envVar.pattern.test(value)) {
      errors.push(
        `Invalid format for ${envVar.name}. Expected format: ${envVar.example}`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function generateSecureSecret(length: number = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  return Array.from(randomValues)
    .map(v => chars[v % chars.length])
    .join('')
} 