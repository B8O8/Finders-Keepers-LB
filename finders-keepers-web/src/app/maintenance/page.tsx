'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 700;
const H = 220;
const GY = 175;           // ground y
const CX = 90;            // character x
const CS = 38;            // character height
const GRAVITY = 0.55;
const JUMP_FORCE = -14;

type Obs = { x: number; w: number; h: number; type: number };
type Phase = 'idle' | 'playing' | 'dead';

// ─── Game component ───────────────────────────────────────────────────────────
function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const state     = useRef({
    phase: 'idle' as Phase,
    y: GY - CS, vy: 0, grounded: true,
    obs: [] as Obs[],
    score: 0, speed: 4.5, frame: 0,
  });

  const [score, setScore]       = useState(0);
  const [best, setBest]         = useState(0);
  const [phase, setPhase]       = useState<Phase>('idle');

  const start = useCallback(() => {
    const s = state.current;
    s.phase = 'playing'; s.y = GY - CS; s.vy = 0; s.grounded = true;
    s.obs = []; s.score = 0; s.speed = 4.5; s.frame = 0;
    setPhase('playing'); setScore(0);
  }, []);

  const jump = useCallback(() => {
    const s = state.current;
    if (s.phase === 'idle' || s.phase === 'dead') { start(); return; }
    if (s.grounded) { s.vy = JUMP_FORCE; s.grounded = false; }
  }, [start]);

  // Keyboard + touch
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    };
    const td = () => jump();
    window.addEventListener('keydown', kd);
    window.addEventListener('touchstart', td);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('touchstart', td); };
  }, [jump]);

  // Canvas game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // HiDPI
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    // ── drawBag ──────────────────────────────────────────────────────────────
    const drawBag = (x: number, y: number, frame: number, dead: boolean) => {
      const col  = dead ? '#ef4444' : '#818cf8';
      const dark = dead ? '#b91c1c' : '#6366f1';

      // Legs
      if (!dead) {
        const lo = Math.sin(frame * 0.25) * 6;
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.roundRect(x - 10, y + CS - 4, 9, 10 + lo, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(x + 1,  y + CS - 4, 9, 10 - lo, 3); ctx.fill();
      }

      // Bag body
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.roundRect(x - 15, y, 30, CS, 6); ctx.fill();

      // Bag handle
      ctx.strokeStyle = dark; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y - 1, 10, Math.PI, 0); ctx.stroke();

      // White stripe
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.roundRect(x - 9, y + 6, 18, 5, 2); ctx.fill();

      // FK label
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('FK', x, y + 26);

      // Eyes
      if (!dead) {
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(x - 6, y + 10, 4.5, 0, Math.PI * 2);
        ctx.arc(x + 6, y + 10, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#312e81';
        ctx.beginPath(); ctx.arc(x - 5, y + 11, 2.5, 0, Math.PI * 2);
        ctx.arc(x + 7, y + 11, 2.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        [-6, 6].forEach(ox => {
          ctx.beginPath();
          ctx.moveTo(x + ox - 4, y + 7); ctx.lineTo(x + ox + 4, y + 15);
          ctx.moveTo(x + ox + 4, y + 7); ctx.lineTo(x + ox - 4, y + 15);
          ctx.stroke();
        });
      }
    };

    // ── drawObs ───────────────────────────────────────────────────────────────
    const COLORS = ['#f472b6', '#fbbf24', '#34d399'];
    const drawObs = (o: Obs) => {
      const c = COLORS[o.type];
      ctx.fillStyle = c;
      if (o.type === 0) {
        // Box (shoe box)
        ctx.beginPath(); ctx.roundRect(o.x, GY - o.h, o.w, o.h, 5); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(o.x + 4, GY - o.h + 5, o.w - 8, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '7px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('SALE', o.x + o.w / 2, GY - o.h + 20);
      } else if (o.type === 1) {
        // Tall hanger/mannequin
        ctx.fillRect(o.x + o.w / 2 - 4, GY - o.h, 8, o.h);
        ctx.beginPath(); ctx.arc(o.x + o.w / 2, GY - o.h + 10, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(o.x, GY - o.h + 18, o.w, 6);
      } else {
        // Wide purse
        ctx.beginPath(); ctx.roundRect(o.x, GY - o.h, o.w, o.h, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(o.x + o.w / 2, GY - o.h - 4, 10, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(o.x + 8, GY - o.h + 8, o.w - 16, 4);
      }
    };

    // Stars
    const stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * W, y: Math.random() * GY * 0.9,
      r: Math.random() * 1.5 + 0.3, a: Math.random(),
    }));

    let prev = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - prev) / 16.67, 2.5); prev = t;
      const s  = state.current;

      // ── Clear ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      // ── Stars ──────────────────────────────────────────────────────────────
      stars.forEach(st => {
        st.a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.001 + st.x));
        ctx.globalAlpha = st.a;
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // ── Ground ─────────────────────────────────────────────────────────────
      const gGrad = ctx.createLinearGradient(0, GY, 0, H);
      gGrad.addColorStop(0, 'rgba(99,102,241,0.5)');
      gGrad.addColorStop(1, 'rgba(99,102,241,0)');
      ctx.fillStyle = gGrad;
      ctx.fillRect(0, GY, W, H - GY);
      ctx.strokeStyle = 'rgba(129,140,248,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, GY); ctx.lineTo(W, GY); ctx.stroke();

      // ── Game logic ─────────────────────────────────────────────────────────
      if (s.phase === 'playing') {
        s.frame++;
        s.vy += GRAVITY * dt;
        s.y  += s.vy * dt;
        if (s.y >= GY - CS) { s.y = GY - CS; s.vy = 0; s.grounded = true; }

        s.score += dt * 0.55;
        s.speed  = 4.5 + Math.sqrt(s.score / 80) * 0.6;

        // Spawn
        const last = s.obs[s.obs.length - 1];
        const gap  = Math.max(180, 340 - s.score * 0.2);
        if (!last || W - last.x > gap + Math.random() * 140) {
          const type = Math.floor(Math.random() * 3);
          const hs   = [38, 58, 28]; const ws = [32, 22, 50];
          s.obs.push({ x: W + 10, w: ws[type], h: hs[type], type });
        }

        s.obs.forEach(o => { o.x -= s.speed * dt; });
        s.obs = s.obs.filter(o => o.x + o.w > -20);

        // Collision — proper AABB with forgiving hitbox
        for (const o of s.obs) {
          const charTop    = s.y + 6;       // shrink top for fairness
          const charBottom = s.y + CS - 4;  // shrink bottom (legs overlap allowed)
          const charLeft   = CX - 10;
          const charRight  = CX + 10;
          const obsTop     = GY - o.h + 4;
          const obsLeft    = o.x + 4;
          const obsRight   = o.x + o.w - 4;
          if (
            charRight > obsLeft && charLeft < obsRight &&
            charBottom > obsTop && charTop < GY
          ) {
            s.phase = 'dead'; setPhase('dead');
            const sc = Math.floor(s.score);
            setScore(sc); setBest(p => Math.max(p, sc));
            break;
          }
        }
        setScore(Math.floor(s.score));
      }

      // ── Draw obstacles ─────────────────────────────────────────────────────
      s.obs.forEach(drawObs);

      // ── Draw character ─────────────────────────────────────────────────────
      drawBag(CX, s.y, s.frame, s.phase === 'dead');

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {/* Score row */}
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
          BEST {String(best).padStart(5, '0')}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.1em' }}>
          {String(score).padStart(5, '0')}
        </span>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onClick={jump}
          style={{ borderRadius: '16px', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', display: 'block', background: 'rgba(15,15,30,0.8)' }}
        />

        {/* Overlay for idle/dead */}
        {phase !== 'playing' && (
          <div
            onClick={jump}
            style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '12px',
              borderRadius: '16px', background: 'rgba(10,10,20,0.75)',
              backdropFilter: 'blur(4px)', cursor: 'pointer',
            }}
          >
            {phase === 'dead' && (
              <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#f87171', letterSpacing: '-0.02em' }}>
                Game Over
              </p>
            )}
            {phase === 'dead' && score > 0 && (
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                Score: <strong style={{ color: 'white' }}>{score}</strong>
                {score === best && score > 0 ? ' 🏆 New best!' : ''}
              </p>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              borderRadius: '100px', padding: '10px 24px',
              boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', letterSpacing: '0.05em' }}>
                {phase === 'idle' ? '▶  PRESS SPACE TO PLAY' : '↺  TRY AGAIN'}
              </span>
            </div>
            {phase === 'idle' && (
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                or tap the canvas · avoid the obstacles
              </p>
            )}
          </div>
        )}
      </div>

      {phase === 'playing' && (
        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
          SPACE or TAP to jump
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: '100vh', margin: 0,
      background: 'linear-gradient(160deg, #0a0a0f 0%, #0d0d1f 50%, #0a0a0f 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', gap: '40px',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: '10%', left: '20%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '15%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ textAlign: 'center', position: 'relative' }}>
        {/* Logo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', marginBottom: '20px', boxShadow: '0 8px 32px rgba(99,102,241,0.35)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
          Finders Keepers
        </p>
        <h1 style={{ margin: '0 0 10px', fontSize: '32px', fontWeight: 800, color: 'white', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          We&rsquo;re updating the store
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, maxWidth: '440px' }}>
          Back very soon. In the meantime — kill some time with our little game below 👇
        </p>
      </div>

      {/* Game */}
      <Game />

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '100px', padding: '8px 18px' }}>
        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.2)', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Maintenance in progress</span>
      </div>
    </div>
  );
}
