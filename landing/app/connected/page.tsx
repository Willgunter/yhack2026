"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

function ConnectedContent() {
  const params = useSearchParams();
  const team = params.get("team");
  const error = params.get("error");

  if (error) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#080b14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(255,69,58,0.1)", border: "2px solid rgba(255,69,58,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
            animation: "fadeIn 0.6s ease",
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
            Connection Failed
          </h1>
          <p style={{ fontSize: 16, color: "#a1a1aa", lineHeight: 1.6, marginBottom: 32 }}>
            {error === "access_denied"
              ? "You declined the Slack authorization. No worries — you can try again from the app."
              : `Something went wrong: ${error}`}
          </p>
          <p style={{ fontSize: 13, color: "#555" }}>You can close this tab.</p>
        </div>
        <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080b14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: 600, height: 600,
        background: "radial-gradient(circle, rgba(48,209,88,0.12), transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{ textAlign: "center", maxWidth: 420, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <Image src="/logo.png" alt="Praesidia" width={64} height={64}
          style={{
            margin: "0 auto 32px", display: "block",
            borderRadius: "50%", clipPath: "circle(42%)",
            filter: "drop-shadow(0 0 30px rgba(88,166,255,0.3))",
          }} />

        {/* Animated checkmark */}
        <div style={{
          width: 88, height: 88, borderRadius: "50%",
          background: "rgba(48,209,88,0.1)", border: "2px solid rgba(48,209,88,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 28px",
          animation: "fadeIn 0.6s ease, pulse 2s ease infinite",
        }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: "drawCheck 0.5s ease 0.3s both" }}>
            <path d="M5 13l4 4L19 7" style={{
              strokeDasharray: 24,
              strokeDashoffset: 24,
              animation: "drawCheck 0.5s ease 0.3s forwards",
            }} />
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 32, fontWeight: 700, color: "#fff", marginBottom: 8,
          animation: "fadeIn 0.6s ease 0.2s both",
        }}>
          Connected!
        </h1>

        {/* Team name */}
        {team && (
          <p style={{
            fontSize: 18, color: "#30D158", fontWeight: 600, marginBottom: 24,
            animation: "fadeIn 0.6s ease 0.4s both",
          }}>
            {decodeURIComponent(team)}
          </p>
        )}

        {/* Instructions */}
        <p style={{
          fontSize: 16, color: "#a1a1aa", lineHeight: 1.6, marginBottom: 8,
          animation: "fadeIn 0.6s ease 0.5s both",
        }}>
          Slack workspace successfully linked to Praesidia.
        </p>
        <p style={{
          fontSize: 16, color: "#a1a1aa", lineHeight: 1.6, marginBottom: 40,
          animation: "fadeIn 0.6s ease 0.6s both",
        }}>
          You can close this tab and return to the app.
        </p>

        {/* Shield badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
          padding: "8px 20px", borderRadius: 999,
          animation: "fadeIn 0.6s ease 0.7s both",
        }}>
          <svg width="14" height="14" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L6 14v12c0 11 8 18 18 20 10-2 18-9 18-20V14L24 4z" fill="rgba(48,209,88,0.15)" stroke="#30D158" strokeWidth="2" />
            <path d="M18 24l4 4 8-8" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 12, color: "#a1a1aa" }}>Protected by Praesidia</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(48,209,88,0.2); }
          50% { box-shadow: 0 0 0 12px rgba(48,209,88,0); }
        }
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

export default function ConnectedPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#080b14", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#a1a1aa", fontFamily: "'Space Grotesk', sans-serif" }}>Loading...</p>
      </div>
    }>
      <ConnectedContent />
    </Suspense>
  );
}
