import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  children: string;
  className?: string;
}

/**
 * Renders assistant markdown safely: react-markdown escapes raw HTML, so no
 * dangerouslySetInnerHTML anywhere in the chat path.
 */
export function MarkdownText({ children, className }: Props) {
  return (
    <div className={`md ${className ?? ''}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: label }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
