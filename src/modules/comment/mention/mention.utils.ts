export function extractMentionedUserIds(content: string): string[] {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const ids = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    ids.add(match[2]); // match[2] = userId
  }
  return Array.from(ids);
}
 
// Strip mention syntax to plain text for activity log previews
export function stripMentionSyntax(content: string): string {
  return content.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
}
 