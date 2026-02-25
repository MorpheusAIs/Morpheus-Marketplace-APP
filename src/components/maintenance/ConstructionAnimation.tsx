'use client';

import { useRef, useEffect } from 'react';
import { animate, createTimeline, stagger } from 'animejs';

export default function ConstructionAnimation() {
  const root = useRef<SVGSVGElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!root.current || initialized.current) return;
    initialized.current = true;

    const svg = root.current;
    const q = (sel: string) => svg.querySelector(sel) as Element;

    // Crane arm swinging
    animate(q('.crane-arm'), {
      rotate: [{ to: -8 }, { to: 8 }, { to: -8 }],
      duration: 4000,
      loop: true,
      ease: 'inOutSine',
      transformOrigin: ['100% 100%'],
    });

    // Crane cable & block swinging (follows arm with delay)
    animate(q('.crane-cable'), {
      rotate: [{ to: 6 }, { to: -6 }, { to: 6 }],
      duration: 4000,
      loop: true,
      ease: 'inOutSine',
      delay: 200,
      transformOrigin: ['50% 0%'],
    });

    // Gear spinning
    animate(q('.gear'), {
      rotate: '1turn',
      duration: 3000,
      loop: true,
      ease: 'linear',
      transformOrigin: ['50% 50%'],
    });

    // Small gear spinning (opposite direction)
    animate(q('.gear-small'), {
      rotate: '-1turn',
      duration: 2000,
      loop: true,
      ease: 'linear',
      transformOrigin: ['50% 50%'],
    });

    // Wrench tapping
    animate(q('.wrench'), {
      rotate: [{ to: -20 }, { to: 0 }],
      duration: 600,
      loop: true,
      loopDelay: 1200,
      ease: 'outBounce',
      transformOrigin: ['80% 80%'],
    });

    // Hard hat bobbing
    animate(q('.hard-hat'), {
      translateY: [{ to: -3 }, { to: 0 }],
      duration: 800,
      loop: true,
      ease: 'inOutQuad',
    });

    // Bricks appearing with stagger
    const bricks = svg.querySelectorAll('.brick');
    const brickTimeline = createTimeline({
      loop: true,
      defaults: { duration: 800, ease: 'outElastic(1, .6)' },
    });

    brickTimeline
      .add(bricks, {
        opacity: [0, 1],
        scale: [0, 1],
        delay: stagger(300),
        transformOrigin: ['50% 100%'],
      }, 0)
      .add(bricks, {
        opacity: [1, 0.3],
        delay: stagger(200),
        duration: 400,
      }, 3000);

    // Dust particles floating
    animate(svg.querySelectorAll('.dust'), {
      translateY: [0, -20],
      opacity: [0.8, 0],
      duration: 2000,
      loop: true,
      delay: stagger(400, { from: 'center' }),
      ease: 'outExpo',
    });

    // Caution stripes pulsing
    animate(q('.caution-stripes'), {
      opacity: [0.7, 1, 0.7],
      duration: 2000,
      loop: true,
      ease: 'inOutSine',
    });

    // Traffic cone wobble
    animate(q('.cone'), {
      rotate: [{ to: -5 }, { to: 5 }, { to: 0 }],
      duration: 2000,
      loop: true,
      loopDelay: 3000,
      ease: 'inOutElastic(1, .5)',
      transformOrigin: ['50% 100%'],
    });
  }, []);

  return (
    <svg
      ref={root}
      viewBox="0 0 200 160"
      width="200"
      height="160"
      className="overflow-visible"
      aria-label="Site under construction animation"
    >
      {/* Background building outline */}
      <rect
        x="55" y="60" width="90" height="80" rx="2"
        fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.15"
        className="text-green-500"
      />
      {/* Window holes */}
      <rect x="65" y="72" width="14" height="14" rx="1" fill="currentColor" opacity="0.08" className="text-green-500" />
      <rect x="85" y="72" width="14" height="14" rx="1" fill="currentColor" opacity="0.08" className="text-green-500" />
      <rect x="105" y="72" width="14" height="14" rx="1" fill="currentColor" opacity="0.08" className="text-green-500" />
      <rect x="125" y="72" width="14" height="14" rx="1" fill="currentColor" opacity="0.08" className="text-green-500" />
      <rect x="65" y="92" width="14" height="14" rx="1" fill="currentColor" opacity="0.08" className="text-green-500" />
      <rect x="85" y="92" width="14" height="14" rx="1" fill="currentColor" opacity="0.08" className="text-green-500" />
      <rect x="105" y="92" width="14" height="14" rx="1" fill="currentColor" opacity="0.08" className="text-green-500" />
      <rect x="125" y="92" width="14" height="14" rx="1" fill="currentColor" opacity="0.08" className="text-green-500" />

      {/* Crane tower */}
      <rect x="148" y="20" width="6" height="120" rx="1" fill="currentColor" opacity="0.25" className="text-green-500" />
      {/* Crane base */}
      <rect x="140" y="135" width="22" height="5" rx="1" fill="currentColor" opacity="0.3" className="text-green-500" />

      {/* Crane arm (pivots at top of tower) */}
      <g className="crane-arm" style={{ transformOrigin: '151px 24px' }}>
        <rect x="80" y="20" width="74" height="4" rx="1" fill="currentColor" opacity="0.35" className="text-green-500" />
        {/* Lattice detail */}
        <line x1="90" y1="20" x2="100" y2="24" stroke="currentColor" strokeWidth="0.5" opacity="0.2" className="text-green-500" />
        <line x1="110" y1="20" x2="120" y2="24" stroke="currentColor" strokeWidth="0.5" opacity="0.2" className="text-green-500" />
        <line x1="130" y1="20" x2="140" y2="24" stroke="currentColor" strokeWidth="0.5" opacity="0.2" className="text-green-500" />

        {/* Cable and block */}
        <g className="crane-cable" style={{ transformOrigin: '95px 24px' }}>
          <line x1="95" y1="24" x2="95" y2="55" stroke="currentColor" strokeWidth="1" opacity="0.3" className="text-green-500" />
          <rect x="90" y="52" width="10" height="8" rx="1" fill="currentColor" opacity="0.3" className="text-green-500" />
        </g>
      </g>

      {/* Bricks being placed */}
      <rect className="brick text-green-400" x="55" y="55" width="12" height="6" rx="1" fill="currentColor" opacity="0" />
      <rect className="brick text-green-400" x="69" y="55" width="12" height="6" rx="1" fill="currentColor" opacity="0" />
      <rect className="brick text-green-400" x="83" y="55" width="12" height="6" rx="1" fill="currentColor" opacity="0" />
      <rect className="brick text-green-400" x="97" y="55" width="12" height="6" rx="1" fill="currentColor" opacity="0" />

      {/* Gear (large) */}
      <g className="gear" style={{ transformOrigin: '30px 105px' }}>
        <circle cx="30" cy="105" r="12" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" className="text-green-500" />
        <circle cx="30" cy="105" r="4" fill="currentColor" opacity="0.3" className="text-green-500" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="28" y="91" width="4" height="4" rx="0.5"
            fill="currentColor" opacity="0.4" className="text-green-500"
            transform={`rotate(${angle} 30 105)`}
          />
        ))}
      </g>

      {/* Gear (small) */}
      <g className="gear-small" style={{ transformOrigin: '47px 97px' }}>
        <circle cx="47" cy="97" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" className="text-green-500" />
        <circle cx="47" cy="97" r="2.5" fill="currentColor" opacity="0.25" className="text-green-500" />
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <rect
            key={angle}
            x="45.5" y="89" width="3" height="3" rx="0.5"
            fill="currentColor" opacity="0.35" className="text-green-500"
            transform={`rotate(${angle} 47 97)`}
          />
        ))}
      </g>

      {/* Hard hat */}
      <g className="hard-hat">
        <path d="M88 120 Q100 108 112 120" fill="currentColor" opacity="0.5" className="text-green-500" />
        <rect x="85" y="119" width="30" height="4" rx="1.5" fill="currentColor" opacity="0.6" className="text-green-500" />
      </g>

      {/* Wrench */}
      <g className="wrench" style={{ transformOrigin: '178px 118px' }}>
        <rect x="168" y="100" width="3" height="20" rx="1" fill="currentColor" opacity="0.4" className="text-green-500" transform="rotate(-30 169 110)" />
        <circle cx="170" cy="96" r="5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" className="text-green-500" />
      </g>

      {/* Traffic cone */}
      <g className="cone" style={{ transformOrigin: '22px 140px' }}>
        <polygon points="22,120 16,140 28,140" fill="currentColor" opacity="0.4" className="text-orange-500" />
        <rect x="14" y="138" width="16" height="3" rx="1" fill="currentColor" opacity="0.35" className="text-orange-500" />
        <line x1="19" y1="128" x2="25" y2="128" stroke="currentColor" strokeWidth="1.5" opacity="0.5" className="text-orange-300" />
        <line x1="18" y1="133" x2="26" y2="133" stroke="currentColor" strokeWidth="1.5" opacity="0.5" className="text-orange-300" />
      </g>

      {/* Caution stripes at base */}
      <g className="caution-stripes">
        <rect x="55" y="140" width="90" height="4" rx="1" fill="currentColor" opacity="0.15" className="text-yellow-500" />
        {[0, 12, 24, 36, 48, 60, 72].map((offset) => (
          <rect
            key={offset}
            x={57 + offset} y="140" width="6" height="4"
            fill="currentColor" opacity="0.3" className="text-yellow-500"
            transform="skewX(-20)"
          />
        ))}
      </g>

      {/* Dust particles */}
      <circle className="dust text-green-500" cx="70" cy="135" r="1.5" fill="currentColor" opacity="0" />
      <circle className="dust text-green-500" cx="90" cy="138" r="1" fill="currentColor" opacity="0" />
      <circle className="dust text-green-500" cx="110" cy="133" r="1.5" fill="currentColor" opacity="0" />
      <circle className="dust text-green-500" cx="130" cy="136" r="1" fill="currentColor" opacity="0" />
    </svg>
  );
}
