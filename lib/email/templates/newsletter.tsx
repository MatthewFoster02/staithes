import { EmailLayout, Paragraph } from "./layout";

export interface NewsletterEmailProps {
  subject: string;
  bodyMarkdown: string;
  unsubscribeUrl: string;
}

// Dead-simple markdown renderer. Newsletters are written by the host
// in a textarea — we support paragraphs (blank line), [text](url) for
// links, and **bold**. Rich-formatting frameworks would be overkill;
// HTML emails routinely strip CSS and JS anyway.
function renderInline(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  let cursor = 0;
  // Single regex with two alternatives so we walk the string left to
  // right and don't overlap matches.
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\(([^)\s]+)\)/g;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(
        <strong key={key++} style={{ fontWeight: 600 }}>
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined && match[3] !== undefined) {
      parts.push(
        <a key={key++} href={match[3]} style={{ color: "#0a0a0a", textDecoration: "underline" }}>
          {match[2]}
        </a>,
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function NewsletterEmail({
  subject,
  bodyMarkdown,
  unsubscribeUrl,
}: NewsletterEmailProps) {
  // Split on blank lines for paragraph breaks. Each non-empty block
  // becomes a Paragraph; markdown formatting renders inline.
  const blocks = bodyMarkdown
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return (
    <EmailLayout
      preview={subject}
      heading={subject}
      footer={
        <>
          You&rsquo;re getting this because you opted in when you booked
          with us.
          <br />
          <a href={unsubscribeUrl} style={{ color: "#525252" }}>
            Unsubscribe
          </a>
        </>
      }
    >
      {blocks.map((block, i) => (
        <Paragraph key={i}>{renderInline(block)}</Paragraph>
      ))}
    </EmailLayout>
  );
}
