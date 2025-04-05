import { generateSecureSecret } from '../utils/env'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

function generateSecrets() {
  const envPath = join(process.cwd(), '.env.local')
  let envContent: string

  try {
    envContent = readFileSync(envPath, 'utf-8')
  } catch {
    envContent = readFileSync(join(process.cwd(), '.env.example'), 'utf-8')
  }

  // Generate new secrets
  const newSecrets = {
    JWT_SECRET: generateSecureSecret(48),
    ENCRYPTION_KEY: generateSecureSecret(32)
  }

  // Replace placeholders with generated values
  const updatedContent = envContent.replace(
    /^(JWT_SECRET|ENCRYPTION_KEY)=.+$/gm,
    (match, key) => `${key}=${newSecrets[key as keyof typeof newSecrets]}`
  )

  // Write updated content back to .env.local
  writeFileSync(envPath, updatedContent)

  console.log('Generated new secure secrets:')
  console.log(JSON.stringify(newSecrets, null, 2))
}

generateSecrets() 