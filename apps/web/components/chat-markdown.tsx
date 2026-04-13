"use client";

import ReactMarkdown from "react-markdown";

type ChatMarkdownBodyProps = {
  text: string;
  /** 추가 Tailwind 유틸(버블 배경에 맞는 링크·코드 색 등) */
  className?: string;
};

const baseProse =
  "chat-markdown text-[0.9375rem] leading-relaxed [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_ul]:my-1.5 [&_ol]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_strong]:font-semibold [&_a]:break-all [&_a]:underline [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] " +
  "[&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-[0.8em] " +
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-3 [&_blockquote]:opacity-90 " +
  "[&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold " +
  "[&_h3]:mb-1 [&_h3]:mt-1.5 [&_h3]:text-sm [&_h3]:font-semibold";

export function ChatMarkdownBody({ text, className = "" }: ChatMarkdownBodyProps) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return (
    <div className={`${baseProse} ${className}`.trim()}>
      <ReactMarkdown>{trimmed}</ReactMarkdown>
    </div>
  );
}
