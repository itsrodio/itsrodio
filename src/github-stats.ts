import { PROFILE_CONFIG as cfg } from './profile.config.js';
import type { GithubStatsData, GithubStatsValue } from './types.js';

const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function fetchAllTimeContributions(username: string, createdYear: number): Promise<number> {
  const currentYear = new Date().getUTCFullYear();
  const startYear = Math.max(2008, Math.min(createdYear, currentYear));
  const years: number[] = [];
  for (let y = startYear; y <= currentYear; y++) {
    years.push(y);
  }

  const counts = await Promise.all(
    years.map(async (y) => {
      try {
        const res = await fetchWithTimeout(
          `https://github.com/users/${encodeURIComponent(username)}/contributions?from=${y}-01-01&to=${y}-12-31`
        );
        if (!res.ok) return 0;
        const html = await res.text();
        const match = html.match(/(\d[\d,]*)\s+contributions?/i);
        return match?.[1] ? Number(match[1].replace(/,/g, '')) : 0;
      } catch {
        return 0;
      }
    })
  );

  return counts.reduce((sum, n) => sum + n, 0);
}

async function fetchHtmlFallbackStats(username: string): Promise<GithubStatsData> {
  const [allTimeContribs, html] = await Promise.all([
    fetchAllTimeContributions(username, 2024),
    fetchWithTimeout(`https://github.com/${encodeURIComponent(username)}?tab=repositories`)
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''),
  ]);

  const reposMatch = html.match(/Repositories[\s\S]{0,200}?Counter[^>]*>(\d[\d,]*)/i);
  const repos = reposMatch?.[1] ? Number(reposMatch[1].replace(/,/g, '')) : 0;

  const starMatches = [...html.matchAll(/\/stargazers"[^>]*>[\s\S]{0,200}?(\d[\d,]*)\s*<\/a>/gi)];
  const stars = starMatches.reduce(
    (sum, m) => sum + (m[1] ? Number(m[1].replace(/,/g, '')) : 0),
    0
  );

  const followersMatch = html.match(/(\d[\d,]*)\s*<\/span>\s*followers/i);
  const followers = followersMatch?.[1] ? Number(followersMatch[1].replace(/,/g, '')) : 0;

  return {
    repos,
    stars,
    commits: allTimeContribs,
    followers,
  };
}

export async function fetchGithubStats(username: string): Promise<GithubStatsData | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': `${username}-profile-readme-generator`,
  };
  const token = process.env.GH_STATS_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    // Try GraphQL first if a token is available to get private + public repos & contributions in one call
    if (token) {
      const gqlQuery = {
        query: `query($login: String!) {
          viewer {
            login
            repositories(ownerAffiliations: [OWNER]) {
              totalCount
            }
          }
          user(login: $login) {
            createdAt
            followers { totalCount }
            repositories(ownerAffiliations: [OWNER], first: 100) {
              totalCount
              nodes { stargazerCount }
            }
            contributionsCollection {
              totalCommitContributions
              restrictedContributionsCount
            }
          }
        }`,
        variables: { login: username },
      };

      const gqlRes = await fetchWithTimeout('https://api.github.com/graphql', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(gqlQuery),
      });

      if (gqlRes.ok) {
        const gqlJson = (await gqlRes.json()) as {
          data?: {
            viewer?: {
              login?: string;
              repositories?: { totalCount?: number };
            };
            user?: {
              createdAt?: string;
              followers?: { totalCount?: number };
              repositories?: { totalCount?: number; nodes?: Array<{ stargazerCount?: number }> };
              contributionsCollection?: {
                totalCommitContributions?: number;
                restrictedContributionsCount?: number;
              };
            };
          };
        };

        const u = gqlJson.data?.user;
        const v = gqlJson.data?.viewer;
        if (u) {
          const createdYear = u.createdAt ? new Date(u.createdAt).getUTCFullYear() : 2024;
          const allTimeContribs = await fetchAllTimeContributions(username, createdYear);
          const yearlyContribs =
            (u.contributionsCollection?.totalCommitContributions ?? 0) +
            (u.contributionsCollection?.restrictedContributionsCount ?? 0);
          const stars = (u.repositories?.nodes ?? []).reduce(
            (acc, r) => acc + (r.stargazerCount ?? 0),
            0
          );
          const viewerRepos =
            v?.login?.toLowerCase() === username.toLowerCase()
              ? (v.repositories?.totalCount ?? 0)
              : 0;

          return {
            repos: Math.max(u.repositories?.totalCount ?? 0, viewerRepos),
            stars,
            commits: Math.max(allTimeContribs, yearlyContribs),
            followers: u.followers?.totalCount ?? 0,
          };
        }
      }
    }

    const [userRes, reposRes, commitsRes] = await Promise.all([
      fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
      fetchWithTimeout(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner`,
        { headers }
      ),
      fetchWithTimeout(
        `https://api.github.com/search/commits?q=author:${encodeURIComponent(username)}`,
        { headers }
      ),
    ]);

    if (!userRes.ok || !reposRes.ok) {
      return fetchHtmlFallbackStats(username);
    }

    const userData = (await userRes.json()) as {
      public_repos?: number;
      total_private_repos?: number;
      followers?: number;
      created_at?: string;
    };
    const reposData = (await reposRes.json()) as Array<{ stargazers_count?: number }>;

    const createdYear = userData.created_at ? new Date(userData.created_at).getUTCFullYear() : 2024;
    const allTimeContribs = await fetchAllTimeContributions(username, createdYear);

    let searchCommitsTotal = 0;
    if (commitsRes.ok) {
      const commitsData = (await commitsRes.json()) as { total_count?: number };
      searchCommitsTotal = commitsData.total_count ?? 0;
    }

    const stars = Array.isArray(reposData)
      ? reposData.reduce((acc, r) => acc + (r.stargazers_count ?? 0), 0)
      : 0;

    const totalRepos =
      (userData.public_repos ?? reposData.length) + (userData.total_private_repos ?? 0);

    return {
      repos: totalRepos,
      stars,
      commits: Math.max(allTimeContribs, searchCommitsTotal),
      followers: userData.followers ?? 0,
    };
  } catch (err) {
    console.warn('Could not fetch live GitHub stats, using fallback:', err);
    return fetchHtmlFallbackStats(username);
  }
}

export function formatGithubStats(config: GithubStatsValue, stats: GithubStatsData | null): string {
  const username = config.username ?? cfg.githubUsername;
  if (!stats) {
    return `@${username}`;
  }

  const metrics = config.metrics ?? ['repos', 'stars', 'commits'];
  const parts: string[] = [];
  const effectiveRepos = Math.max(stats.repos, config.minRepos ?? 0);

  for (const m of metrics) {
    if (m === 'repos' && effectiveRepos > 0) parts.push(`${effectiveRepos} repos`);
    if (m === 'stars' && stats.stars > 0) parts.push(`${stats.stars} ★`);
    if (m === 'commits' && stats.commits > 0) parts.push(`${stats.commits} commits`);
    if (m === 'contributions' && stats.commits > 0) parts.push(`${stats.commits} contributions`);
    if (m === 'followers' && stats.followers > 0) parts.push(`${stats.followers} followers`);
  }

  return parts.length > 0 ? parts.join(' · ') : `@${username}`;
}
