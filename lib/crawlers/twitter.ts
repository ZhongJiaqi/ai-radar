import type { RawArticle } from '../types'

interface TwitterResponse {
  data?: Array<{
    id: string
    text: string
    created_at: string
  }>
  meta?: { result_count: number }
}

interface TwitterUserResponse {
  data?: { id: string; name: string; username: string }
}

const TWEET_MIN_LENGTH = 100 // Skip very short tweets (replies, retweets)

export async function crawlTwitterUser(
  username: string,
  sourceName: string,
  sourceSlug: string
): Promise<RawArticle[]> {
  const token = process.env.TWITTER_BEARER_TOKEN
  if (!token) {
    console.warn(`[Twitter] No TWITTER_BEARER_TOKEN set, skipping ${username}`)
    return []
  }

  const headers = { Authorization: `Bearer ${token}` }

  try {
    // Get user ID
    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${username}`,
      { headers }
    )
    if (!userRes.ok) return []
    const userData: TwitterUserResponse = await userRes.json()
    if (!userData.data?.id) return []

    const userId = userData.data.id
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    // Get recent tweets
    const tweetsRes = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?` +
      `max_results=20&tweet.fields=created_at,text&` +
      `start_time=${since}&` +
      `exclude=retweets,replies`,
      { headers }
    )
    if (!tweetsRes.ok) return []

    const tweetsData: TwitterResponse = await tweetsRes.json()
    if (!tweetsData.data) return []

    return tweetsData.data
      .filter(t => t.text.length >= TWEET_MIN_LENGTH)
      .map(tweet => ({
        source_slug: sourceSlug,
        source_name: sourceName,
        title: tweet.text.slice(0, 120) + (tweet.text.length > 120 ? '…' : ''),
        url: `https://twitter.com/${username}/status/${tweet.id}`,
        content: tweet.text,
        author: username,
        published_at: new Date(tweet.created_at),
      }))
  } catch (err) {
    console.error(`[Twitter] Failed for @${username}:`, err)
    return []
  }
}
