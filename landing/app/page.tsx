"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
import { TypewriterEffectSmooth } from "@/components/ui/typewriter-effect";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { GlowEffect } from "@/components/ui/glow-effect";

gsap.registerPlugin(ScrollTrigger);

const FONT_DISPLAY = "'Sora', sans-serif";
const FONT_BODY = "'Space Grotesk', sans-serif";

/* ── Shield Icon (inline SVG) ── */
function ShieldIcon({ size = 24, color = "#58a6ff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M24 4L6 14v12c0 11 8 18 18 20 10-2 18-9 18-20V14L24 4z" fill="rgba(88,166,255,0.08)" stroke={color} strokeWidth="2" />
      <path d="M24 12l-10 6v8c0 7 4 12 10 14 6-2 10-7 10-14v-8l-10-6z" fill="rgba(13,17,23,0.6)" stroke={color} strokeWidth="1.5" />
      <circle cx="24" cy="24" r="3.5" fill={color} />
      <path d="M24 20v-3M24 28v3M20 24h-3M28 24h3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── Feature Icons ── */
function IconScrub() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /><circle cx="12" cy="16" r="1.5" /></svg>; }
function IconGate() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>; }
function IconLegal() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" /></svg>; }
function IconSMS() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF9F0A" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>; }
function IconGit() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M12 3v6m0 6v6" /><circle cx="18" cy="6" r="2" /><path d="M14.5 10.5L16 8" /></svg>; }
function IconDash() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2997FF" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>; }

/* ── Page ── */
export default function Home() {
  const main = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let lenis: any;
    (async () => {
      const L = (await import("lenis")).default;
      lenis = new L({ duration: 1.2, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    })();
    return () => { lenis?.destroy(); };
  }, []);

  useGSAP(() => {
    if (!main.current) return;
    const ctx = gsap.context(() => {
      // Hero entrance
      gsap.from("#hero-logo", { scale: 0.4, opacity: 0, duration: 1.4, ease: "power3.out", delay: 0.2 });
      gsap.from("#hero-cta", { opacity: 0, y: 20, duration: 0.7, delay: 1.8 });
      gsap.from("#hero-pills", { opacity: 0, duration: 0.6, delay: 2.1 });

      // Hero parallax out
      gsap.to("#hero-inner", { y: -100, opacity: 0, scrollTrigger: { trigger: "#hero", start: "center center", end: "bottom top", scrub: 1 } });

      // Reveal-on-scroll elements
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
        gsap.from(el, { opacity: 0, y: 30, duration: 0.8, scrollTrigger: { trigger: el, start: "top 92%", end: "top 70%", scrub: 1 } });
      });

      // Cards slide in
      gsap.from("#cl", { x: -40, opacity: 0, scrollTrigger: { trigger: "#cl", start: "top 92%", end: "top 72%", scrub: 1 } });
      gsap.from("#cr", { x: 40, opacity: 0, scrollTrigger: { trigger: "#cr", start: "top 92%", end: "top 72%", scrub: 1 } });

      // Solution section
      gsap.from("#s1", { opacity: 0, y: 20, scrollTrigger: { trigger: "#sol", start: "top 92%", end: "top 78%", scrub: 1 } });
      gsap.from("#s2", { opacity: 0, y: 35, scrollTrigger: { trigger: "#sol", start: "top 88%", end: "top 72%", scrub: 1 } });
      gsap.from("#s3", { opacity: 0, y: 25, scrollTrigger: { trigger: "#s3", start: "top 95%", end: "top 78%", scrub: 1 } });
      gsap.from("#s4", { opacity: 0, x: -30, scrollTrigger: { trigger: "#s4", start: "top 95%", end: "top 78%", scrub: 1 } });
      gsap.from("#s5", { opacity: 0, x: 30, scrollTrigger: { trigger: "#s5", start: "top 95%", end: "top 78%", scrub: 1 } });

      // Stats counter
      gsap.utils.toArray<HTMLElement>(".si").forEach((el) => {
        gsap.from(el, { opacity: 0, y: 30, scrollTrigger: { trigger: el, start: "top 92%", end: "top 76%", scrub: 1 } });
      });

      // Bento cards stagger
      gsap.utils.toArray<HTMLElement>(".bento-card").forEach((el, i) => {
        gsap.from(el, { opacity: 0, y: 40, scrollTrigger: { trigger: el, start: "top 95%", end: "top 78%", scrub: 1 } });
      });

      // FAQ
      gsap.utils.toArray<HTMLElement>(".fq").forEach((el) => {
        gsap.from(el, { opacity: 0, y: 25, scrollTrigger: { trigger: el, start: "top 92%", end: "top 76%", scrub: 1 } });
      });

      // Download
      gsap.from("#dl", { opacity: 0, y: 40, scrollTrigger: { trigger: "#dl", start: "top 92%", end: "top 70%", scrub: 1 } });
    }, main);
    return () => ctx.revert();
  }, { scope: main });

  const copy = () => { navigator.clipboard.writeText("git clone https://github.com/Willgunter/yhack2026.git && cd yhack2026 && bash praesidia/install.sh"); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const S = { fontFamily: FONT_DISPLAY } as const;
  const B = { fontFamily: FONT_BODY } as const;
  const HXL = { fontFamily: FONT_DISPLAY, fontSize: "clamp(52px, 8vw, 96px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.0 } as const;
  const HLG = { fontFamily: FONT_DISPLAY, fontSize: "clamp(32px, 5vw, 60px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 } as const;
  const BLG = { fontFamily: FONT_BODY, fontSize: "clamp(16px, 1.6vw, 20px)", lineHeight: 1.65, color: "#a1a1aa" } as const;
  const LABEL = { fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase" as const } as const;

  const heroWords = [
    { text: "Praesidia", className: "bg-gradient-to-r from-[#58a6ff] via-[#a78bfa] to-[#3fb950] bg-clip-text text-transparent" },
  ];

  return (
    <BackgroundGradientAnimation
      gradientBackgroundStart="rgb(8, 11, 20)"
      gradientBackgroundEnd="rgb(10, 15, 30)"
      firstColor="88, 166, 255"
      secondColor="139, 92, 246"
      thirdColor="63, 185, 80"
      fourthColor="41, 151, 255"
      fifthColor="210, 153, 34"
      pointerColor="88, 166, 255"
      size="100%"
      blendingValue="hard-light"
      interactive={true}
      containerClassName="!h-auto !min-h-0"
    >
      <div ref={main} className="relative z-10" style={{ position: "relative" }}>

        {/* NAV */}
        <nav className="fixed top-0 w-full z-50" style={{ background: "rgba(8,11,20,0.6)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Image src="/logo.png" alt="P" width={28} height={28} style={{ borderRadius: "50%" }} />
              <span style={{ ...S, fontWeight: 600, fontSize: 15, color: "#fff" }}>Praesidia</span>
            </div>
            <div className="hidden md:flex" style={{ gap: 28 }}>
              {["Problem", "Solution", "Features", "Download"].map((l) => (
                <a key={l} href={`#${l.toLowerCase()}`} style={{ ...B, fontSize: 13, color: "#a1a1aa", textDecoration: "none", transition: "color 0.2s" }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#a1a1aa")}
                >{l}</a>
              ))}
            </div>
            <a href="#download" style={{ ...B, background: "#2997FF", color: "#fff", padding: "6px 20px", borderRadius: 999, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>Download</a>
          </div>
        </nav>

        {/* HERO */}
        <section id="hero" style={{ minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px 40px", textAlign: "center" }}>
          <div id="hero-inner" style={{ maxWidth: 740, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div id="hero-logo" style={{ marginBottom: 20 }}>
              <Image src="/logo.png" alt="Praesidia" width={360} height={360}
                style={{ margin: "0 auto", display: "block", objectFit: "cover", borderRadius: "50%", clipPath: "circle(42%)", filter: "drop-shadow(0 0 60px rgba(88,166,255,0.35)) drop-shadow(0 0 120px rgba(139,92,246,0.2))" }} />
            </div>
            <TypewriterEffectSmooth
              words={heroWords}
              className="!text-center"
              cursorClassName="!bg-[#58a6ff]"
            />
            <p style={{ ...BLG, marginTop: 24, maxWidth: 480, textAlign: "center" }}>
              The unified compliance barrier that stops violations before they happen.
            </p>
            <div id="hero-cta" style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 36 }}>
              <div style={{ position: "relative" }}>
                <GlowEffect mode="pulse" colors={["#2997FF", "#58a6ff", "#2997FF"]} blur="strong" scale={1.1} duration={3} className="!opacity-40" />
                <a href="#download" style={{ ...B, position: "relative", background: "#2997FF", color: "#fff", padding: "12px 32px", borderRadius: 999, fontSize: 15, fontWeight: 600, textDecoration: "none", display: "block" }}>Download</a>
              </div>
              <a href="#problem" style={{ ...B, background: "rgba(255,255,255,0.07)", color: "#fff", padding: "12px 32px", borderRadius: 999, fontSize: 15, fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.08)" }}>Learn more</a>
            </div>
            <div id="hero-pills" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 56 }}>
              {["Slack", "Teams", "Jira", "GitHub", "Git Hooks"].map((p) => (
                <span key={p} style={{ ...B, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "6px 16px", borderRadius: 999, fontSize: 12, color: "#a1a1aa" }}>{p}</span>
              ))}
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <section id="problem" style={{ padding: "80px 24px 56px", textAlign: "center" }}>
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            <p className="reveal" style={{ ...HLG, marginBottom: 8, textAlign: "center" }}>Every day, employees accidentally</p>
            <p className="reveal" style={{ ...HLG, marginBottom: 8, textAlign: "center" }}>expose <span style={{ color: "#FF453A" }}>sensitive data</span> across</p>
            <p className="reveal" style={{ ...HLG, marginBottom: 48, textAlign: "center" }}>Slack, Teams, Jira, and GitHub.</p>
            <p className="reveal" style={{ ...BLG, maxWidth: 580, margin: "0 auto", textAlign: "center" }}>
              One leaked SSN. One hardcoded API key. One SEC violation in a Slack channel. It costs companies millions — and nobody catches it until it&apos;s too late.
            </p>
          </div>

          <div style={{ maxWidth: 880, margin: "48px auto 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div id="cl" className="glass-card" style={{ padding: 32, textAlign: "center" }}>
              <p style={{ ...LABEL, color: "#FF453A", marginBottom: 20 }}>Communications</p>
              <h3 style={{ ...S, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Employees say the wrong thing.</h3>
              <p style={{ ...B, fontSize: 14, color: "#a1a1aa", lineHeight: 1.6, marginBottom: 20 }}>SEC violations, HIPAA breaches, antitrust issues — shared casually in Slack channels.</p>
              <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 16, fontFamily: "monospace", fontSize: 13, textAlign: "left" }}>
                <span style={{ color: "#555" }}>#deal-team</span><br />
                <span style={{ color: "#FF453A" }}>&quot;Don&apos;t tell investors about the Q3 miss until after they sign...&quot;</span>
              </div>
            </div>
            <div id="cr" className="glass-card" style={{ padding: 32, textAlign: "center" }}>
              <p style={{ ...LABEL, color: "#FF9F0A", marginBottom: 20 }}>Code</p>
              <h3 style={{ ...S, fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Developers commit secrets.</h3>
              <p style={{ ...B, fontSize: 14, color: "#a1a1aa", lineHeight: 1.6, marginBottom: 20 }}>PII, API keys, credentials — buried in diffs with vague commit messages.</p>
              <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 12, padding: 16, fontFamily: "monospace", fontSize: 13, textAlign: "left" }}>
                <span style={{ color: "#555" }}>$ git commit -m</span>{" "}
                <span style={{ color: "#FF9F0A" }}>&quot;minor updates&quot;</span><br />
                <span style={{ color: "#555" }}># contains: EMAIL, SSN, AWS_KEY</span>
              </div>
            </div>
          </div>
        </section>

        {/* SOLUTION */}
        <section id="sol" style={{ padding: "56px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 940, margin: "0 auto", width: "100%" }}>
            <p id="s1" style={{ ...LABEL, color: "#2997FF", marginBottom: 20, textAlign: "center" }}>The Solution</p>
            <h2 id="s2" style={{ ...HXL, textAlign: "center" }}>
              Stop it{" "}
              <span style={{ background: "linear-gradient(90deg, #2997FF, #3fb950)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>before</span>
              <br />it happens.
            </h2>
            <p id="s3" style={{ ...BLG, maxWidth: 520, margin: "20px auto 56px", textAlign: "center" }}>
              Local PII scrubbing. Human approval gates. Legal AI reasoning. Under 6 seconds.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 820, margin: "0 auto" }}>
              <div id="s4" className="glass-card" style={{ padding: 28, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <span style={{ ...B, background: "#2997FF", color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 999, letterSpacing: "0.1em" }}>LAYER 1</span>
                  <span style={{ ...B, fontSize: 12, color: "#a1a1aa" }}>Reactive</span>
                </div>
                <h3 style={{ ...S, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Communication Monitoring</h3>
                {["Intercept message", "Scrub PII locally", "Human approval gate", "Legal AI analysis", "SMS + audit log"].map((s, i) => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span style={{ ...B, width: 24, height: 24, borderRadius: "50%", background: "rgba(41,151,255,0.12)", color: "#2997FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ ...B, fontSize: 14, color: "#d4d4d8" }}>{s}</span>
                  </div>
                ))}
              </div>
              <div id="s5" className="glass-card" style={{ padding: 28, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <span style={{ ...B, background: "#30D158", color: "#000", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 999, letterSpacing: "0.1em" }}>LAYER 2</span>
                  <span style={{ ...B, fontSize: 12, color: "#a1a1aa" }}>Proactive</span>
                </div>
                <h3 style={{ ...S, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Code Barrier</h3>
                {["Pre-commit hook fires", "PII scan + risk triage", "Commit accuracy check", "Browser approval gate", "GitHub webhook backstop"].map((s, i) => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span style={{ ...B, width: 24, height: 24, borderRadius: "50%", background: "rgba(48,209,88,0.12)", color: "#30D158", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ ...B, fontSize: 14, color: "#d4d4d8" }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section style={{ padding: "80px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 880, margin: "0 auto", marginBottom: 64 }}>
            <p style={{ ...LABEL, color: "#30D158", marginBottom: 20, textAlign: "center" }}>Performance</p>
            <h2 style={{ ...HLG, textAlign: "center" }}>Built for speed.</h2>
          </div>
          <div style={{ maxWidth: 700, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 40 }}>
            {[{ v: "<6s", l: "Detection" }, { v: "15+", l: "PII types" }, { v: "4", l: "Platforms" }, { v: "100%", l: "Local scrub" }].map((s) => (
              <div key={s.l} className="si" style={{ textAlign: "center" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(40px, 5vw, 60px)", fontWeight: 900, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #fff 30%, #58a6ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.v}</p>
                <p style={{ ...LABEL, color: "#a1a1aa", marginTop: 12 }}>{s.l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES — Bento Grid */}
        <section id="features" style={{ padding: "80px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <p style={{ ...LABEL, color: "#2997FF", marginBottom: 16, textAlign: "center" }}>Capabilities</p>
            <h2 style={{ ...HLG, marginBottom: 48, textAlign: "center" }}>Everything you need.</h2>

            <BentoGrid className="!grid-cols-3 !auto-rows-[140px] gap-4">
              <BentoCard name="Local PII Scrubbing" className="bento-card col-span-2" Icon={IconScrub}
                description="Presidio on-device. 15+ entity types. SSNs, emails, API keys, credit cards. Nothing leaves your machine."
                background={<div className="absolute inset-0 bg-gradient-to-br from-[rgba(88,166,255,0.08)] to-transparent" />}
                href="#" cta="Learn more" />
              <BentoCard name="Human Approval Gate" className="bento-card col-span-1" Icon={IconGate}
                description="Approve, Edit, or Block. Legally significant audit trail."
                background={<div className="absolute inset-0 bg-gradient-to-br from-[rgba(48,209,88,0.08)] to-transparent" />}
                href="#" cta="Learn more" />
              <BentoCard name="AI Legal Reasoning" className="bento-card col-span-1" Icon={IconLegal}
                description="K2 Think V2 against SEC, HIPAA, GDPR."
                background={<div className="absolute inset-0 bg-gradient-to-br from-[rgba(167,139,250,0.08)] to-transparent" />}
                href="#" cta="Learn more" />
              <BentoCard name="SMS Escalation" className="bento-card col-span-1" Icon={IconSMS}
                description="Twilio alerts to author and manager."
                background={<div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,159,10,0.08)] to-transparent" />}
                href="#" cta="Learn more" />
              <BentoCard name="Git Pre-Commit Hooks" className="bento-card col-span-1" Icon={IconGit}
                description="Blocks commits before they exist."
                background={<div className="absolute inset-0 bg-gradient-to-br from-[rgba(255,69,58,0.08)] to-transparent" />}
                href="#" cta="Learn more" />
              <BentoCard name="Compliance Dashboard" className="bento-card col-span-2" Icon={IconDash}
                description="Real-time audit log. Filter by user, source, violation type, date. CSV export for legal discovery."
                background={<div className="absolute inset-0 bg-gradient-to-br from-[rgba(41,151,255,0.08)] to-transparent" />}
                href="#" cta="Learn more" />
              <BentoCard name="Org Memory" className="bento-card col-span-1" Icon={IconLegal}
                description="Mem0 stores policies, incidents, NDA clauses. Learns over time."
                background={<div className="absolute inset-0 bg-gradient-to-br from-[rgba(139,92,246,0.08)] to-transparent" />}
                href="#" cta="Learn more" />
            </BentoGrid>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: "80px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            <p style={{ ...LABEL, color: "#a78bfa", marginBottom: 20, textAlign: "center" }}>Architecture</p>
            <h2 style={{ ...HLG, marginBottom: 56, textAlign: "center" }}>Why local-first.</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
              {[
                { q: "Why scrub locally?", a: "Sending raw PII to cloud APIs is itself a HIPAA violation. Praesidia scrubs on-device. Only redacted text reaches legal AI." },
                { q: "Why a human gate?", a: "Full automation kills trust. The gate creates a legal record with timestamps. Liability shifts on override." },
                { q: "Why not an extension?", a: "Extensions are disableable and Chrome-only. Webhooks + local hooks cover every platform and device." },
              ].map((f) => (
                <div key={f.q} className="fq glass-card" style={{ padding: 28, textAlign: "center" }}>
                  <h4 style={{ ...S, fontWeight: 700, marginBottom: 12, fontSize: 16 }}>{f.q}</h4>
                  <p style={{ ...B, fontSize: 14, color: "#a1a1aa", lineHeight: 1.6 }}>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DOWNLOAD */}
        <section id="download" style={{ padding: "80px 24px", textAlign: "center" }}>
          <div id="dl" style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Image src="/logo.png" alt="Praesidia" width={72} height={72}
              style={{ margin: "0 auto 32px", borderRadius: "50%", display: "block", filter: "drop-shadow(0 0 40px rgba(88,166,255,0.3))" }} />
            <h2 style={{ ...HXL, textAlign: "center" }}>
              <span style={{ background: "linear-gradient(135deg, #58a6ff, #3fb950)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Get Praesidia.</span>
            </h2>
            <p style={{ ...BLG, margin: "16px 0 40px", textAlign: "center" }}>One command. Fully local.</p>

            <div className="glass-card" style={{ padding: 20, textAlign: "left", marginBottom: 32, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57" }} />
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FEBC2E" }} />
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840" }} />
                </div>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "#555" }}>terminal</span>
              </div>
              <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 10, padding: 16, fontFamily: "monospace", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <code style={{ color: "#30D158", lineHeight: 1.8 }}>
                  <span style={{ color: "#555" }}>$</span> git clone https://github.com/Willgunter/yhack2026.git<br />
                  <span style={{ color: "#555" }}>$</span> cd yhack2026<br />
                  <span style={{ color: "#555" }}>$</span> bash praesidia/install.sh
                </code>
                <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", flexShrink: 0, marginTop: 2 }}>
                  {copied
                    ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#30D158"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  }
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <GlowEffect mode="pulse" colors={["#2997FF", "#58a6ff", "#2997FF"]} blur="medium" scale={1.05} duration={4} className="!opacity-30" />
                <a href="https://github.com/Willgunter/yhack2026/archive/refs/heads/main.zip" style={{ ...B, position: "relative", background: "#2997FF", color: "#fff", padding: "10px 24px", borderRadius: 999, fontSize: 14, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download .zip
                </a>
              </div>
              <a href="https://github.com/Willgunter/yhack2026" target="_blank" rel="noopener noreferrer" style={{ ...B, background: "rgba(255,255,255,0.07)", color: "#fff", padding: "10px 24px", borderRadius: 999, fontSize: 14, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                GitHub
              </a>
            </div>
            <p style={{ ...B, fontSize: 11, color: "#555", marginTop: 32, textAlign: "center" }}>Python 3.11+ &middot; pip &middot; git &middot; ~600MB for NLP model &middot; Windows, macOS, Linux</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "32px 24px" }}>
          <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Image src="/logo.png" alt="" width={16} height={16} style={{ borderRadius: "50%" }} />
              <span style={{ ...B, fontSize: 11, color: "#555" }}>Built at YHack 2026 &middot; Yale University</span>
            </div>
            <a href="https://github.com/Willgunter/yhack2026" target="_blank" rel="noopener noreferrer" style={{ ...B, fontSize: 11, color: "#555", textDecoration: "none" }}>
              github.com/Willgunter/yhack2026
            </a>
          </div>
        </footer>
      </div>
    </BackgroundGradientAnimation>
  );
}
