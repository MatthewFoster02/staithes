// Renders a <script type="application/ld+json"> tag with the given
// payload. Accepts one object or an array (rendered as multiple tags
// with the same "seo:" prefix for keys so React doesn't warn about
// missing keys inside a fragment).
//
// We use dangerouslySetInnerHTML because Google's crawler expects the
// JSON to live inside a text node, not as an attribute. `replace` of
// `<` blocks the one XSS vector — unescaped `</script>` inside the
// payload.

interface JsonLdProps {
  payload: unknown | unknown[];
  id?: string;
}

function serialise(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function JsonLd({ payload, id = "jsonld" }: JsonLdProps) {
  const items = Array.isArray(payload) ? payload : [payload];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={`${id}-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialise(item) }}
        />
      ))}
    </>
  );
}
