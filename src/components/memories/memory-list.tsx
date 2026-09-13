"use client";

import { useEffect, useState } from "react";
import type { Memory } from "@prisma/client";
import { useMemories } from "@/contexts";
import { MemoryCard } from "./memory-card";
import { MemoryForm } from "./memory-form";
import { Modal } from "@/components/shared/modal";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonCard } from "@/components/shared/loading-state";

interface MemoryListProps {
  projectId: string;
}

export function MemoryList({ projectId }: MemoryListProps) {
  const { memories, loading, error, fetchMemories } = useMemories();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);

  useEffect(() => {
    void fetchMemories(projectId);
  }, [projectId, fetchMemories]);

  function handleMemoryCreated() {
    setIsCreateOpen(false);
  }

  function handleMemoryUpdated() {
    setEditingMemory(null);
  }

  return (
    <div className="space-y-4">
      {/* Memories header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Project Memories ({memories.length})
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Persistent decisions, requirements, conventions, and bug solutions.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Memory
        </button>
      </div>

      {/* Content states */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load memories"
          message={error}
          onRetry={() => fetchMemories(projectId)}
        />
      ) : memories.length === 0 ? (
        <EmptyState
          title="No memories recorded yet"
          description="Capture your first architectural decision or rule for this project."
          actionLabel="Add Memory"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={(mem) => setEditingMemory(mem)}
              onUpdated={handleMemoryUpdated}
            />
          ))}
        </div>
      )}

      {/* Create Memory Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Project Memory"
      >
        <MemoryForm
          projectId={projectId}
          onSuccess={handleMemoryCreated}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      {/* Edit Memory Modal */}
      <Modal
        isOpen={!!editingMemory}
        onClose={() => setEditingMemory(null)}
        title="Edit Memory"
      >
        {editingMemory && (
          <MemoryForm
            projectId={projectId}
            memory={editingMemory}
            onSuccess={handleMemoryUpdated}
            onCancel={() => setEditingMemory(null)}
          />
        )}
      </Modal>
    </div>
  );
}
