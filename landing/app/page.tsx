"use client";

import { motion } from "framer-motion";
import { useState } from "react";

/* ───── Animations ───── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ───── Shield SVG ───── */
function Shield({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 140" fill="none" className={className}>
      <path
        d="M60 8L12 36v36c0 33 20 54 48 60 28-6 48-27 48-60V36L60 8z"
        fill="#161b22"
        stroke="#58a6ff"
        strokeWidth="2.5"
      />
      <path
        d="M60 28L28 46v24c0 22 14 38 32 42 18-4 32-20 32-42V46L60 28z"
        fill="#0d1117"
        stroke="#58a6ff"
        strokeWidth="1.5"
      />
      <circle cx="60" cy="62" r="8" fill="#58a6ff" />
      <path
        d="M60 50v-8M60 74v8M48 62h-8M72 62h8"
        stroke="#58a6ff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M50 52l-5-5M70 72l5 5M70 52l5-5M50 72l-5 5"
        stroke="#58a6ff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

/* ───── Feature Card ───── */
function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="card-hover bg-[#161b22] border border-[#30363d] rounded-xl p-6"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-[#f0f6fc] mb-2">{title}</h3>
      <p className="text-sm text-[#8b949e] leading-relaxed">{desc}</p>
    </motion.div>
  );
}

/* ───── Flow Step ───── */
function FlowStep({
  num,
  title,
  desc,
  color,
}: {
  num: number;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <motion.div variants={fadeUp} className="flex items-start gap-4">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
        style={{ background: color }}
      >
        {num}
      </div>
      <div>
        <h4 className="font-semibold text-[#f0f6fc] mb-1">{title}</h4>
        <p className="text-sm text-[#8b949e] leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ───── Main Page ───── */
export default function Home() {
  const [copied, setCopied] = useState(false);

  function copyClone() {
    navigator.clipboard.writeText("git clone https://github.com/Willgunter/yhack2026.git && cd yhack2026 && bash praesidia/install.sh");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid-bg min-h-screen">
      {/* ─── NAV ─── */}
      <nav className="fixed top-0 w-full z-50 bg-[#0d1117]/80 backdrop-blur-md border-b border-[#30363d]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <span className="font-bold text-lg text-[#f0f6fc]">Praesidia</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#8b949e]">
            <a href="#problem" className="hover:text-[#f0f6fc] transition">Problem</a>
            <a href="#how-it-works" className="hover:text-[#f0f6fc] transition">How It Works</a>
            <a href="#features" className="hover:text-[#f0f6fc] transition">Features</a>
            <a href="#download" className="hover:text-[#f0f6fc] transition">Download</a>
          </div>
          <a
            href="#download"
            className="bg-[#58a6ff] text-[#0d1117] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#79c0ff] transition"
          >
            Get Started
          </a>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <Shield className="w-28 h-28 mx-auto mb-8 shield-glow" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-5xl md:text-7xl font-extrabold mb-4"
          >
            <span className="gradient-text">Praesidia</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="text-xl md:text-2xl text-[#8b949e] mb-4 font-light"
          >
            Multiple lines of defense
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="text-base md:text-lg text-[#c9d1d9] max-w-3xl mx-auto mb-10 leading-relaxed"
          >
            The first unified compliance barrier that stops PII leaks, policy violations,
            and secret exposure across Slack, Teams, Jira, and GitHub —{" "}
            <span className="text-[#58a6ff] font-semibold">before they happen.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href="#download"
              className="bg-[#238636] text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-[#2ea043] transition"
            >
              Download Now
            </a>
            <a
              href="#how-it-works"
              className="border border-[#30363d] text-[#c9d1d9] px-8 py-3 rounded-lg font-semibold text-lg hover:border-[#58a6ff] hover:text-[#58a6ff] transition"
            >
              See How It Works
            </a>
          </motion.div>

          {/* Platform badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="flex flex-wrap justify-center gap-3 mt-12"
          >
            {["Slack", "Microsoft Teams", "Jira", "GitHub", "Git Hooks"].map((p) => (
              <span
                key={p}
                className="bg-[#161b22] border border-[#30363d] px-4 py-1.5 rounded-full text-xs text-[#8b949e] font-medium"
              >
                {p}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── PROBLEM ─── */}
      <section id="problem" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Compliance violations happen in{" "}
                <span className="text-[#da3633]">two forms</span>
              </h2>
              <p className="text-[#8b949e] max-w-2xl mx-auto">
                Organizations lose millions to accidental PII exposure, regulatory
                violations, and secret leaks every year. Existing tools are siloed,
                retroactive, or lack real legal reasoning.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              <motion.div
                variants={fadeUp}
                className="bg-[#161b22] border border-[#da3633]/30 rounded-xl p-8"
              >
                <div className="text-3xl mb-4">💬</div>
                <h3 className="text-xl font-bold text-[#da3633] mb-3">
                  Communication Violations
                </h3>
                <p className="text-[#8b949e] text-sm leading-relaxed mb-4">
                  Employees share sensitive data in Slack, Teams, and Jira without
                  realizing it violates SEC, HIPAA, GDPR, or company policy.
                </p>
                <div className="bg-[#0d1117] rounded-lg p-4 font-mono text-sm">
                  <span className="text-[#8b949e]">#deal-team</span>
                  <br />
                  <span className="text-[#da3633]">
                    &quot;Don&apos;t tell investors about the Q3 revenue miss until
                    after they sign...&quot;
                  </span>
                </div>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="bg-[#161b22] border border-[#d29922]/30 rounded-xl p-8"
              >
                <div className="text-3xl mb-4">💻</div>
                <h3 className="text-xl font-bold text-[#d29922] mb-3">
                  Code Violations
                </h3>
                <p className="text-[#8b949e] text-sm leading-relaxed mb-4">
                  Developers commit PII, API keys, and secrets with vague commit
                  messages that make audit trails useless.
                </p>
                <div className="bg-[#0d1117] rounded-lg p-4 font-mono text-sm">
                  <span className="text-[#8b949e]">$ git commit -m</span>{" "}
                  <span className="text-[#d29922]">&quot;minor updates&quot;</span>
                  <br />
                  <span className="text-[#8b949e]">
                    # user_data_handler.py: hardcoded email + SSN
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-20 px-6 bg-[#161b22]/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Two layers. <span className="text-[#58a6ff]">Zero gaps.</span>
              </h2>
              <p className="text-[#8b949e] max-w-2xl mx-auto">
                Every message and every commit passes through local PII scrubbing,
                a human approval gate, and AI legal reasoning — in under 6 seconds.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-12">
              {/* Layer 1 */}
              <motion.div variants={fadeUp}>
                <div className="flex items-center gap-3 mb-6">
                  <span className="bg-[#58a6ff] text-[#0d1117] px-3 py-1 rounded-full text-xs font-bold">
                    LAYER 1
                  </span>
                  <h3 className="text-xl font-bold">Reactive — Communications</h3>
                </div>
                <div className="space-y-6">
                  <FlowStep
                    num={1}
                    title="Message Intercepted"
                    desc="Slack, Teams, or Jira webhook catches the message in real time"
                    color="#58a6ff"
                  />
                  <FlowStep
                    num={2}
                    title="Local PII Scrubbing"
                    desc="Presidio runs on-device — SSNs, emails, API keys detected before anything leaves the machine"
                    color="#58a6ff"
                  />
                  <FlowStep
                    num={3}
                    title="Human Approval Gate"
                    desc="If PII is detected, the user must approve, edit, or block before the message proceeds"
                    color="#58a6ff"
                  />
                  <FlowStep
                    num={4}
                    title="Legal AI Analysis"
                    desc="K2 Think V2 checks against org policies, SEC, HIPAA, GDPR — with specific citations"
                    color="#58a6ff"
                  />
                  <FlowStep
                    num={5}
                    title="Alert & Audit"
                    desc="SMS to user + manager, violation logged to compliance dashboard with full audit trail"
                    color="#58a6ff"
                  />
                </div>
              </motion.div>

              {/* Layer 2 */}
              <motion.div variants={fadeUp}>
                <div className="flex items-center gap-3 mb-6">
                  <span className="bg-[#3fb950] text-[#0d1117] px-3 py-1 rounded-full text-xs font-bold">
                    LAYER 2
                  </span>
                  <h3 className="text-xl font-bold">Proactive — Code Barrier</h3>
                </div>
                <div className="space-y-6">
                  <FlowStep
                    num={1}
                    title="Pre-Commit Hook Fires"
                    desc="Before the commit exists, Praesidia scans the staged diff"
                    color="#3fb950"
                  />
                  <FlowStep
                    num={2}
                    title="PII + Risk Triage"
                    desc="Files triaged by risk level — auth, config, env, patient, billing files flagged immediately"
                    color="#3fb950"
                  />
                  <FlowStep
                    num={3}
                    title="Commit Accuracy Check"
                    desc="Is 'minor updates' accurate when 47 lines changed across auth files? Score: 23/100"
                    color="#3fb950"
                  />
                  <FlowStep
                    num={4}
                    title="Browser Approval Gate"
                    desc="Developer reviews findings, approves or blocks. Every decision is logged."
                    color="#3fb950"
                  />
                  <FlowStep
                    num={5}
                    title="GitHub Webhook Backstop"
                    desc="If --no-verify bypasses the hook, GitHub webhook catches the push as a second layer"
                    color="#3fb950"
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Built for <span className="text-[#58a6ff]">enterprise compliance</span>
              </h2>
              <p className="text-[#8b949e] max-w-2xl mx-auto">
                Every component runs locally first. PII never leaves the device
                until it&apos;s scrubbed. The original is never stored — only a hash.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon="🔒"
                title="Local PII/PHI Scrubbing"
                desc="Microsoft Presidio runs fully on-device. Detects SSNs, emails, API keys, AWS keys, GitHub tokens, and 15+ entity types. Nothing leaves the machine."
              />
              <FeatureCard
                icon="👤"
                title="Human Approval Gate"
                desc="Three choices: Approve, Edit, or Block. Creates a legally significant audit trail with timestamp and user attribution. Shifts liability on override."
              />
              <FeatureCard
                icon="⚖️"
                title="AI Legal Reasoning"
                desc="K2 Think V2 analyzes scrubbed content against org policies, SEC Reg FD, HIPAA, GDPR, FMLA, and antitrust law with specific citations."
              />
              <FeatureCard
                icon="📱"
                title="SMS Escalation"
                desc="Twilio SMS alerts to the author and their manager. Creates professional accountability that changes behavior at scale."
              />
              <FeatureCard
                icon="🧠"
                title="Organizational Memory"
                desc="Mem0 stores your company's policies, past incidents, NDA clauses, and contract terms. The system gets smarter with every event."
              />
              <FeatureCard
                icon="📊"
                title="Compliance Dashboard"
                desc="Real-time audit log filterable by user, source, violation type, date range. Exportable to CSV for legal discovery."
              />
              <FeatureCard
                icon="🔗"
                title="Git Pre-Commit Hooks"
                desc="Intercepts commits before they exist. Scans diffs for PII, checks commit accuracy, triages files by risk. Under 6 seconds."
              />
              <FeatureCard
                icon="🏢"
                title="Enterprise User Registry"
                desc="Role-based user management with manager chains. Resolve any platform identity (Slack, Teams, Git, Jira) to a single user record."
              />
              <FeatureCard
                icon="🔔"
                title="Desktop Notifications"
                desc="Native OS notifications via plyer. Works on Windows, macOS, and Linux. No browser extension required."
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── WHY LOCAL ─── */}
      <section className="py-20 px-6 bg-[#161b22]/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why <span className="text-[#3fb950]">local-first</span> matters
              </h2>
            </motion.div>

            <div className="space-y-6">
              {[
                {
                  q: "Why not just send messages to a cloud API for scanning?",
                  a: "Because sending raw employee communications containing PII to external APIs could itself be a HIPAA or GDPR violation. Praesidia scrubs locally first, then only sends the redacted version for legal analysis.",
                },
                {
                  q: "Why a human gate instead of fully automated blocking?",
                  a: "Automated blocking creates false positive friction that makes people disable the tool. Sometimes PII needs to be shared legitimately. The human gate creates a legally significant audit trail — 'User X knowingly approved sending PHI at 14:32.'",
                },
                {
                  q: "Why not a Chrome extension?",
                  a: "Extensions can be disabled, don't work on desktop apps or mobile, and require Chrome Web Store approval. Server-side webhooks + local git hooks cover all platforms reliably without touching the browser.",
                },
              ].map((faq) => (
                <motion.div
                  key={faq.q}
                  variants={fadeUp}
                  className="bg-[#161b22] border border-[#30363d] rounded-xl p-6"
                >
                  <h4 className="font-semibold text-[#f0f6fc] mb-2">{faq.q}</h4>
                  <p className="text-sm text-[#8b949e] leading-relaxed">{faq.a}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── DOWNLOAD ─── */}
      <section id="download" className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
          >
            <motion.div variants={fadeUp}>
              <Shield className="w-20 h-20 mx-auto mb-6 shield-glow" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Get <span className="gradient-text">Praesidia</span>
              </h2>
              <p className="text-[#8b949e] max-w-xl mx-auto mb-10">
                One command installs everything. Runs locally on your machine. Python 3.11+ required.
              </p>
            </motion.div>

            {/* Clone option */}
            <motion.div
              variants={fadeUp}
              className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 mb-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[#f0f6fc]">
                  Option 1: Clone &amp; Install
                </h3>
                <span className="bg-[#238636] text-white text-xs px-3 py-1 rounded-full font-bold">
                  RECOMMENDED
                </span>
              </div>
              <div className="bg-[#0d1117] rounded-lg p-4 font-mono text-sm flex items-center justify-between group">
                <code className="text-[#79c0ff] break-all">
                  git clone https://github.com/Willgunter/yhack2026.git && cd
                  yhack2026 && bash praesidia/install.sh
                </code>
                <button
                  onClick={copyClone}
                  className="ml-4 flex-shrink-0 text-[#8b949e] hover:text-[#f0f6fc] transition"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <svg className="w-5 h-5 text-[#3fb950]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="mt-4 text-sm text-[#8b949e]">
                <p className="mb-2">This will:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Install Presidio, spaCy, and all dependencies</li>
                  <li>Download the NLP language model (~560MB one-time)</li>
                  <li>Set up global git pre-commit hooks</li>
                  <li>Initialize the audit database</li>
                  <li>Start the Praesidia server on localhost:5001</li>
                </ul>
              </div>
            </motion.div>

            {/* Download option */}
            <motion.div
              variants={fadeUp}
              className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-left"
            >
              <h3 className="font-semibold text-[#f0f6fc] mb-4">
                Option 2: Download Release
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://github.com/Willgunter/yhack2026/archive/refs/heads/main.zip"
                  className="bg-[#58a6ff] text-[#0d1117] px-6 py-3 rounded-lg font-semibold text-center hover:bg-[#79c0ff] transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download .zip
                </a>
                <a
                  href="https://github.com/Willgunter/yhack2026"
                  className="border border-[#30363d] text-[#c9d1d9] px-6 py-3 rounded-lg font-semibold text-center hover:border-[#58a6ff] transition flex items-center justify-center gap-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  View on GitHub
                </a>
              </div>
              <p className="mt-4 text-sm text-[#8b949e]">
                After downloading, unzip and run{" "}
                <code className="bg-[#0d1117] px-2 py-0.5 rounded text-[#79c0ff]">
                  bash praesidia/install.sh
                </code>
              </p>
            </motion.div>

            {/* Requirements */}
            <motion.div variants={fadeUp} className="mt-8 text-sm text-[#8b949e]">
              <p>
                <strong className="text-[#f0f6fc]">Requirements:</strong> Python
                3.11+ &middot; pip &middot; git &middot; ~600MB disk for NLP model
              </p>
              <p className="mt-1">
                Works on Windows, macOS, and Linux. No admin privileges required.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[#30363d] py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <span className="text-sm text-[#8b949e]">
              Praesidia &mdash; Built at YHack 2026, Yale University
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#8b949e]">
            <a
              href="https://github.com/Willgunter/yhack2026"
              className="hover:text-[#f0f6fc] transition"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <span>&middot;</span>
            <span>March 28-29, 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
