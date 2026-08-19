import { readFileSync, writeFileSync } from "node:fs";

const user = process.env.GH_USER;
const token = process.env.GH_TOKEN;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
};

const api = (path) =>
  fetch(`https://api.github.com/${path}`, { headers }).then((r) => r.json());

const graphql = (query) =>
  fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
    .then((r) => r.json())
    .then((d) => d.data);

const userResp = await api(`users/${user}`);
const publicRepos = userResp.public_repos;
const followers = userResp.followers;

const repos = await api(`users/${user}/repos?per_page=100`);

const totalRepos = publicRepos;

let contributions = 0;
try {
  const gql = await graphql(`{
    user(login: "${user}") {
      contributionsCollection {
        contributionCalendar { totalContributions }
      }
    }
  }`);
  contributions =
    gql.user.contributionsCollection.contributionCalendar.totalContributions;
} catch {
  contributions = 0;
}

let totalStars = 0;
for (const r of repos) totalStars += r.stargazers_count ?? 0;

const langCount = {};
for (const r of repos) {
  const lang = r.language;
  if (lang) langCount[lang] = (langCount[lang] ?? 0) + 1;
}

const sorted = Object.entries(langCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

const max = sorted[0]?.[1] ?? 1;
const bar = 20;

const langLines = sorted
  .map(([lang, count]) => {
    const filled = Math.round((count / max) * bar);
    const empty = bar - filled;
    const name = (lang.length > 11 ? lang.split(" ")[0] : lang).padEnd(11).slice(0, 11);
    const countStr = String(count).padStart(2);
    return `│  ${name} ${"█".repeat(filled)}${"░".repeat(empty)}  ${countStr}                        │`;
  })
  .join("\n");

const statsBlock = `<!-- STATS:START -->
\`\`\`text
┌──────────────────────────────────────────────────────────────┐
│  GitHub Stats                                                │
├──────────────────────────────────────────────────────────────┤
│  Repositories:     ${String(totalRepos).padStart(3)}                                       │
│  Contributions:    ${String(contributions).padStart(3)}                                       │
│  Stars:            ${String(totalStars).padStart(3)}                                       │
│  Followers:        ${String(followers).padStart(3)}                                       │
│                                                              │
│  Languages (by repos):                                       │
${langLines}
└──────────────────────────────────────────────────────────────┘
\`\`\`
<!-- STATS:END -->`;

const readme = readFileSync("README.md", "utf8");
const replaced = readme.replace(
  /<!-- STATS:START -->[\s\S]*?<!-- STATS:END -->/,
  statsBlock,
);

writeFileSync("README.md", replaced);
console.log("README.md updated with fresh stats.");
