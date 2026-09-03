"use client";

import { CopyButton } from "./copy-button";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export function CodeBlock({ code, language = "bash", filename }: CodeBlockProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 text-zinc-100 shadow-xs dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5 text-xs text-zinc-400">
        <span className="font-mono text-[11px] text-zinc-300">
          {filename || language}
        </span>
        <CopyButton textToCopy={code} label="Copy" />
      </div>
      <div className="p-3.5 overflow-x-auto">
        <pre className="font-mono text-xs leading-relaxed text-zinc-200 select-all">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
