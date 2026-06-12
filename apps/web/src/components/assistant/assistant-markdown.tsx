import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SAFE_ASSISTANT_MARKDOWN_HREFS = new Set([
  "/dashboard",
  "/customers",
  "/appointments",
  "/insights",
  "/analytics",
  "/settings",
  "/help",
  "/onboarding",
  "/needs-attention",
]);

export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) =>
            href && SAFE_ASSISTANT_MARKDOWN_HREFS.has(href) ? (
              <Link className="font-medium underline underline-offset-2" href={href}>
                {children}
              </Link>
            ) : (
              <span>{children}</span>
            ),
          h1: ({ children }) => (
            <h1 className="text-base font-semibold tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold">{children}</h3>
          ),
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border" />,
          code: ({ className, children }) => (
            <code
              className={
                className
                  ? `${className} block overflow-x-auto rounded-md bg-muted p-2 text-xs`
                  : "rounded bg-muted px-1 py-0.5 text-xs"
              }
            >
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div
              data-testid="assistant-markdown-table-scroll"
              className="overflow-x-auto"
            >
              <table className="min-w-full border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted px-2 py-1 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1">{children}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
