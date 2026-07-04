import { useState, useRef, useCallback, useEffect } from "react";
import { Zap, X, Clock, Globe, ArrowLeft, Shield, LogOut, MessageCircle } from "lucide-react";
import logoCircle from "./logo-circle.png";
import { supabase } from "./supabaseClient";

function useSounds() {
  const ctxRef = useRef(null);
  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  };

  const playClick = useCallback(() => {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.12);
  }, []);

  const playRoll = useCallback(() => {
    const ctx = getCtx();
    const now = ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(250 + i * 30, now + i * 0.1);
      gain.gain.setValueAtTime(0.07, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.08);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.08);
    }
  }, []);

  const playReveal = useCallback(() => {
    const ctx = getCtx();
    const now = ctx.currentTime;
    [523.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.001, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.4);
    });
  }, []);

  const playClose = useCallback(() => {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.15);
  }, []);

  const playLogo = useCallback(() => {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.35);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.5);
  }, []);

  return { playClick, playRoll, playReveal, playClose, playLogo };
}

function GlitchText({ children, className = "" }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="absolute inset-0 text-[#3b82ff] opacity-70" style={{ animation: "glitchA 3.2s infinite", clipPath: "inset(0 0 60% 0)" }} aria-hidden="true">{children}</span>
      <span className="absolute inset-0 text-[#5DA9FF] opacity-60" style={{ animation: "glitchB 3.2s infinite", clipPath: "inset(60% 0 0 0)" }} aria-hidden="true">{children}</span>
      <span className="relative">{children}</span>
    </span>
  );
}

const COOLDOWN_MS = 60 * 1000; // 1 real minute
const SPARK_COLORS = ["#3b82ff", "#8ab4ff", "#ffd65d", "#5da9ff"];

function Sparkles({ burstKey }) {
  const particles = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 60 + Math.random() * 50;
    return {
      id: `${burstKey}-${i}`,
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist,
      color: SPARK_COLORS[i % SPARK_COLORS.length],
      size: 3 + Math.random() * 4,
      delay: Math.random() * 0.06,
    };
  });
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `sparkleBurst 0.8s ease-out ${p.delay}s forwards`,
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
          }}
        />
      ))}
    </div>
  );
}

export default function MainApp({ profile, onLogout, onOpenAdmin }) {
  const [open, setOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null); // "small" | "big"
  const [displayNum, setDisplayNum] = useState(0);
  const [msLeftInCycle, setMsLeftInCycle] = useState(0);
  const [usedThisCycle, setUsedThisCycle] = useState(false);
  const [waitFlash, setWaitFlash] = useState(false);
  const [history, setHistory] = useState([]); // last few results, newest first
  const [burstKey, setBurstKey] = useState(0);
  const [viewingUrl, setViewingUrl] = useState(null);
  const [fixedLink, setFixedLink] = useState(null);
  const [appTitle, setAppTitle] = useState("Isaaamu");
  const [tagline, setTagline] = useState("Opens a random small/big generator — one per minute");
  const [footerNote, setFooterNote] = useState("Random generator · for fun only");
  const [popupPos, setPopupPos] = useState({ x: null, y: null }); // null = default centered
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const cycleIndexRef = useRef(-1);
  const { playClick, playRoll, playReveal, playClose, playLogo } = useSounds();

  // Fetch admin-editable content — fixed link, title, tagline, footer note
  useEffect(() => {
    supabase
      .from("app_content")
      .select("key, value")
      .then(({ data }) => {
        if (!data) return;
        const map = Object.fromEntries(data.map((row) => [row.key, row.value]));
        if (map.fixed_link) setFixedLink(map.fixed_link);
        if (map.app_title) setAppTitle(map.app_title);
        if (map.tagline) setTagline(map.tagline);
        if (map.footer_note) setFooterNote(map.footer_note);
      });
  }, []);

  // Locked to the real wall clock: the cycle boundary is always the top of
  // the current minute (e.g. 5:14:30 -> 30s left until 5:15:00), not a
  // timer that starts whenever the popup is opened.
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const cycleIndex = Math.floor(now.getTime() / COOLDOWN_MS);
      const msIntoCycle = now.getTime() % COOLDOWN_MS;
      setMsLeftInCycle(COOLDOWN_MS - msIntoCycle);

      if (cycleIndexRef.current === -1) {
        cycleIndexRef.current = cycleIndex;
      } else if (cycleIndex !== cycleIndexRef.current) {
        cycleIndexRef.current = cycleIndex;
        setUsedThisCycle(false);
        setResult(null);
      }
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, []); // runs continuously regardless of popup open/close

  useEffect(() => {
    if (!rolling) return;
    const iv = setInterval(() => setDisplayNum(Math.floor(Math.random() * 10)), 70);
    return () => clearInterval(iv);
  }, [rolling]);

  const openPopup = () => {
    playClick();
    setOpen(true);
    setTimeout(() => playLogo(), 250);
  };
  const closePopup = () => { playClose(); setOpen(false); };

  const handleDragStart = (clientX, clientY) => {
    dragState.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      origX: popupPos.x ?? window.innerWidth / 2 - 160,
      origY: popupPos.y ?? window.innerHeight / 2 - 200,
    };
  };
  const handleDragMove = (clientX, clientY) => {
    if (!dragState.current.dragging) return;
    const dx = clientX - dragState.current.startX;
    const dy = clientY - dragState.current.startY;
    setPopupPos({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
  };
  const handleDragEnd = () => { dragState.current.dragging = false; };

  const onHeaderPointerDown = (e) => {
    e.preventDefault();
    handleDragStart(e.clientX ?? e.touches?.[0]?.clientX, e.clientY ?? e.touches?.[0]?.clientY);
  };
  const onHeaderPointerMove = (e) => {
    handleDragMove(e.clientX ?? e.touches?.[0]?.clientX, e.clientY ?? e.touches?.[0]?.clientY);
  };

  const openUrl = () => {
    if (!fixedLink) return;
    let url = fixedLink.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    playClick();
    setViewingUrl(url);
  };

  const closeWebsite = () => {
    playClose();
    setViewingUrl(null);
  };

  const generate = () => {
    if (rolling) return;

    if (usedThisCycle) {
      playClick();
      setWaitFlash(true);
      setTimeout(() => setWaitFlash(false), 1400);
      return;
    }

    playRoll();
    setRolling(true);
    setResult(null);

    setTimeout(() => {
      setRolling(false);
      const finalNum = Math.floor(Math.random() * 10); // 0-9
      const side = finalNum <= 4 ? "small" : "big";
      setResult(side);
      setUsedThisCycle(true);
      setHistory((h) => [side, ...h].slice(0, 8));
      setBurstKey((k) => k + 1);
      playReveal();

      // Log to the user's own history (RLS ensures they only ever see their own)
      if (profile?.id) {
        supabase.from("result_history").insert({ user_id: profile.id, result: side })
          .then(({ error }) => { if (error) console.error("Failed to log result:", error); });
      }
    }, 1400);
  };

  const secondsLeft = Math.ceil(msLeftInCycle / 1000);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progressPct = Math.max(0, Math.min(100, (msLeftInCycle / COOLDOWN_MS) * 100));

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-mono relative overflow-hidden">
      <style>{`
        @keyframes glitchA { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-2px,1px)} 40%{transform:translate(2px,-1px)} 60%{transform:translate(-1px,0)} 80%{transform:translate(1px,1px)} }
        @keyframes glitchB { 0%,100%{transform:translate(0,0)} 25%{transform:translate(2px,-1px)} 50%{transform:translate(-2px,1px)} 75%{transform:translate(1px,-1px)} }
        @keyframes boxPulse { 0%,100%{box-shadow:0 0 20px 2px rgba(59,130,255,0.45)} 50%{box-shadow:0 0 40px 6px rgba(59,130,255,0.75)} }
        @keyframes popIn { 0%{transform:scale(0.85) translateY(20px);opacity:0} 60%{transform:scale(1.02) translateY(-2px);opacity:1} 100%{transform:scale(1) translateY(0);opacity:1} }
        @keyframes scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(100%)} }
        @keyframes flicker { 0%,100%{opacity:1} 50%{opacity:0.85} }
        @keyframes resultPop { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.15);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes cornerPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes logoSpin { to { transform: rotate(360deg); } }
        @keyframes logoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes logoGlow { 0%,100%{box-shadow:0 0 10px 2px rgba(59,130,255,0.5)} 50%{box-shadow:0 0 22px 6px rgba(59,130,255,0.85)} }
        @keyframes logoIn { 0%{transform:scale(0) rotate(-30deg);opacity:0} 60%{transform:scale(1.15) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes sparkleBurst { to { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; } }
        @keyframes livePulse { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:0.4; transform:scale(0.7)} }
        @keyframes shine { 0%{transform:translateX(-120%) skewX(-20deg)} 100%{transform:translateX(220%) skewX(-20deg)} }
        @keyframes shimmerText { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
      `}</style>

      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center justify-between mb-6">
          <p className="text-white/40 text-xs">
            Signed in as <span className="text-white/70 font-semibold">{profile?.username}</span>
          </p>
          <div className="flex items-center gap-3">
            {profile?.role === "admin" && (
              <button onClick={onOpenAdmin} className="text-[#3b82ff] hover:text-[#8ab4ff]" title="Admin panel">
                <Shield size={17} />
              </button>
            )}
            <button onClick={onLogout} className="text-white/40 hover:text-white" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="text-center mb-10">
          <p className="text-[#3b82ff] text-xs tracking-[0.35em] uppercase mb-2">System Ready</p>
          <h1 className="text-white text-2xl font-semibold">Tap Start</h1>
          <p className="text-white/40 text-sm mt-2">{tagline}</p>
        </div>

        <button
          onClick={openPopup}
          className="w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform border border-[#3b82ff]/60"
          style={{ background: "linear-gradient(90deg, #2a0000, #1a0000)", animation: "boxPulse 2.2s ease-in-out infinite" }}
        >
          <Zap size={18} strokeWidth={2.5} className="text-[#3b82ff]" />
          START
        </button>

        {/* In-app browser — opens the admin-set link inside the app's own window */}
        {fixedLink && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-white/40 text-xs tracking-widest uppercase mb-3 flex items-center gap-2">
              <Globe size={13} /> Website
            </p>
            <button
              onClick={openUrl}
              className="w-full py-3 rounded-lg text-white text-sm font-semibold active:scale-95 transition-transform"
              style={{ background: "linear-gradient(90deg, #3b82ff, #0037a8)" }}
            >
              Open Website
            </button>
          </div>
        )}

        <a
          href="https://t.me/ISAMUUUUU"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-1.5 text-white/40 text-[11px] border border-white/10 rounded-md py-1.5 hover:text-white/70 hover:border-white/20 transition-colors"
        >
          <MessageCircle size={11} /> Contact
        </a>
      </div>

      {/* Embedded website view — stays inside the app's own screen */}
      {viewingUrl && (
        <div className="fixed inset-0 bg-black z-40 flex flex-col">
          <div className="flex items-center gap-3 px-3 py-3 bg-[#02080a] border-b border-[#3b82ff]/30">
            <button onClick={closeWebsite} className="text-white/70 hover:text-white p-1">
              <ArrowLeft size={20} />
            </button>
            <p className="text-white/50 text-xs truncate flex-1 font-mono">{viewingUrl}</p>
          </div>
          <iframe
            src={viewingUrl}
            title="In-app website"
            className="flex-1 w-full border-0 bg-white"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          />

          {/* Floating button to bring up the Carlos popup on top of the website */}
          <button
            onClick={openPopup}
            className="absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center z-10"
            style={{
              background: "linear-gradient(135deg, #3b82ff, #0037a8)",
              boxShadow: "0 4px 20px rgba(59,130,255,0.6)",
              animation: "boxPulse 2.2s ease-in-out infinite",
            }}
          >
            <Zap size={22} className="text-white" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed z-50"
          style={{
            left: popupPos.x ?? "50%",
            top: popupPos.y ?? "50%",
            transform: popupPos.x === null ? "translate(-50%, -50%)" : "none",
            pointerEvents: "none", // let touches outside the card pass through to the page underneath
          }}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          onTouchMove={(e) => onHeaderPointerMove(e)}
          onTouchEnd={handleDragEnd}
        >
          <div
            className="relative w-[300px] rounded-xl overflow-hidden"
            style={{
              background: "radial-gradient(circle at 50% 20%, #05121a, #02080a 75%)",
              border: "2px solid #3b82ff",
              boxShadow: "0 10px 40px rgba(0,0,0,0.7)",
              animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards, boxPulse 2.2s ease-in-out infinite",
              padding: "0 22px 24px",
              pointerEvents: "auto", // the card itself still receives touches
            }}
          >
            {/* Drag handle header */}
            <div
              onPointerDown={onHeaderPointerDown}
              onTouchStart={(e) => onHeaderPointerDown(e)}
              className="flex items-center justify-center py-2 cursor-move touch-none"
              style={{ marginLeft: -22, marginRight: -22, marginBottom: 6 }}
            >
              <div className="w-10 h-1 rounded-full bg-[#3b82ff]/40" />
            </div>

            {/* corner brackets */}
            {[
              { top: -1, left: -1, borderWidth: "3px 0 0 3px" },
              { top: -1, right: -1, borderWidth: "3px 3px 0 0" },
              { bottom: -1, left: -1, borderWidth: "0 0 3px 3px" },
              { bottom: -1, right: -1, borderWidth: "0 3px 3px 0" },
            ].map((pos, i) => (
              <div
                key={i}
                className="absolute w-5 h-5 border-[#3b82ff]"
                style={{ ...pos, borderStyle: "solid", borderWidth: pos.borderWidth, animation: "cornerPulse 2s ease-in-out infinite" }}
              />
            ))}

            {/* scanline */}
            <div
              className="absolute left-0 right-0 h-16 pointer-events-none"
              style={{ background: "linear-gradient(rgba(59,130,255,0) 0%, rgba(59,130,255,0.08) 50%, rgba(59,130,255,0) 100%)", animation: "scan 3s linear infinite" }}
            />

            <button onClick={closePopup} className="absolute top-3 right-3 text-white/40 hover:text-white z-10">
              <X size={18} />
            </button>

            <div className="text-center relative">
              <div className="relative w-16 h-16 mx-auto mb-3" style={{ animation: "logoFloat 3s ease-in-out infinite" }}>
                {/* rotating dashed ring */}
                <div
                  className="absolute -inset-1.5 rounded-full"
                  style={{
                    border: "1px dashed rgba(59,130,255,0.6)",
                    animation: "logoSpin 6s linear infinite",
                  }}
                />
                <div
                  className="w-14 h-14 rounded-full overflow-hidden mx-auto relative"
                  style={{
                    border: "2px solid #3b82ff",
                    animation: "logoGlow 2s ease-in-out infinite, logoIn 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  <img
                    src={logoCircle}
                    alt="logo"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <h3
                className="text-2xl font-black tracking-[0.15em] mb-1 uppercase"
                style={{
                  background: "linear-gradient(90deg, #3b82ff, #ffd65d, #3b82ff)",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "shimmerText 3s linear infinite",
                  textShadow: "0 0 20px rgba(59,130,255,0.4)",
                }}
              >
                {appTitle}
              </h3>

              <p className="text-[#8ab4ff] text-[10px] tracking-[0.25em] uppercase mb-1">Small / Big Generator</p>
              <h2 className="text-white text-xl font-bold mb-4">
                <GlitchText>[ {rolling ? "ROLLING" : result ? result.toUpperCase() : "READY"} ]</GlitchText>
              </h2>

              <div className="relative mb-4">
                {result && <Sparkles burstKey={burstKey} />}
                <div
                  key={rolling ? "rolling" : `still-${result}`}
                  className="w-full h-20 rounded-md flex items-center justify-center text-lg font-bold select-none relative"
                  style={{
                    background: result === "small"
                      ? "linear-gradient(135deg, #5da9ff, #0a3a7a)"
                      : result === "big"
                      ? "linear-gradient(135deg, #ffb85c, #7a3d0a)"
                      : "linear-gradient(135deg, #5c9eff, #00307a)",
                    color: "#fff",
                    border: "1px solid rgba(59,130,255,0.4)",
                    animation: !rolling && result ? "resultPop 0.4s ease-out" : "none",
                  }}
                >
                  {rolling ? displayNum : result ? result.toUpperCase() : "?"}
                </div>
              </div>

              {/* history — last few results, newest first */}
              {history.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  {history.map((h, i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: h === "small" ? "#5da9ff" : "#ffb85c",
                        opacity: 1 - i * 0.1,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* real-time countdown timer — always live, continuous 60s cycle */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-[10px] text-[#8ab4ff] tracking-widest mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[#3b82ff]" style={{ animation: "livePulse 1.4s ease-in-out infinite" }} />
                    </span>
                    <Clock size={11} /> CYCLE
                  </span>
                  <span className="text-white font-bold text-sm tabular-nums">{mm}:{ss}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#3b82ff]/15 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPct}%`,
                      background: "linear-gradient(90deg, #3b82ff, #8ab4ff)",
                      transition: "width 0.2s linear",
                    }}
                  />
                </div>
              </div>

              {waitFlash ? (
                <div className="w-full flex items-center justify-center gap-2 text-[#8ab4ff] text-xs tracking-widest border border-[#3b82ff]/50 rounded-md py-2.5" style={{ animation: "flicker 0.5s infinite" }}>
                  <Clock size={13} />
                  WAIT FOR NEXT MINUTE
                </div>
              ) : (
                <button
                  onClick={generate}
                  disabled={rolling}
                  className="relative w-full overflow-hidden text-white font-bold text-xs tracking-widest py-2.5 rounded-md transition-transform active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(90deg, #3b82ff, #0037a8)" }}
                >
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                      width: "40%",
                      animation: "shine 2.6s ease-in-out infinite",
                    }}
                  />
                  <Zap size={13} />
                  {rolling ? "ROLLING..." : "START"}
                </button>
              )}

              <p className="text-white/25 text-[9px] tracking-widest mt-4 mb-2">
                {footerNote.toUpperCase()}
              </p>

              <a
                href="https://t.me/ISAMUUUUU"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center gap-1.5 text-white/40 text-[10px] border border-white/10 rounded-md py-1.5 hover:text-white/70 hover:border-white/20 transition-colors"
              >
                <MessageCircle size={10} /> Contact
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
