"use client";

import { useEffect, useState } from "react";
import { Archivo, Work_Sans, IBM_Plex_Mono } from "next/font/google";

const archivo = Archivo({ subsets: ["latin"], weight: ["800", "900"], style: ["italic"], variable: "--font-archivo" });
const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-work-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-plex-mono" });

const STORE_KEY = "zumbaton-shot-list-v1";

type Shot = { id: string; label: string };
type ShotCard = {
  badge: string;
  instructor: string;
  title: string;
  currentFile: string;
  currentNote: string;
  shots: Shot[];
};

const PRIORITY_CARDS: ShotCard[] = [
  {
    badge: "Needs Photo",
    instructor: "Coach Robert",
    title: "Zumba Step",
    currentFile: "hero2.jpeg",
    currentNote:
      "a generic landscape stock photo, and the exact same file used on Thunderbolt · Resistance & Dance below.",
    shots: [
      { id: "zs-1", label: "Full group mid-step-routine, steppers in frame, formation synced" },
      { id: "zs-2", label: "Robert front-and-center, cueing the class" },
      { id: "zs-3", label: "One high-energy jump / peak-movement freeze-frame" },
      { id: "zs-4", label: "Tight shot on footwork on the step platform" },
    ],
  },
  {
    badge: "Needs Photo",
    instructor: "Coach Fizah",
    title: "Thunderbolt · Resistance & Dance",
    currentFile: "hero2.jpeg",
    currentNote: "same duplicate file as Zumba Step above, on a completely different class.",
    shots: [
      { id: "tr-1", label: "Resistance band stretched mid-rep, visible tension" },
      { id: "tr-2", label: "Fizah demonstrating band form, front-on" },
      { id: "tr-3", label: "Floor-based full-body movement, group mid-set" },
      { id: "tr-4", label: "Close-up on effort/strain during a resistance hold" },
    ],
  },
  {
    badge: "Needs Photo",
    instructor: "Coach Robert",
    title: "Thunderbolt · Bodyweight & Steppers",
    currentFile: "notbad.jpeg",
    currentNote: "generic landscape stock, not shot in the Zumbaton studio.",
    shots: [
      { id: "tb-1", label: "Explosive bodyweight move on top of the stepper (jump / burpee)" },
      { id: "tb-2", label: "Robert mid-cue during a Tabata interval" },
      { id: "tb-3", label: "Group mid-set, visible sweat and effort" },
      { id: "tb-4", label: "Wide shot showing the full stepper row in the studio" },
    ],
  },
  {
    badge: "Needs Photo",
    instructor: "Laavania",
    title: "Lil Steppers",
    currentFile: "kids1.png",
    currentNote: "a generic stock photo of children, not an actual Lil Steppers session.",
    shots: [
      { id: "ls-1", label: "Kids mid-dance-move, smiling, in the actual studio" },
      { id: "ls-2", label: "Laavania leading a kid-friendly pose, front-on" },
      { id: "ls-3", label: "Full group in a fun formation" },
      { id: "ls-4", label: "One candid moment — laughing, high-five, mid-song" },
    ],
  },
];

const COVERED = [
  { name: "Groove Stepper Synchronized Dance", files: "ZT1–ZT5.jpg" },
  { name: "Piloxing", files: "piloxing01–04.jpg + PILOXING 1–5.jpg" },
  { name: "Thunderbolt Tabata (Outdoor · OCBC Arena)", files: "OS1, OS2, OS3, OS5.jpg" },
];

const SPECS: { term: string; detail: string }[] = [
  {
    term: "Orientation",
    detail:
      "Native portrait — rotate the camera itself. Don't crop a landscape shot down afterward; it throws away resolution the site needs.",
  },
  {
    term: "Min. resolution",
    detail:
      "3000px on the long edge. The best photos already live match this (3150×4724) — treat that as the floor, not the target.",
  },
  { term: "Format", detail: "JPG, sRGB, high quality (90%+). No HEIC." },
  {
    term: "Framing",
    detail:
      "Keep the main action in the vertical-middle third of the frame — see the diagram. Everything above and below that band gets cropped away on the site.",
  },
  {
    term: "Lighting",
    detail: "Bright, even studio light. Watch for flash glare bouncing off mirrors or glass in the room.",
  },
  {
    term: "Continuity",
    detail: "Match the “Already covered” set — real mid-action moments during a live class, not a posed lineup.",
  },
];

const GUIDELINES = [
  "Shoot during an actual running class, not a staged re-enactment after hours — it reads more authentic and everyone's already warmed up.",
  "Burst-shoot each moment and pick the sharpest peak-action frame afterward, rather than firing single shots.",
  "Keep the background clean — no mirror reflections of the photographer, no clutter in frame.",
  "Get a quick photo release from anyone clearly identifiable — these go straight on the public site.",
  "Get instructor and class together in at least one frame per session — a solo instructor shot doesn't sell the group energy.",
  "Shoot more than the list — extra portrait shots are cheap insurance for future pages and social posts.",
];

const TOTAL_SHOTS = PRIORITY_CARDS.reduce((n, c) => n + c.shots.length, 0);

export default function PhotoShotListPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const checkedCount = hydrated ? Object.values(checked).filter(Boolean).length : 0;

  return (
    <div
      className={`${archivo.variable} ${workSans.variable} ${plexMono.variable} min-h-screen bg-[#f6f4ee] text-[#14140d] dark:bg-black dark:text-[#f5f4ec]`}
      style={{ fontFamily: "var(--font-work-sans), ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-8">
        {/* header */}
        <header className="border border-black/10 bg-[#ece7d8] p-6 dark:border-white/10 dark:bg-zinc-950 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <span
                className="inline-flex items-center border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
                style={{ fontFamily: "var(--font-plex-mono), monospace" }}
              >
                Production Brief · onestepfitness.sg
              </span>
              <h1
                className="mt-4 text-[2.1rem] italic uppercase leading-[0.92] tracking-tight sm:text-5xl"
                style={{ fontFamily: "var(--font-archivo), sans-serif", fontWeight: 900 }}
              >
                Class Photo
                <br />
                Shot <span className="text-lime-600 dark:text-lime-400">List.</span>
              </h1>
              <p className="mt-4 max-w-[62ch] text-zinc-600 dark:text-zinc-400">
                Four class pages on the site are currently running on stock or duplicated
                photography instead of real shots of the class. This is what to hand your
                photographer: which classes still need coverage, the exact shots to capture,
                and the framing the site&apos;s layouts actually require.
              </p>
            </div>

            <div className="grid min-w-[260px] grid-cols-3 gap-2.5">
              <div className="border border-black/10 bg-white px-3.5 py-3 dark:border-white/10 dark:bg-zinc-900">
                <span
                  className="block text-[9.5px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400"
                  style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                >
                  Needs Photos
                </span>
                <span className="text-2xl font-black" style={{ fontFamily: "var(--font-archivo), sans-serif" }}>
                  4
                </span>
              </div>
              <div className="border border-black/10 bg-white px-3.5 py-3 dark:border-white/10 dark:bg-zinc-900">
                <span
                  className="block text-[9.5px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400"
                  style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                >
                  Covered
                </span>
                <span className="text-2xl font-black" style={{ fontFamily: "var(--font-archivo), sans-serif" }}>
                  3
                </span>
              </div>
              <div className="border border-black/10 bg-white px-3.5 py-3 dark:border-white/10 dark:bg-zinc-900">
                <span
                  className="block text-[9.5px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400"
                  style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                >
                  Shots Checked
                </span>
                <span className="text-2xl font-black text-lime-600 dark:text-lime-400" style={{ fontFamily: "var(--font-archivo), sans-serif" }}>
                  {checkedCount}/{TOTAL_SHOTS}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* priority cards */}
        <section className="mt-14">
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <h2
              className="text-2xl italic uppercase tracking-tight sm:text-3xl"
              style={{ fontFamily: "var(--font-archivo), sans-serif", fontWeight: 900 }}
            >
              Send this to the photographer
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400" style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
              4 classes · {TOTAL_SHOTS} shots
            </span>
          </div>
          <p className="mb-6 max-w-[68ch] text-zinc-600 dark:text-zinc-400">
            Each card below is one class page. Check off shots as they come in — your
            progress is saved on this device.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRIORITY_CARDS.map((card) => (
              <article key={card.title} className="flex flex-col gap-3.5 border-2 border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="inline-block bg-lime-500 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-black"
                    style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                  >
                    {card.badge}
                  </span>
                  <span
                    className="pt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"
                    style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                  >
                    {card.instructor}
                  </span>
                </div>

                <h3 className="text-xl italic uppercase leading-[0.95]" style={{ fontFamily: "var(--font-archivo), sans-serif", fontWeight: 800 }}>
                  {card.title}
                </h3>

                <p className="border border-red-900/25 bg-red-50 px-3 py-2.5 text-[0.86rem] text-red-800 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300">
                  Currently live:{" "}
                  <span className="font-semibold" style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
                    {card.currentFile}
                  </span>{" "}
                  — {card.currentNote}
                </p>

                <ul className="flex flex-col gap-2 border-t border-black/10 pt-3 dark:border-white/10">
                  {card.shots.map((shot) => {
                    const isDone = !!checked[shot.id];
                    return (
                      <li key={shot.id} className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggle(shot.id)}
                          aria-pressed={isDone}
                          aria-label={shot.label}
                          className={`mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center border-2 ${
                            isDone ? "border-lime-600 bg-lime-500 dark:border-lime-400" : "border-black/25 bg-white dark:border-white/25 dark:bg-zinc-900"
                          }`}
                        >
                          {isDone && (
                            <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
                              <path d="M1 5.2 L4 8 L9 1.5" stroke="black" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                        <span className={`text-[0.92rem] ${isDone ? "text-zinc-400 line-through dark:text-zinc-600" : "text-zinc-700 dark:text-zinc-300"}`}>
                          {shot.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-4 border border-dashed border-black/25 p-4 text-[0.92rem] text-zinc-600 dark:border-white/25 dark:text-zinc-400">
            <strong className="text-zinc-900 dark:text-white">Same day, easy add-on:</strong> the
            One Familia package pages reuse these same{" "}
            <span style={{ fontFamily: "var(--font-plex-mono), monospace" }}>kids.png</span> /{" "}
            <span style={{ fontFamily: "var(--font-plex-mono), monospace" }}>kids1.png</span>{" "}
            stock photos. Same age group, same venue — grab one parent-and-child pair
            mid-movement and one multi-generation group shot while the Lil Steppers shoot is
            already set up.
          </div>
        </section>

        {/* already covered */}
        <section className="mt-14">
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <h2
              className="text-2xl italic uppercase tracking-tight sm:text-3xl"
              style={{ fontFamily: "var(--font-archivo), sans-serif", fontWeight: 900 }}
            >
              Already covered
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400" style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
              no reshoot needed
            </span>
          </div>
          <p className="mb-6 max-w-[68ch] text-zinc-600 dark:text-zinc-400">
            These three already have a dedicated portrait shoot on the site. They&apos;re the
            look to match: bright, mid-action, real energy, instructor&apos;s face visible.
          </p>
          <div className="flex flex-col border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
            {COVERED.map((c, i) => (
              <div
                key={c.name}
                className={`flex flex-wrap items-center gap-4 px-4 py-3.5 sm:px-5 ${i > 0 ? "border-t border-black/10 dark:border-white/10" : ""}`}
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center border-2 border-lime-600 text-[13px] font-bold text-lime-600 dark:border-lime-400 dark:text-lime-400">
                  ✓
                </span>
                <span
                  className="min-w-[200px] flex-1 italic uppercase leading-tight tracking-tight"
                  style={{ fontFamily: "var(--font-archivo), sans-serif", fontWeight: 800 }}
                >
                  {c.name}
                </span>
                <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400" style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
                  {c.files}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* specs */}
        <section className="mt-14">
          <div className="mb-2 flex flex-wrap items-baseline gap-3">
            <h2
              className="text-2xl italic uppercase tracking-tight sm:text-3xl"
              style={{ fontFamily: "var(--font-archivo), sans-serif", fontWeight: 900 }}
            >
              Technical specs
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400" style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
              for whoever&apos;s holding the camera
            </span>
          </div>

          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[1.1fr_1fr]">
            <dl className="flex flex-col border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
              {SPECS.map((s, i) => (
                <div
                  key={s.term}
                  className={`grid grid-cols-[110px_1fr] gap-3.5 px-4 py-3.5 sm:grid-cols-[130px_1fr] ${i > 0 ? "border-t border-black/10 dark:border-white/10" : ""}`}
                >
                  <dt
                    className="text-[11px] uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400"
                    style={{ fontFamily: "var(--font-plex-mono), monospace" }}
                  >
                    {s.term}
                  </dt>
                  <dd className="m-0 text-[0.92rem] text-zinc-700 dark:text-zinc-300">{s.detail}</dd>
                </div>
              ))}
            </dl>

            <figure className="border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
              <svg
                viewBox="0 0 400 340"
                role="img"
                aria-label="One portrait photo gets cropped two different ways on the site: a wide grid-card band and a wider hero-banner band, both pulled from the same vertical-middle third of the frame. Anything above or below that band is cut off."
                className="h-auto w-full text-zinc-900 dark:text-zinc-100"
              >
                <rect x="30" y="20" width="150" height="300" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="30" y="128" width="150" height="84" className="fill-lime-500/25 dark:fill-lime-400/25" stroke="currentColor" strokeWidth="2" />
                <text x="105" y="36" textAnchor="middle" fontFamily="var(--font-plex-mono), monospace" fontSize="10" fill="currentColor" opacity="0.6">
                  SOURCE PHOTO
                </text>

                <line x1="30" y1="20" x2="30" y2="128" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                <line x1="30" y1="212" x2="30" y2="320" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                <text x="20" y="75" textAnchor="middle" fontFamily="var(--font-plex-mono), monospace" fontSize="9" fill="currentColor" opacity="0.55" transform="rotate(-90 20 75)">
                  CROPPED
                </text>
                <text x="20" y="265" textAnchor="middle" fontFamily="var(--font-plex-mono), monospace" fontSize="9" fill="currentColor" opacity="0.55" transform="rotate(-90 20 265)">
                  CROPPED
                </text>

                <text x="105" y="174" textAnchor="middle" fontFamily="var(--font-plex-mono), monospace" fontSize="10" fontWeight="600" fill="currentColor">
                  SAFE ZONE
                </text>

                <defs>
                  <marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
                  </marker>
                </defs>

                <path d="M180,150 C 230,150 220,90 270,90" fill="none" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#ar)" />
                <rect x="270" y="66" width="110" height="48" fill="none" stroke="currentColor" strokeWidth="2" />
                <text x="325" y="128" textAnchor="middle" fontFamily="var(--font-plex-mono), monospace" fontSize="9.5" fill="currentColor" opacity="0.75">
                  GRID CARD
                </text>

                <path d="M180,190 C 230,190 220,250 270,250" fill="none" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#ar)" />
                <rect x="270" y="228" width="120" height="44" fill="none" stroke="currentColor" strokeWidth="2" />
                <text x="330" y="288" textAnchor="middle" fontFamily="var(--font-plex-mono), monospace" fontSize="9.5" fill="currentColor" opacity="0.75">
                  HERO BANNER
                </text>
              </svg>
              <figcaption className="mt-3 text-[0.85rem] text-zinc-600 dark:text-zinc-400">
                One portrait photo gets cropped two different ways on the site — a grid-card
                band and a wider hero-banner band — both pulled from the same vertical-middle
                third. Compose the action there, not at the top or bottom of the frame.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* shoot day */}
        <section className="mt-14">
          <h2
            className="mb-6 text-2xl italic uppercase tracking-tight sm:text-3xl"
            style={{ fontFamily: "var(--font-archivo), sans-serif", fontWeight: 900 }}
          >
            Shoot day
          </h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {GUIDELINES.map((g, i) => (
              <div key={g} className="flex gap-3 border border-black/10 bg-white px-4 py-4 dark:border-white/10 dark:bg-zinc-950">
                <span className="shrink-0 text-[0.85rem] font-semibold text-lime-600 dark:text-lime-400" style={{ fontFamily: "var(--font-plex-mono), monospace" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="m-0 text-[0.92rem] text-zinc-600 dark:text-zinc-400">{g}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-2.5 border-t border-black/10 pt-6 text-[0.85rem] text-zinc-500 dark:border-white/10 dark:text-zinc-500">
          <span>Check off shots as they&apos;re captured — checkmarks save on this device only.</span>
          <span style={{ fontFamily: "var(--font-plex-mono), monospace" }}>onestepfitness.sg / class-photo-brief</span>
        </footer>
      </div>
    </div>
  );
}
