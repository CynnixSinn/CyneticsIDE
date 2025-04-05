import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserProfile = {
  id: string
  email: string
  full_name: string
  avatar_url: string
  created_at: string
  preferences: Record<string, any>
}

export type Project = {
  id: string
  name: string
  description: string
  owner_id: string
  created_at: string
  updated_at: string
  is_public: boolean
  settings: Record<string, any>
}

export type File = {
  id: string
  project_id: string
  name: string
  path: string
  content: string
  language: string
  last_modified: string
  created_by: string
} 