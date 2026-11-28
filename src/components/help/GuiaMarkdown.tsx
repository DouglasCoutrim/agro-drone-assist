import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type GuiaMarkdownProps = {
  /** Conteúdo em markdown do artigo da Central de Ajuda. */
  children: string;
  className?: string;
};

/**
 * Renderiza o texto dos guias com formatação explícita.
 *
 * O projeto tem `@tailwindcss/typography` instalado, mas o plugin não está
 * habilitado no tailwind.config — as classes `prose` não fazem efeito. Por isso
 * cada elemento é estilizado aqui, com Tailwind, garantindo títulos, listas e
 * tabelas legíveis em tema claro e escuro.
 */
export function GuiaMarkdown({ children, className = "" }: GuiaMarkdownProps) {
  return (
    <div className={`text-[13.5px] leading-relaxed text-foreground/90 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children: content }) => (
            <h2 className="mt-8 mb-3 border-b border-border pb-2 font-display text-lg font-bold tracking-tight first:mt-0">
              {content}
            </h2>
          ),
          h2: ({ children: content }) => (
            <h2 className="mt-8 mb-3 border-b border-border pb-2 font-display text-lg font-bold tracking-tight first:mt-0">
              {content}
            </h2>
          ),
          h3: ({ children: content }) => (
            <h3 className="mt-5 mb-2 font-display text-[15px] font-semibold">{content}</h3>
          ),
          h4: ({ children: content }) => (
            <h4 className="mt-4 mb-1.5 text-sm font-semibold">{content}</h4>
          ),
          p: ({ children: content }) => <p className="my-2.5">{content}</p>,
          strong: ({ children: content }) => (
            <strong className="font-semibold text-foreground">{content}</strong>
          ),
          em: ({ children: content }) => <em className="italic">{content}</em>,
          a: ({ children: content, href }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              {content}
            </a>
          ),
          ul: ({ children: content }) => (
            <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-primary/70">{content}</ul>
          ),
          ol: ({ children: content }) => (
            <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-primary">
              {content}
            </ol>
          ),
          li: ({ children: content }) => <li className="pl-0.5">{content}</li>,
          code: ({ children: content }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">{content}</code>
          ),
          pre: ({ children: content }) => (
            <pre className="my-3 overflow-x-auto rounded-xl border border-border bg-muted/60 p-3 text-[12px]">
              {content}
            </pre>
          ),
          table: (props: ComponentProps<"table">) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-left text-[13px]" {...props} />
            </div>
          ),
          th: (props: ComponentProps<"th">) => (
            <th
              className="border-b border-border bg-muted/60 p-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              {...props}
            />
          ),
          td: (props: ComponentProps<"td">) => (
            <td className="border-b border-border/60 p-2.5 align-top" {...props} />
          ),
          hr: () => <hr className="my-6 border-border" />,
          blockquote: ({ children: content }) => (
            <blockquote className="my-3 rounded-r-lg border-l-4 border-primary/40 bg-muted/40 py-2 pl-4 italic text-muted-foreground">
              {content}
            </blockquote>
          ),
          img: (props: ComponentProps<"img">) => (
            <img
              {...props}
              alt={props.alt ?? "Imagem do guia"}
              className="my-3 rounded-lg border border-border"
            />
          ),
          iframe: (props: ComponentProps<"iframe">) => (
            <iframe
              {...props}
              title={props.title || "Conteúdo incorporado"}
              className="my-3 aspect-video w-full rounded-lg border border-border"
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
