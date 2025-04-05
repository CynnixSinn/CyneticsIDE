import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

self.onmessage = async (event) => {
  const { command, cwd, env } = event.data

  try {
    const { stdout, stderr } = await execAsync(command, { cwd, env })
    
    self.postMessage({
      command,
      output: stdout || stderr,
      exitCode: stderr ? 1 : 0
    })
  } catch (error: any) {
    self.postMessage({
      command,
      output: error.message,
      exitCode: error.code || 1
    })
  }
} 