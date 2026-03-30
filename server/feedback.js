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
    const snapshotStr = JSON.stringify(snapshot, null, 2);
    const snapshotBlock = `\n\n<details>\n<summary>App data snapshot</summary>\n\n\`\`\`json\n${snapshotStr}\n\`\`\`\n</details>`;
    // GitHub issue body limit is 65536 chars — include snapshot only if it fits
    if (body.length + snapshotBlock.length <= 65536) {
      body += snapshotBlock;
    }
  }

  return body;
}
