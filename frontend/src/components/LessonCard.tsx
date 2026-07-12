import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Play,
  X,
} from "lucide-react";
import { gloss } from "../lib/glossary";
import { LESSONS, type Lesson, type LessonKey } from "../lib/lessons";
import { listRuns } from "../lib/runStore";
import { useApp } from "../lib/store";
import { TipIcon } from "./TipIcon";

/**
 * "Learn the basics" — the guided-lessons overlay (lib/lessons.ts).
 *
 * A small dismissable card, fixed bottom-right (z-40, under the mobile
 * drawers at z-50 and clear of the phone Run-FAB via bottom-20). It is
 * NOT a separate mode: each lesson step drives the normal app through
 * the same pendingRestore/auto-run bridges scenario boots use, and the
 * card floats over whatever view that produced. Flow per lesson:
 * question → [Run it] → whatToLookFor once the run archives → next
 * step / next lesson. Lesson runs carry RunRecord.scenario = "L1"…"L4"
 * so they never pollute evidence pools (same exclusion the F-scenario
 * pickers apply).
 *
 * Run-completion detection: historyVersion bumps when the auto-run
 * archives; we then read back the lesson-tagged record (its run_id +
 * root_seed feed L2's comparison selection and L4's seed replay).
 * Progress persists in localStorage "quda.lessonsDone".
 */

const DONE_LS = "quda.lessonsDone";

function loadDone(): Set<LessonKey> {
  try {
    const raw = JSON.parse(localStorage.getItem(DONE_LS) ?? "[]");
    return new Set(Array.isArray(raw) ? (raw as LessonKey[]) : []);
  } catch {
    return new Set();
  }
}

export function LessonCard() {
  const open = useApp((s) => s.lessonsOpen);
  const setOpen = useApp((s) => s.setLessonsOpen);
  const running = useApp((s) => s.running);
  const historyVersion = useApp((s) => s.historyVersion);
  const [activeKey, setActiveKey] = useState<LessonKey | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<"ask" | "running" | "look">("ask");
  const [done, setDone] = useState<Set<LessonKey>>(loadDone);
  const baseHv = useRef(0);
  // Runs THIS lesson produced (reset on lesson switch) — L2's compare
  // step and L4's replay step resolve ids/seeds from here.
  const lessonRuns = useRef<{ run_id: string; root_seed: number | null }[]>([]);

  const lesson: Lesson | null =
    activeKey != null ? (LESSONS.find((l) => l.key === activeKey) ?? null) : null;

  const markDone = (key: LessonKey) =>
    setDone((prev) => {
      const next = new Set(prev).add(key);
      try {
        localStorage.setItem(DONE_LS, JSON.stringify([...next]));
      } catch {
        /* private mode — session-scoped progress is fine */
      }
      return next;
    });

  const pickLesson = (key: LessonKey | null) => {
    setActiveKey(key);
    setStepIdx(0);
    setPhase("ask");
    lessonRuns.current = [];
  };

  const launch = (l: Lesson, idx: number) => {
    const step = l.steps[idx];
    const first = lessonRuns.current[0];
    const app = useApp.getState();
    // Lessons run in the Pipeline editor — leave the board if needed.
    app.setWorkspaceMode("compose");
    if (step.openGateDiff) app.setGateDiffDefaultOpen(true);
    app.requestRestore({
      graph: step.graph,
      sampleKey: step.sampleKey,
      pinSeed:
        step.seed === "pinned"
          ? (step.pinSeed ?? null)
          : step.seed === "replayFirst"
            ? (first?.root_seed ?? null)
            : null,
      // replayFirst threads the ancestor's run_id → forked_from →
      // the fork edge L4 points at.
      sourceRunId: step.seed === "replayFirst" ? (first?.run_id ?? null) : null,
      precisionTarget: null,
      autoRunAfter: true,
      scenario: l.key,
    });
    if (step.evidenceTab) app.setPendingEvidenceTab(step.evidenceTab);
    if (step.expandEvidence) app.bumpHintExpandRightPane();
    baseHv.current = app.historyVersion;
    setStepIdx(idx);
    setPhase("running");
  };

  // Completion watcher — see the header comment.
  useEffect(() => {
    if (phase !== "running" || lesson == null) return;
    if (historyVersion <= baseHv.current) return;
    let cancelled = false;
    (async () => {
      const runs = await listRuns(50);
      const mine = runs
        .filter((r) => r.scenario === lesson.key)
        .sort((a, b) => b.created_at - a.created_at);
      if (cancelled) return;
      const latest = mine[0];
      if (latest)
        lessonRuns.current.push({
          run_id: latest.run_id,
          root_seed: latest.root_seed ?? null,
        });
      const step = lesson.steps[stepIdx];
      if (step.compareLessonRuns && lessonRuns.current.length >= 2) {
        const ids = lessonRuns.current.slice(-2).map((r) => r.run_id);
        const app = useApp.getState();
        app.setCompareIds(ids);
        app.setPendingEvidenceTab("compare");
        app.bumpHintExpandRightPane();
      }
      if (stepIdx === lesson.steps.length - 1) markDone(lesson.key);
      setPhase("look");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyVersion, phase, lesson, stepIdx]);

  if (!open) return null;

  const nextLesson = LESSONS.find((l) => !done.has(l.key) && l.key !== activeKey);

  return (
    <div
      className="fixed right-3 bottom-20 md:bottom-3 z-40 w-[300px] max-w-[calc(100vw-24px)] rounded-lg border border-edge bg-surface shadow-xl"
      role="dialog"
      aria-label="Guided lessons"
      data-marker="guided-lessons"
    >
      <div className="px-3 py-2 flex items-center gap-1.5 border-b border-edge/60">
        <GraduationCap className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="text-[11px] font-medium text-ink flex-1 truncate">
          {lesson ? lesson.title : "Learn the basics"}
        </span>
        {lesson && (
          <button
            type="button"
            onClick={() => pickLesson(null)}
            className="text-mute hover:text-ink p-0.5"
            title="All lessons"
            aria-label="Back to lesson list"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-mute hover:text-ink p-0.5"
          title="Close lessons"
          aria-label="Close lessons"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {lesson == null ? (
        <div className="p-2">
          {LESSONS.map((l, i) => (
            <button
              key={l.key}
              type="button"
              onClick={() => pickLesson(l.key)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-surfaceAlt transition-colors"
            >
              <span
                className={`shrink-0 w-4 h-4 rounded-full border text-[9px] flex items-center justify-center ${
                  done.has(l.key)
                    ? "border-ok/60 bg-ok/10 text-ok"
                    : "border-edge text-mute"
                }`}
                aria-hidden
              >
                {done.has(l.key) ? <Check className="w-2.5 h-2.5" /> : i + 1}
              </span>
              <span className="text-[11px] text-ink flex-1 truncate">
                {l.title}
              </span>
              <ChevronRight className="w-3 h-3 text-mute/60 shrink-0" />
            </button>
          ))}
          <p className="px-2 pt-1.5 pb-0.5 text-[9px] leading-snug text-mute/70">
            Four tiny experiments, one question each. Lesson runs are
            tagged and never count as your evidence.
          </p>
        </div>
      ) : (
        <div className="p-3">
          <p className="text-[11px] leading-snug text-ink">{lesson.question}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {lesson.terms.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 text-[9px] text-mute border border-edge/60 rounded px-1 py-px"
              >
                {t}
                <TipIcon hint={gloss(t)} size={9} />
              </span>
            ))}
          </div>
          {phase === "look" && (
            <p className="mt-2 text-[11px] leading-snug text-mute border-l-2 border-accent/50 pl-2">
              {lesson.whatToLookFor}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {phase === "running" ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-mute">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…
              </span>
            ) : phase === "ask" || stepIdx + 1 < lesson.steps.length ? (
              <button
                type="button"
                disabled={running}
                onClick={() =>
                  launch(lesson, phase === "ask" ? stepIdx : stepIdx + 1)
                }
                className="btn-primary !h-7 !px-2.5 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                title={running ? "Wait for the current run to finish" : undefined}
              >
                <Play className="w-3 h-3" />
                {lesson.steps[phase === "ask" ? stepIdx : stepIdx + 1].label}
              </button>
            ) : nextLesson ? (
              <button
                type="button"
                onClick={() => pickLesson(nextLesson.key)}
                className="btn !h-7 !px-2.5 text-[11px]"
              >
                Next lesson: {nextLesson.title}
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn !h-7 !px-2.5 text-[11px]"
              >
                <Check className="w-3 h-3" /> All done — close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
