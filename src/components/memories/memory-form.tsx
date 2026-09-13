"use client";

import { useState, type FormEvent } from "react";
import type { Memory, MemoryPriority, MemoryType } from "@prisma/client";
import { useMemories } from "@/contexts";
import { ApiError } from "@/lib/api-client";

interface MemoryFormProps {
  projectId: string;
  memory?: Memory; // If provided, edit mode; otherwise, create mode
  onSuccess: (memory: Memory) => void;
  onCancel: () => void;
}

const MEMORY_TYPES: { value: MemoryType; label: string }[] = [
  { value: "DECISION", label: "Decision (Architecture & Technology)" },
  { value: "REQUIREMENT", label: "Requirement (Rules & Invariants)" },
  { value: "CONVENTION", label: "Convention (Code & Patterns)" },
  { value: "BUG_SOLUTION", label: "Bug Solution (Fixes & Gotchas)" },
];

const MEMORY_PRIORITIES: { value: MemoryPriority; label: string }[] = [
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
];

export function MemoryForm({
  projectId,
  memory,
  onSuccess,
  onCancel,
}: MemoryFormProps) {
  const isEdit = !!memory;
  const { createMemory, updateMemory } = useMemories();

  const [type, setType] = useState<MemoryType>(memory?.type ?? "DECISION");
  const [priority, setPriority] = useState<MemoryPriority>(
    memory?.priority ?? "NORMAL"
  );
  const [title, setTitle] = useState(memory?.title ?? "");
  const [content, setContent] = useState(memory?.content ?? "");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      if (isEdit && memory) {
        const updated = await updateMemory(memory.id, {
          type,
          priority,
          title: title.trim(),
          content: content.trim(),
        });
        onSuccess(updated);
      } else {
        const created = await createMemory(projectId, {
          type,
          priority,
          title: title.trim(),
          content: content.trim(),
        });
        onSuccess(created);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "MEMORY_DUPLICATE") {
          setErrorMessage(
            "Conflict: An identical memory with this title, type, and content already exists in this project."
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="memory-type"
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            Type
          </label>
          <select
            id="memory-type"
            value={type}
            onChange={(e) => setType(e.target.value as MemoryType)}
            className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {MEMORY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="memory-priority"
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            Priority
          </label>
          <select
            id="memory-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as MemoryPriority)}
            className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {MEMORY_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="memory-title"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="memory-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Use PostgreSQL on Supabase"
          className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div>
        <label
          htmlFor="memory-content"
          className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
        >
          Content <span className="text-red-500">*</span>
        </label>
        <textarea
          id="memory-content"
          required
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Document the decision rationale, requirements, conventions, or bug resolution..."
          className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !title.trim() || !content.trim()}
          className="rounded bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Saving..." : isEdit ? "Update Memory" : "Save Memory"}
        </button>
      </div>
    </form>
  );
}
