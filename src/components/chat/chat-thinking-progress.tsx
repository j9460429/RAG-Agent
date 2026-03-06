"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Globe, Brain, Sparkles, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface ChatThinkingProgressProps {
  readonly isLoading: boolean;
  readonly mode?: "search" | "default";
}

// ─── Constants ────────────────────────────────────────────────

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface ThinkingStep {
  readonly threshold: number;
  readonly label: string;
  readonly Icon: LucideIcon;
}

const DEFAULT_STEPS: readonly ThinkingStep[] = [
  { threshold: 0, label: "解析問題", Icon: Search },
  { threshold: 3, label: "搜尋知識庫", Icon: Globe },
  { threshold: 8, label: "分析資訊", Icon: Brain },
  { threshold: 15, label: "生成回答", Icon: Sparkles },
];

const SEARCH_STEPS: readonly ThinkingStep[] = [
  { threshold: 0, label: "解析問題", Icon: Search },
  { threshold: 3, label: "搜尋網路資源", Icon: Globe },
  { threshold: 8, label: "分析搜尋結果", Icon: Brain },
  { threshold: 15, label: "整合回答", Icon: Sparkles },
];

// ─── Internal Components ──────────────────────────────────────

function BrailleSpinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setFrame((f) => (f + 1) % BRAILLE_FRAMES.length),
      80,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-blue-400 dark:text-blue-300 font-mono w-3 inline-block text-center">
      {BRAILLE_FRAMES[frame]}
    </span>
  );
}

function ElapsedTimer({ startedAt }: { readonly startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <span className="font-mono text-xs text-gray-400 dark:text-gray-500 tabular-nums">
      {formatted}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function ChatThinkingProgress({
  isLoading,
  mode = "default",
}: ChatThinkingProgressProps) {
  const startedAtRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const steps = mode === "search" ? SEARCH_STEPS : DEFAULT_STEPS;

  // Reset when loading starts
  useEffect(() => {
    if (isLoading) {
      startedAtRef.current = Date.now();
      setElapsed(0);
      setIsComplete(false);
    }
  }, [isLoading]);

  // Tick elapsed
  useEffect(() => {
    if (!isLoading) {
      setIsComplete(true);
      return;
    }

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLoading]);

  const visibleSteps = isComplete
    ? steps
    : steps.filter((s) => elapsed >= s.threshold);
  const currentStepIndex = visibleSteps.length - 1;

  return (
    <div className="w-full py-1 transition-colors duration-500">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        {isComplete ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <span className="text-sm">💭</span>
        )}
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {isComplete ? "思考完成" : "思考中"}
        </span>
        <ElapsedTimer startedAt={startedAtRef.current} />
      </div>

      {/* Steps */}
      <div className="space-y-0">
        <AnimatePresence mode="popLayout">
          {visibleSteps.map((step, index) => {
            const isDone = isComplete || index < currentStepIndex;
            const isActive = !isComplete && index === currentStepIndex;

            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -8, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex items-center gap-2.5 py-1.5 font-mono text-xs"
              >
                {/* Status icon */}
                <div className="w-3.5 flex-shrink-0 flex items-center justify-center">
                  {isDone && (
                    <span className="text-green-500 dark:text-green-400">
                      ✓
                    </span>
                  )}
                  {isActive && <BrailleSpinner />}
                </div>

                {/* Step icon */}
                <step.Icon
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isDone
                      ? "text-green-500/60 dark:text-green-400/50"
                      : isActive
                        ? "text-blue-500 dark:text-blue-400"
                        : "text-gray-400"
                  }`}
                />

                {/* Label */}
                <span
                  className={
                    isDone
                      ? "text-gray-400 dark:text-gray-500"
                      : isActive
                        ? "text-blue-600 dark:text-blue-300"
                        : "text-gray-400"
                  }
                >
                  {step.label}
                  {isActive && (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="ml-0.5"
                    >
                      ...
                    </motion.span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
