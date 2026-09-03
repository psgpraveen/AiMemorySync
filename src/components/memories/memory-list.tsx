"use client";

import { useEffect, useState, useCallback } from "react";
import type { Memory } from "@prisma/client";
import { getProjectMemories, ApiError } from "@/lib/api-client";
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
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(
    null
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectMemories(projectId);
      setMemories(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message, code: err.code });
      } else {
        setError({ message: "Failed to load project memories." });
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let isMounted = true;
    getProjectMemories(projectId)
      .then((data) => {
        if (isMounted) {
          setMemories(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError({ message: err.message, code: err.code });
          } else {
            setError({ message: "Failed to load project memories." });
          }
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  function handleMemoryCreated(newMemory: Memory) {
    setIsCreateOpen(false);
    // Add new memory to the top of the list
    setMemories((prev) => [newMemory, ...prev]);
  }

  function handleMemoryUpdated(updated: Memory) {
    setEditingMemory(null);
    setMemories((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    );
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
          message={error.message}
          code={error.code}
          onRetry={fetchMemories}
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
