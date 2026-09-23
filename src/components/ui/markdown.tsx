import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders AI/user Markdown safely: raw HTML is not rendered, links open in a new tab without referrer. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-fluxa">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => (/^(https?:|mailto:|\/|#)/i.test(url) ? url : "")}
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
