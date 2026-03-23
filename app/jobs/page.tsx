import fs from 'node:fs/promises'
import path from 'node:path'
import { createPublicClient } from '@/lib/supabase'
import JobsClient, { type JobsLinkSection } from './JobsClient'
import type { EnrichedJobPost } from '@/lib/types'

export const revalidate = 300 // 5 minutes

function parseJobsMd(md: string): JobsLinkSection[] {
  const lines = md.split(/\r?\n/)
  const sections: JobsLinkSection[] = []
  let current: JobsLinkSection | null = null

  const pushCurrent = () => {
    if (current && current.items.length > 0) sections.push(current)
    current = null
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const h2 = line.match(/^##\s+(.+)$/)
    if (h2) {
      pushCurrent()
      current = { title: h2[1].trim(), items: [] }
      continue
    }

    const bullet = line.match(/^-+\s+(.+)$/)
    if (bullet && current) {
      const text = bullet[1]
      const urlMatch = text.match(/招聘:\s*(https?:\/\/\S+)/i)
      if (!urlMatch) continue
      const url = urlMatch[1].replace(/[)\]]+$/, '')
      const name = text.split('—')[0].trim()
      current.items.push({ name, url })
    }
  }

  pushCurrent()
  return sections
}

async function getCompanyLinks(): Promise<JobsLinkSection[]> {
  try {
    const file = path.join(process.cwd(), 'jobs.md')
    const md = await fs.readFile(file, 'utf8')
    return parseJobsMd(md)
  } catch (err) {
    console.error('[Jobs] Failed to read jobs.md:', err)
    return []
  }
}

async function getJobPosts(): Promise<EnrichedJobPost[]> {
  const supabase = createPublicClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('enriched_job_posts')
    .select('*')
    .or(`posted_at.gte.${since},crawled_at.gte.${since}`)
    .order('hot_score', { ascending: false })
    .order('posted_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[Jobs] Failed to fetch job posts:', error)
    return []
  }

  return data || []
}

export default async function JobsPage() {
  const [sections, posts] = await Promise.all([getCompanyLinks(), getJobPosts()])
  return <JobsClient sections={sections} initialPosts={posts} />
}

