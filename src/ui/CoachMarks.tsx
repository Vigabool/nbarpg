import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { coachUnseen, markCoachSeen, skipCoach } from '../app/coach';
import { pickTip, type CoachTip } from './coachTips';

const onScreen = (selector: string) => {
  const el = document.querySelector(selector);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/**
 * Shows the first-time tip that fits the moment: a ring around the element it's about, the rest
 * dimmed, and a short note. Taps still reach the game underneath, so the player can just do the
 * thing; "Got it" retires the tip and "Skip tips" turns them all off.
 */
export function CoachMarks<C>({ tips, ctx }: { tips: CoachTip<C>[]; ctx: C }) {
  // Bumped to re-pick after a tip is dismissed, and to re-measure on scroll and resize.
  const [tick, setTick] = useState(0);
  const [shown, setShown] = useState<{ tip: CoachTip<C>; rect: DOMRect } | null>(null);

  // Pick and measure after the screen is drawn (the tip's element may be new in this render), keeping
  // the old value when nothing changed so this doesn't loop.
  useLayoutEffect(() => {
    const t = pickTip(tips, ctx, coachUnseen, onScreen);
    const r = t ? document.querySelector(t.target)?.getBoundingClientRect() : undefined;
    setShown((old) => {
      if (!t || !r) return null;
      const same =
        old && old.tip.id === t.id && old.rect.top === r.top && old.rect.left === r.left && old.rect.width === r.width && old.rect.height === r.height;
      return same ? old : { tip: t, rect: r };
    });
  });
  const tip = shown?.tip;
  const rect = shown?.rect;

  // Bring a newly shown tip's element into view.
  useEffect(() => {
    if (!tip) return;
    document.querySelector(tip.target)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [tip?.id]);

  useEffect(() => {
    const again = () => setTick((t) => t + 1);
    window.addEventListener('scroll', again, true);
    window.addEventListener('resize', again);
    return () => {
      window.removeEventListener('scroll', again, true);
      window.removeEventListener('resize', again);
    };
  }, []);

  if (!tip || !rect) return null;
  const pad = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(320, vw - 32);
  const left = Math.max(16, Math.min(rect.left, vw - width - 16));
  const roomBelow = vh - rect.bottom;
  const roomAbove = rect.top;
  // Below the element if there's room, else above it, else pinned to the bottom of the screen.
  const place: CSSProperties = roomBelow > 170 ? { top: rect.bottom + pad + 8 } : roomAbove > 170 ? { bottom: vh - rect.top + pad + 8 } : { bottom: 16 };

  return (
    <div className="coach" aria-live="polite" data-tick={tick}>
      <div
        className="coach-ring"
        style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        aria-hidden
      />
      <div className="coach-bubble" role="dialog" aria-label={tip.title} style={{ left, width, ...place }}>
        <strong>{tip.title}</strong>
        <p className="small">{tip.text}</p>
        <div className="spread">
          <button
            className="btn ghost small"
            onClick={() => {
              skipCoach();
              setTick((t) => t + 1);
            }}
          >
            Skip tips
          </button>
          <button
            className="btn primary small"
            onClick={() => {
              markCoachSeen(tip.id);
              setTick((t) => t + 1);
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
