/**
 * Pure functions for building GitHub issue content from feedback submissions.
 */

export function buildIssueTitle(category, title) {
  return `[${category}] ${title}`;
}

export function buildGithubIssueBody(description, meta, snapshot, timestamp) {
  const metaBlock = [
    `**View:** ${meta.view || 'unknown'}`,
    `**App version:** ${meta.appVersion || 'unknown'}`,
    `**Platform:** ${meta.platform || 'unknown'}`,
    `**Viewport:** ${meta.viewport || 'unknown'}`,
    `**Standalone PWA:** ${meta.standalone ?? 'unknown'}`,
    `**User agent:** ${meta.userAgent || 'unknown'}`,
    `**Submitted:** ${timestamp}`,
  ].join('\n');

  let body = `${description}\n\n---\n\n${metaBlock}`;

  if (snapshot !== undefined) {
    body += `\n\n<details>\n<summary>App data snapshot</summary>\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\`\n</details>`;
  }

  return body;
}
