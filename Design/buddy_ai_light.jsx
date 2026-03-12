import { useState, useRef } from "react";

const C = {
  bg: "#F5F7FA", surface: "#FFFFFF", card: "#FFFFFF",
  cardBorder: "#E8ECF2", cardShadow: "0 2px 16px rgba(60,80,120,0.08)",
  accent: "#3B72F6", accentLight: "rgba(59,114,246,0.10)", accentSoft: "rgba(59,114,246,0.06)",
  teal: "#0BBFA3", tealLight: "rgba(11,191,163,0.10)",
  purple: "#7C3AED", purpleLight: "rgba(124,58,237,0.10)",
  orange: "#F97316", orangeLight: "rgba(249,115,22,0.10)",
  pink: "#EC4899", pinkLight: "rgba(236,72,153,0.10)",
  green: "#10B981", greenLight: "rgba(16,185,129,0.10)",
  text: "#111827", textMid: "#6B7280", textDim: "#9CA3AF",
  border: "#E8ECF2", danger: "#EF4444", dangerLight: "rgba(239,68,68,0.08)",
  headerBg: "#FFFFFF",
};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; font-family: 'Inter', sans-serif; }
  ::-webkit-scrollbar { width: 0; }
  input::placeholder { color: ${C.textDim}; }
  @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
  @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.85)} }
  @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes spin    { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes popIn   { 0%{transform:scale(.92);opacity:0} 100%{transform:scale(1);opacity:1} }
  @keyframes borderGlow { 0%,100%{opacity:0.22} 50%{opacity:0.12} }
  .glow-input { animation: borderGlow 2.5s ease-in-out infinite; }
  .screen  { animation: slideUp .3s ease forwards; }
  .tap     { transition: transform .12s ease, opacity .12s ease; cursor: pointer; }
  .tap:active { transform: scale(.95); opacity: .85; }
  .card    { transition: box-shadow .2s ease, transform .2s ease; }
  .card:hover { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(60,80,120,0.13) !important; }
`;

const Icon = ({ n, size = 20, color = C.textMid, fill }) => {
  const s = { stroke: color, strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  const f = fill || "none";
  const icons = {
    explore: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>,
    memory: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" /></svg>,
    settings: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    mic: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
    send: <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    bell: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
    location: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><polyline points="20 6 9 17 4 12" /></svg>,
    chevron: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><polyline points="9 18 15 12 9 6" /></svg>,
    back: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><polyline points="15 18 9 12 15 6" /></svg>,
    clock: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    shield: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    key: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>,
    chat: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    alert: <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    star: <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
    buddy: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><circle cx="12" cy="8" r="5" /><path d="M9 11h.01M15 11h.01" /><path d="M9.5 14.5a3.5 3.5 0 0 0 5 0" /><path d="M5 20c0-3 3-5 7-5s7 2 7 5" /></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>,
    filter: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
    arrowLeft: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
    activity: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    messageCircle: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
    userMinus: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill={f} {...s}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  };
  return <span style={{ display: "inline-flex", alignItems: "center" }}>{icons[n] || null}</span>;
};

const Avatar = ({ name = "B", color = C.accent, size = 38 }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2.4, background: `linear-gradient(135deg, ${color}, ${color}CC)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: "#fff", fontFamily: "'Nunito',sans-serif", flexShrink: 0, boxShadow: `0 3px 10px ${color}40` }}>{name[0]}</div>
);

const Chip = ({ children, color = C.accent, small }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: small ? "2px 8px" : "4px 11px", borderRadius: 20, background: `${color}14`, border: `1px solid ${color}30`, fontSize: small ? 10 : 11, fontWeight: 700, color, letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</span>
);

const Card = ({ children, style: s, onClick }) => (
  <div onClick={onClick} className="card tap" style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, overflow: "hidden", ...s }}>{children}</div>
);

const SecLabel = ({ children, onClick }) => (
  <p onClick={onClick} className={onClick ? "tap" : ""} style={{ fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10, marginTop: 4, cursor: onClick ? "pointer" : "default" }}>{children}</p>
);

const Divider = () => <div style={{ height: 1, background: C.border }} />;

// ── Top Header Navigation ──────────────────────────────────────────────────
const TopNav = ({ tab, setTab }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 300, background: `linear-gradient(135deg, ${C.accent} 0%, ${C.purple} 100%)` }}>
    {/* Nav row */}
    <div style={{ height: 60, display: "flex", alignItems: "center", padding: "0 18px 8px", gap: 0 }}>
      {/* Left-aligned tabs */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 20 }}>
        {[{ id: "buddy", label: "Buddy", icon: "buddy" }, { id: "explore", label: "Explore", icon: "explore" }].map(t => {
          const active = t.id === "explore" ? ["explore", "memory", "reminder", "family"].includes(tab) : tab === t.id;
          return (
            <div key={t.id} className="tap" onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: active ? 8 : 0,
              transition: "all .25s",
            }}>
              <Icon n={t.icon} size={active ? 24 : 18} color={active ? "#fff" : "rgba(255,255,255,0.45)"} />
              {active && (
                <span style={{ fontSize: 17, fontWeight: 900, color: "#fff", fontFamily: "'Nunito',sans-serif", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{t.label}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Settings button */}
      <div className="tap" onClick={() => setTab("settings")} style={{
        width: 40, height: 40, borderRadius: 13, flex: "0 0 auto",
        background: tab === "settings" ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .2s", backdropFilter: "blur(8px)",
        boxShadow: tab === "settings" ? "0 2px 12px rgba(0,0,0,0.18)" : "none",
      }}>
        <Icon n="settings" size={17} color={tab === "settings" ? C.accent : "rgba(255,255,255,0.9)"} />
      </div>
    </div>
  </div>
);

// ── Reminder Screen ────────────────────────────────────────────────────────
const FeatureRow = ({ icon, label, sub, on, toggle, last }) => (
  <>
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: `${C.accent}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon n={icon} size={18} color={C.accent} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{label}</p>
        <p style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{sub}</p>
      </div>
      <div onClick={toggle} className="tap" style={{ width: 44, height: 24, borderRadius: 12, background: on ? C.accent : "#D1D5DB", position: "relative", cursor: "pointer", transition: "all .2s" }}>
        <div style={{ position: "absolute", top: 2.5, left: on ? 22.5 : 2.5, width: 19, height: 19, borderRadius: 10, background: "#fff", transition: "all .25s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
      </div>
    </div>
    {!last && <Divider />}
  </>
);

const SmartDetailScreen = ({ reminder, onBack }) => {
  const [isEdit, setIsEdit] = useState(false);
  const [buffer, setBuffer] = useState(15);
  const [features, setFeatures] = useState({ early: true, guards: true, sync: false });

  // Mock traffic time
  const trafficTime = 14;
  const adjustedTime = "06:14 PM"; // Static example

  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, zIndex: 400, display: "flex", flexDirection: "column", animation: "slideUp .3s ease" }}>
      {/* Header */}
      <div style={{ paddingTop: 54, background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="tap" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon n="arrowLeft" size={20} color={C.text} />
            </div>
            <div>
              <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 18, color: C.text }}>{isEdit ? "Edit Settings" : "Smart Details"}</p>
              <Chip color={C.green} small>On Track</Chip>
            </div>
          </div>
          <div className="tap" onClick={() => setIsEdit(!isEdit)} style={{ padding: "8px 14px", borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.accent, backdropFilter: "blur(8px)" }}>
            {isEdit ? "Cancel" : "Edit Settings"}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 40px" }}>
        {/* Task Summary */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'Outfit', 'Nunito', sans-serif", fontSize: 32, fontWeight: 900, color: C.text, lineHeight: 1.1, marginBottom: 16 }}>{reminder.title}</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${C.purple}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon n="location" size={17} color={C.purple} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Destination Address</p>
                  <div style={{ padding: "2px 6px", borderRadius: 4, background: `${C.green}14`, border: `1px solid ${C.green}30`, display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.green }}>GPS ACTIVE</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>Apollo Hospital, Bandra West, Mumbai</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${C.purple}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon n="clock" size={17} color={C.purple} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Time: {reminder.time} • {reminder.date}</p>
                <p style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>Early Warning System Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Time & Buffer Configuration */}
        <SecLabel>Time & Buffer Configuration</SecLabel>
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Safety Buffer Time</p>
            <Chip color={C.purple} small>{buffer} min</Chip>
          </div>
          <input type="range" min="5" max="120" value={buffer} onChange={e => setBuffer(e.target.value)} style={{ width: "100%", accentColor: C.purple, cursor: "pointer", marginBottom: 12 }} />
          <p style={{ fontSize: 11.5, color: C.textMid, lineHeight: 1.5 }}>This time is added <i style={{ fontWeight: 600 }}>before</i> travel time to prevent lateness.</p>
        </Card>

        {/* Adjusted Preview */}
        <div style={{ background: `linear-gradient(135deg, ${C.purple}18, ${C.purple}08)`, border: `1.5px solid ${C.purple}25`, borderRadius: 20, padding: 20, marginBottom: 24, display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse 2s infinite" }}>
            <Icon n="bell" size={26} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 12, color: C.purple, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>Adjusted Notification</p>
            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 28, fontWeight: 900, color: C.text }}>{adjustedTime}</h2>
            <p style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>Calculated: Time - (Traffic + Buffer)</p>
          </div>
        </div>

        {/* Map Placeholder */}
        <SecLabel>Navigation & Intelligence</SecLabel>
        <div style={{ height: 180, borderRadius: 20, border: `1px solid ${C.border}`, overflow: "hidden", position: "relative", marginBottom: 12 }}>
          <div style={{ width: "100%", height: "100%", background: "#E5E7EB", backgroundImage: "radial-gradient(#CBD5E1 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <path d="M50 140 Q 150 100 220 150 T 340 40" stroke={C.accent} strokeWidth="4" fill="none" strokeDasharray="8 4" />
          </svg>
          <div style={{ position: "absolute", left: 40, top: 130, width: 24, height: 24, borderRadius: 12, background: "#fff", border: `3px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: C.accent }} />
          </div>
          <div style={{ position: "absolute", left: 330, top: 30, animation: "float 3s infinite" }}>
            <Icon n="location" size={30} color={C.danger} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase" }}>Distance</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: C.text, marginTop: 2 }}>8.4 km</p>
          </div>
          <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase" }}>Current ETA</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: C.text, marginTop: 2 }}>14 mins</p>
          </div>
        </div>

        {/* Toggles */}
        <SecLabel>Guardians & Proactive Features</SecLabel>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <FeatureRow icon="activity" label="Early Warning" sub="AI traffic monitoring" on={features.early} toggle={() => setFeatures(f => ({ ...f, early: !f.early }))} />
          <FeatureRow icon="shield" label="Item Exit Guards" sub="Don't forget your keys, etc." on={features.guards} toggle={() => setFeatures(f => ({ ...f, guards: !f.guards }))} />
          <FeatureRow icon="users" label="Family Hub Sync" sub="Share progress with family" on={features.sync} toggle={() => setFeatures(f => ({ ...f, sync: !f.sync }))} last />
        </Card>
      </div>
    </div>
  );
};

const ReminderScreen = ({ navigate }) => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [reminders, setReminders] = useState([
    { id: 1, title: "Team standup", time: "9:30 AM", date: "Today", tag: "Work", color: C.accent, done: false, icon: "calendar", repeat: "Daily" },
    { id: 2, title: "Buy groceries", time: "12:00 PM", date: "Today", tag: "Personal", color: C.teal, done: true, icon: "cart", repeat: "None", dest: "Fresh Mart, Downtown", eta: "8 mins" },
    { id: 3, title: "Call Mom", time: "6:00 PM", date: "Today", tag: "Family", color: C.pink, done: false, icon: "phone", repeat: "Weekly" },
    { id: 4, title: "Evening run", time: "7:30 PM", date: "Today", tag: "Health", color: C.orange, done: false, icon: "run", repeat: "Daily" },
    { id: 5, title: "Pay electricity bill", time: "10:00 AM", date: "Tomorrow", tag: "Personal", color: C.purple, done: false, icon: "zap", repeat: "Monthly" },
    { id: 6, title: "Doctor appointment", time: "11:30 AM", date: "Tomorrow", tag: "Health", color: C.teal, done: false, icon: "medkit", repeat: "None", dest: "Apollo Hospital", eta: "14 mins" },
    { id: 7, title: "Project deadline", time: "5:00 PM", date: "Mar 13", tag: "Work", color: C.accent, done: false, icon: "briefcase", repeat: "None" },
    { id: 8, title: "Anniversary dinner", time: "8:00 PM", date: "Mar 14", tag: "Family", color: C.pink, done: false, icon: "heart", repeat: "Yearly", dest: "The Taj, Colaba", eta: "25 mins" },
    { id: 9, title: "Gym session", time: "7:00 AM", date: "Mar 14", tag: "Health", color: C.orange, done: false, icon: "run", repeat: "Daily" },
    { id: 10, title: "Car service", time: "9:00 AM", date: "Mar 15", tag: "Personal", color: C.orange, done: false, icon: "car", repeat: "None", dest: "Shroff Honda, Andheri" },
  ]);

  const filters = ["All", "Today", "Work", "Health", "Family", "Personal"];
  const toggle = (id) => setReminders(r => r.map(x => x.id === id ? { ...x, done: !x.done } : x));

  const filtered = activeFilter === "All" ? reminders
    : activeFilter === "Today" ? reminders.filter(r => r.date === "Today")
      : reminders.filter(r => r.tag === activeFilter);

  const RIcon = ({ name, color, size = 18 }) => {
    const s2 = { stroke: color, strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
    const icons2 = {
      calendar: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
      cart: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>,
      phone: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.19h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6.05 6.05l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
      run: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><circle cx="12" cy="4" r="2" /><path d="M14.5 8.5L17 6" /><path d="M9 9l-2 5h5l2 5" /><path d="M7 14l-2 2" /></svg>,
      zap: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
      medkit: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><path d="M22 9H2a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1z" /><path d="M16 9V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4" /><line x1="12" y1="13" x2="12" y2="17" /><line x1="10" y1="15" x2="14" y2="15" /></svg>,
      briefcase: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="12" x2="12" y2="12" /><path d="M2 12h20" /></svg>,
      heart: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
      car: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 4v4a2 2 0 0 1-2 2h-2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></svg>,
    };
    return <span style={{ display: "inline-flex" }}>{icons2[name] || null}</span>;
  };

  return (
    <div style={{ position: "relative", height: "100%" }}>
      {selectedReminder && <SmartDetailScreen reminder={selectedReminder} onBack={() => setSelectedReminder(null)} />}
      <div className="screen" style={{ paddingTop: 70, height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Search + filters header */}
        <div style={{ padding: "12px 18px 10px", background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, background: C.bg, border: `1.5px solid ${C.border}` }}>
            <Icon n="search" size={16} color={C.textDim} />
            <input placeholder="Search reminders…" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 13.5 }} />
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 10, overflowX: "auto" }}>
            {filters.map(f => (
              <div key={f} onClick={() => setActiveFilter(f)} className="tap" style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, background: activeFilter === f ? C.accent : C.bg, border: `1.5px solid ${activeFilter === f ? C.accent : C.border}`, fontSize: 12, fontWeight: 700, color: activeFilter === f ? "#fff" : C.textMid, transition: "all .18s", fontFamily: "'Nunito',sans-serif" }}>{f}</div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { title: "Today", data: filtered.filter(r => r.date === "Today") },
            { title: "Tomorrow", data: filtered.filter(r => r.date === "Tomorrow") },
            { title: "Upcoming", data: filtered.filter(r => r.date !== "Today" && r.date !== "Tomorrow") },
          ].filter(s => s.data.length > 0).map(section => (
            <div key={section.title} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: section.title === "Today" ? 0 : 12 }}>
              <SecLabel>{section.title}</SecLabel>
              {section.data.map((r, i) => (
                <div key={i} onClick={() => setSelectedReminder(r)} className="tap card" style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, borderLeft: `4px solid ${r.done ? C.textDim : r.color}`, boxShadow: C.cardShadow, padding: "14px 16px 14px 14px", opacity: r.done ? 0.6 : 1 }}>
                  <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: r.done ? `${C.textDim}15` : `linear-gradient(135deg, ${r.color}18, ${r.color}08)`, border: `1.5px solid ${r.done ? C.textDim + "25" : r.color + "25"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {r.done
                        ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        : <RIcon name={r.icon} color={r.color} size={22} />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14.5, color: r.done ? C.textMid : C.text, textDecoration: r.done ? "line-through" : "none" }}>{r.title}</p>
                        <Icon n="chevron" size={13} color={r.done ? C.textDim : r.color} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <Icon n="clock" size={12} color={C.textDim} />
                        <p style={{ fontSize: 12, color: C.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.time} · {r.date}{r.repeat !== "None" ? ` · ${r.repeat}` : ""}</p>
                      </div>
                      {r.dest && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <Icon n="location" size={12} color={C.accent} />
                          <p style={{ fontSize: 11.5, color: C.textMid, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.dest}</p>
                          {r.eta && (
                            <div style={{ padding: "1px 6px", borderRadius: 4, background: `${C.accent}12`, border: `1px solid ${C.accent}20` }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: C.accent }}>ETA {r.eta}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ marginTop: 9, display: "flex", gap: 6 }}>
                        <Chip color={r.done ? C.textDim : r.color} small>{r.tag}</Chip>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon n="bell" size={28} color={C.accent} />
              </div>
              <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 16, color: C.text }}>No reminders here</p>
              <p style={{ fontSize: 13, color: C.textMid, textAlign: "center" }}>Tap + to add a new reminder</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ── Explore Screen ─────────────────────────────────────────────────────────
const ExploreScreen = ({ navigate }) => {
  const memories = ["Paris 2023", "Mom's Birthday", "Meeting Notes", "Recipe Ideas", "Flight PNR", "Dr. Mehta", "Office WiFi", "Car Service", "Gym Routine", "Book List", "Anniversary", "Home Insurance"];
  const reminders = [
    { title: "Team standup", time: "9:30 AM", tag: "Work", color: C.accent, done: false, icon: "calendar" },
    { title: "Buy groceries", time: "12:00 PM", tag: "Personal", color: C.teal, done: true, icon: "cart", dest: "Fresh Mart", eta: "8m" },
    { title: "Call Mom", time: "6:00 PM", tag: "Family", color: C.pink, done: false, icon: "phone" },
    { title: "Evening run", time: "7:30 PM", tag: "Health", color: C.orange, done: false, icon: "run", dest: "City Park", eta: "5m" },
  ];
  const RIcon = ({ name, color, size = 18 }) => {
    const s2 = { stroke: color, strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
    const p = {
      calendar: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
      cart: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>,
      phone: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.19h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6.05 6.05l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
      run: <svg width={size} height={size} viewBox="0 0 24 24" {...s2}><circle cx="12" cy="4" r="2" /><path d="M14.5 8.5L17 6" /><path d="M9 9l-2 5h5l2 5" /><path d="M7 14l-2 2" /></svg>,
    };
    return <span style={{ display: "inline-flex" }}>{p[name] || null}</span>;
  };
  return (
    <div className="screen" style={{ paddingTop: 76, paddingBottom: 24, paddingLeft: 18, paddingRight: 18, overflowY: "auto", height: "100%" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.accent} 0%, ${C.purple} 100%)`, borderRadius: 22, padding: "20px 22px", marginBottom: 22, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", bottom: -30, right: 30, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>Good Morning</p>
        <h2 style={{ fontFamily: "'Nunito',sans-serif", fontSize: 24, fontWeight: 900, color: "#fff", marginTop: 2, lineHeight: 1.1 }}>Alex Johnson</h2>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 12px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Mumbai · 29°C, Partly cloudy</span>
        </div>
      </div>

      <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 12 }}>Quick Actions</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {[
          { icon: "memory", label: "Memory", sub: "Store anything", color: C.accent, to: "memory" },
          { icon: "bell", label: "Reminder", sub: "Set a task", color: C.teal, to: "reminder" },
          { icon: "location", label: "Location Reminder", sub: "Geo-trigger", color: C.orange, to: "reminder" },
          { icon: "users", label: "Family", sub: "3 members online", color: C.pink, to: "family" },
        ].map((a, i) => (
          <Card key={i} onClick={() => navigate(a.to)} style={{ padding: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: `${a.color}14`, border: `1px solid ${a.color}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Icon n={a.icon} size={19} color={a.color} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'Nunito',sans-serif" }}>{a.label}</p>
            <p style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{a.sub}</p>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 15, color: C.text }}>Memory Cloud</p>
        <span onClick={() => navigate("memory")} style={{ fontSize: 11, color: C.accent, fontWeight: 700, cursor: "pointer" }}>View all →</span>
      </div>
      <div style={{ overflow: "hidden", marginBottom: 22 }}>
        <div style={{ display: "flex", animation: "marquee 20s linear infinite", width: "max-content", gap: 8 }}>
          {[...memories, ...memories].map((m, i) => (
            <div key={i} onClick={() => navigate("memory")} className="tap" style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 1px 6px rgba(0,0,0,.06)", fontSize: 12, fontWeight: 600, color: C.textMid, whiteSpace: "nowrap", cursor: "pointer" }}>{m}</div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 15, color: C.text }}>Today's Reminders</p>
        <span onClick={() => navigate("reminder")} style={{ fontSize: 11, color: C.accent, fontWeight: 700, cursor: "pointer" }}>All tasks →</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
        {reminders.map((r, i) => (
          <Card key={i} onClick={() => navigate("reminder")} style={{ padding: "13px 15px", opacity: r.done ? 0.55 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: `${r.color}12`, border: `1px solid ${r.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <RIcon name={r.icon} color={r.color} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: r.done ? C.textMid : C.text, textDecoration: r.done ? "line-through" : "none", fontFamily: "'Nunito',sans-serif" }}>{r.title}</p>
                <p style={{ fontSize: 11, color: C.textDim, marginTop: 1 }}>{r.time}</p>
                {r.dest && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Icon n="location" size={10} color={r.color} />
                    <span style={{ fontSize: 10.5, color: C.textDim, fontWeight: 500 }}>{r.dest}</span>
                    {r.eta && <span style={{ fontSize: 10, color: r.color, fontWeight: 700, marginLeft: 2 }}>· {r.eta}</span>}
                  </div>
                )}
              </div>
              <Chip color={r.color}>{r.tag}</Chip>
            </div>
          </Card>
        ))}
      </div>


    </div>
  );
};

// ── Buddy Chat Screen ──────────────────────────────────────────────────────
const BuddyScreen = ({ navigate }) => {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState([
    { role: "ai", text: "Hey Alex! I'm Buddy, your personal AI assistant. You have 3 reminders today and 2 unread family messages. How can I help?", time: "9:02 AM" },
    { role: "user", text: "What's on my schedule today?", time: "9:04 AM" },
    { role: "ai", text: "You've got a team standup at 9:30 AM, groceries at noon, a call with Mom at 6 PM, and your evening run at 7:30 PM. Want me to set travel alerts for any of these?", time: "9:04 AM" },
  ]);
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef();

  const send = () => {
    if (!input.trim()) return;
    setMsgs(m => [...m, { role: "user", text: input, time: "now" }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs(m => [...m, { role: "ai", text: "Got it! I've noted that down. Anything else I can help you with today?", time: "now" }]);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 1700);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const suggestions = ["Today's schedule", "Set reminder", "Call Mom", "Local news"];

  return (
    <div className="screen" style={{ paddingTop: 52, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 10px", display: "flex", flexDirection: "column", gap: 16, background: "#F5F7FB" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, animation: "popIn .25s ease" }}>
            {m.role === "ai" && (
              <div style={{ width: 32, height: 32, borderRadius: 11, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 3px 10px ${C.accent}30`, marginBottom: 2 }}>
                <Icon n="buddy" size={16} color="#fff" />
              </div>
            )}
            <div style={{ maxWidth: "72%", padding: "12px 15px", borderRadius: m.role === "user" ? "20px 20px 5px 20px" : "5px 20px 20px 20px", background: m.role === "user" ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.surface, border: m.role === "ai" ? `1px solid ${C.border}` : "none", boxShadow: m.role === "user" ? `0 4px 18px ${C.accent}30` : "0 2px 12px rgba(60,80,130,0.07)" }}>
              <p style={{ fontSize: 13.5, color: m.role === "user" ? "#fff" : C.text, lineHeight: 1.6 }}>{m.text}</p>
              <p style={{ fontSize: 10, color: m.role === "user" ? "rgba(255,255,255,.5)" : C.textDim, marginTop: 5, textAlign: m.role === "user" ? "right" : "left" }}>{m.time}</p>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 11, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon n="buddy" size={16} color="#fff" />
            </div>
            <div style={{ padding: "12px 16px", borderRadius: "5px 20px 20px 20px", background: C.surface, border: `1px solid ${C.border}`, display: "flex", gap: 5, alignItems: "center" }}>
              {[0, 1, 2].map(j => <div key={j} style={{ width: 7, height: 7, borderRadius: 4, background: C.accent, animation: `pulse 1.1s ease ${j * .2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ background: C.surface, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ padding: "8px 16px 0", display: "flex", gap: 7, overflowX: "auto" }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => setInput(s)} className="tap" style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 10, background: "#F0F4FF", border: `1px solid #DDE6FF`, fontSize: 12, fontWeight: 600, color: C.accent, cursor: "pointer" }}>{s}</div>
          ))}
        </div>
        <div style={{ padding: "8px 18px 14px" }}>
          {/* Glowing pill input — full width */}
          <div style={{ position: "relative" }}>
            {/* Animated glow ring */}
            <div className="glow-input" style={{
              position: "absolute", inset: -2.5, borderRadius: 50,
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple}, ${C.pink})`,
              zIndex: 0, filter: "blur(6px)", opacity: 0.22,
            }} />
            {/* Inner pill */}
            <div style={{
              position: "relative", zIndex: 1,
              display: "flex", alignItems: "center",
              padding: input ? "4px 4px 4px 16px" : "10px 16px",
              borderRadius: 50, background: C.surface,
              border: "1.5px solid transparent",
              backgroundClip: "padding-box",
              transition: "padding .2s",
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Feel free to ask me any question..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 13, fontFamily: "'Inter',sans-serif" }}
              />
              {/* Mic */}
              <div className="tap" onClick={() => setListening(l => !l)} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", flexShrink: 0 }}>
                <Icon n="mic" size={17} color={listening ? C.danger : C.textDim} />
              </div>
              {/* Plus — always visible */}
              <div className="tap" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", flexShrink: 0 }}>
                <Icon n="plus" size={17} color={C.textDim} />
              </div>
              {/* Send — appears when typing */}
              {input && (
                <div className="tap" onClick={send} style={{
                  width: 40, height: 40, borderRadius: 50, flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 3px 12px ${C.accent}55`,
                  transition: "all .2s",
                }}>
                  <Icon n="send" size={15} color="#fff" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Memory Screens ─────────────────────────────────────────────────────────
const MemIcon = ({ name, color, size = 22 }) => {
  const s = { stroke: color, strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  const icons = {
    plane: <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2 3.4 6.6l7.1 3.7-2.3 2.3-2.8-.9-1.6 1.6 2.4 1.2 1.2 2.4 1.6-1.6-.9-2.8 2.3-2.3 3.7 7.1 1.4-1.4z" /></svg>,
    medkit: <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M22 9H2a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1z" /><path d="M16 9V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4" /><line x1="12" y1="13" x2="12" y2="17" /><line x1="10" y1="15" x2="14" y2="15" /></svg>,
    car: <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l4 4v4a2 2 0 0 1-2 2h-2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></svg>,
    gift: <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>,
    wifi: <svg width={size} height={size} viewBox="0 0 24 24" {...s}><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>,
    activity: <svg width={size} height={size} viewBox="0 0 24 24" {...s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  };
  return <span style={{ display: "inline-flex" }}>{icons[name] || null}</span>;
};

const MemoryDetailScreen = ({ mem, onBack, navigate }) => {
  const details = {
    "Paris Trip 2023": { fields: [["Hotel", "Le Marais, Paris 3rd"], ["Flight", "Air France AF217"], ["Budget", "€2,400"], ["Dates", "Jun 12–19, 2023"], ["Passport", "Expires Nov 2027"], ["Travel Insurance", "AXA Policy #TX8821"]], notes: "Loved the Louvre! Book Musée d'Orsay earlier next time." },
    "Doctor — Dr. Mehta": { fields: [["Hospital", "Apollo Hospitals, Bandra"], ["Phone", "+91 98765 43210"], ["Specialty", "General Physician"], ["Next Visit", "March 22, 2026"], ["Last Prescribed", "Cetirizine 10mg"], ["Blood Group", "O+"]], notes: "Mention knee pain during next visit. Bring previous reports." },
    "Car Service Record": { fields: [["Vehicle", "Honda City 2019 ZX"], ["Reg No", "MH02 AB 1234"], ["Last Service", "Dec 14, 2023"], ["Km at Service", "42,300 km"], ["Next Service", "Jun 2024 / 48,000 km"], ["Service Centre", "Shroff Honda, Andheri"]], notes: "Oil change done. Check AC cooling next visit." },
    "Mom's Birthday": { fields: [["Date", "June 14"], ["Gift Ideas", "Blue Banarasi saree, gold earrings"], ["Favourite Food", "Puran Poli, Shrikhand"], ["Cake", "Mango mousse from Theobroma"], ["Restaurant", "Rajdhani for dinner"], ["Budget", "₹8,000"]], notes: "She loved the surprise last year — do it again!" },
    "Office WiFi Creds": { fields: [["SSID", "OfficePro_5G"], ["Password", "••••••••••"], ["Router IP", "192.168.1.1"], ["Admin Login", "admin / ••••••"], ["Bandwidth", "300 Mbps Fiber"], ["Provider", "Jio Business"]], notes: "Reset password every 90 days. IT contact: Ravi ext. 204." },
    "Gym Routine": { fields: [["Schedule", "Mon / Wed / Fri"], ["Time", "7:30 AM – 9:00 AM"], ["Split", "Push · Pull · Legs"], ["Trainer", "Ankit Sharma"], ["Membership", "₹2,500/month · Renews Apr 1"], ["Goal", "Lose 5 kg by June"]], notes: "Increase bench press by 5 kg this month." },
  };
  const d = details[mem.title] || { fields: [], notes: "" };
  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, zIndex: 400, display: "flex", flexDirection: "column", animation: "slideUp .28s ease" }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, paddingTop: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px 14px" }}>
          <div className="tap" onClick={onBack} style={{ width: 36, height: 36, borderRadius: 11, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon n="back" size={18} color={C.text} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 17, color: C.text }}>{mem.title}</p>
            <p style={{ fontSize: 11, color: C.textMid, marginTop: 1 }}>Memory Details</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 30px" }}>
        <div style={{ background: `linear-gradient(135deg, ${mem.color}18, ${mem.color}06)`, border: `1.5px solid ${mem.color}25`, borderRadius: 20, padding: "22px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${mem.color}25, ${mem.color}10)`, border: `2px solid ${mem.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MemIcon name={mem.icon} color={mem.color} size={30} />
          </div>
          <div>
            <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 900, fontSize: 18, color: C.text }}>{mem.title}</p>
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>{mem.tags.map((t, i) => <Chip key={i} color={mem.color} small>{t}</Chip>)}</div>
            <p style={{ fontSize: 11, color: C.textMid, marginTop: 6 }}>Last updated · 2 days ago</p>
          </div>
        </div>
        <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 13, color: C.textDim, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 10 }}>Details</p>
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 16 }}>
          {d.fields.map(([label, val], i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", gap: 12 }}>
                <p style={{ fontSize: 12.5, color: C.textMid, fontWeight: 500, flexShrink: 0 }}>{label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: "right", fontFamily: "'Nunito',sans-serif" }}>{val}</p>
              </div>
              {i < d.fields.length - 1 && <Divider />}
            </div>
          ))}
        </div>
        {d.notes && (
          <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
            <p style={{ fontSize: 13, color: C.textMid, lineHeight: 1.65 }}>{d.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const MemoryScreen = ({ navigate }) => {
  const [filter, setFilter] = useState("All");
  const [selectedMem, setSelectedMem] = useState(null);
  const mems = [
    { title: "Paris Trip 2023", preview: "Hotel: Le Marais · Flight AF217 · €2400", tags: ["Travel"], color: C.accent, icon: "plane" },
    { title: "Doctor — Dr. Mehta", preview: "Apollo Hospital · +91 98XXX · Mar 22 next", tags: ["Health"], color: C.teal, icon: "medkit" },
    { title: "Car Service Record", preview: "Honda City · Dec 2023 · Oil change due", tags: ["Vehicle"], color: C.orange, icon: "car" },
    { title: "Mom's Birthday", preview: "June 14 · Gift idea: Blue saree, earrings", tags: ["Family"], color: C.pink, icon: "gift" },
    { title: "Office WiFi Creds", preview: "SSID: OfficePro · Pass: ••••••••", tags: ["Work"], color: C.purple, icon: "wifi" },
    { title: "Gym Routine", preview: "Mon/Wed/Fri · 7:30 AM · Push-Pull-Legs", tags: ["Health"], color: C.teal, icon: "activity" },
  ];
  const filters = ["All", "Travel", "Health", "Work", "Family", "Vehicle"];
  return (
    <div style={{ position: "relative", height: "100%" }}>
      {selectedMem && <MemoryDetailScreen mem={selectedMem} onBack={() => setSelectedMem(null)} navigate={navigate} />}
      <div className="screen" style={{ paddingTop: 52, height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 18px 10px", background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, background: C.bg, border: `1.5px solid ${C.border}` }}>
            <Icon n="search" size={16} color={C.textDim} />
            <input placeholder="Search memories…" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 13.5 }} />
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 10, overflowX: "auto" }}>
            {filters.map(f => (
              <div key={f} onClick={() => setFilter(f)} className="tap" style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, background: filter === f ? C.accent : C.bg, border: `1.5px solid ${filter === f ? C.accent : C.border}`, fontSize: 12, fontWeight: 700, color: filter === f ? "#fff" : C.textMid, transition: "all .18s", fontFamily: "'Nunito',sans-serif" }}>{f}</div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {mems.map((m, i) => (
            <div key={i} onClick={() => setSelectedMem(m)} className="tap card" style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, borderLeft: `4px solid ${m.color}`, boxShadow: C.cardShadow, padding: "14px 16px 14px 14px" }}>
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: `linear-gradient(135deg, ${m.color}18, ${m.color}08)`, border: `1.5px solid ${m.color}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MemIcon name={m.icon} color={m.color} size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14.5, color: C.text }}>{m.title}</p>
                    <Icon n="chevron" size={13} color={m.color} />
                  </div>
                  <p style={{ fontSize: 12, color: C.textMid, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.preview}</p>
                  <div style={{ marginTop: 9, display: "flex", gap: 6 }}>{m.tags.map((t, j) => <Chip key={j} color={m.color} small>{t}</Chip>)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Settings Screen ────────────────────────────────────────────────────────
const SettingsScreen = ({ navigate }) => {
  const [toggles, setToggles] = useState({ voice: true, push: true, email: false, inapp: true, gcal: true, bio: true });
  const [modal, setModal] = useState(null);
  const tog = k => setToggles(p => ({ ...p, [k]: !p[k] }));
  const Toggle = ({ k }) => (
    <div onClick={() => tog(k)} className="tap" style={{ width: 44, height: 25, borderRadius: 13, background: toggles[k] ? C.accent : "#D1D5DB", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2.5, left: toggles[k] ? 22 : 2.5, width: 20, height: 20, borderRadius: 10, background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
    </div>
  );
  const Row = ({ icon, iconColor, label, sub, right, last, onClick }) => (
    <div onClick={onClick} className={onClick ? "tap" : ""} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 16px" }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: `${iconColor}14`, border: `1px solid ${iconColor}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon n={icon} size={17} color={iconColor} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: C.text, fontFamily: "'Nunito',sans-serif" }}>{label}</p>
          {sub && <p style={{ fontSize: 11, color: C.textMid, marginTop: 1 }}>{sub}</p>}
        </div>
        {right}
      </div>
      {!last && <Divider />}
    </div>
  );
  return (
    <div className="screen" style={{ paddingTop: 52, paddingBottom: 24, overflowY: "auto", height: "100%" }}>
      <div style={{ padding: "16px 18px 0" }}>
        <Card style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative" }}>
              <Avatar name="AJ" size={60} />
              <div className="tap" style={{ position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon n="plus" size={12} color="#fff" />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "'Nunito',sans-serif", fontSize: 18, fontWeight: 900, color: C.text }}>Alex Johnson</p>
              <p style={{ fontSize: 12, color: C.textMid, marginTop: 1 }}>alex.johnson@email.com</p>
              <div style={{ marginTop: 6 }}><Chip color={C.teal}>Pro Plan ✨</Chip></div>
            </div>
          </div>
        </Card>
        <SecLabel>Notifications</SecLabel>
        <Card style={{ marginBottom: 18, overflow: "hidden", padding: 0 }}>
          <Row icon="mic" iconColor={C.accent} label="Voice Alerts" sub="Buddy speaks reminders" right={<Toggle k="voice" />} />
          <Row icon="bell" iconColor={C.orange} label="Push Notifications" sub="Lock screen alerts" right={<Toggle k="push" />} />
          <Row icon="chat" iconColor={C.teal} label="Email Digest" sub="Daily summary via email" right={<Toggle k="email" />} />
          <Row icon="star" iconColor={C.pink} label="In-App Alerts" sub="Banners & badges" right={<Toggle k="inapp" />} last />
        </Card>
        <SecLabel onClick={() => setModal({ title: "Integrations", icon: "explore", color: C.accent, desc: "Connect your favorite apps to sync data across all your devices seamlessly." })}>Integrations</SecLabel>
        <Card style={{ marginBottom: 18, overflow: "hidden", padding: 0 }}>
          <Row icon="calendar" iconColor={C.accent} label="Google Calendar" sub={toggles.gcal ? "Synced · 2 min ago" : "Not connected"} right={<Toggle k="gcal" />} last />
        </Card>
        <SecLabel onClick={() => setModal({ title: "Security Hub", icon: "shield", color: C.green, desc: "Manage your account security, passwords, and biometric settings here." })}>Security</SecLabel>
        <Card style={{ marginBottom: 18, overflow: "hidden", padding: 0 }}>
          <Row icon="shield" iconColor={C.green} label="Biometrics" sub="Face ID / Fingerprint" right={<Toggle k="bio" />} />
          <Row icon="key" iconColor={C.orange} label="Change Password" sub="Last changed 30 days ago" right={<Icon n="chevron" size={15} color={C.textDim} />} last
            onClick={() => setModal({ title: "Update Password", icon: "key", color: C.orange, desc: "We will send a secure link to your registered email to reset your account password." })}
          />
        </Card>
        <SecLabel onClick={() => setModal({ title: "Danger Zone", icon: "alert", color: C.danger, desc: "Be careful! The actions in this section are permanent and cannot be reversed." })}>Danger Zone</SecLabel>
        <Card onClick={() => setModal({ title: "Delete Account", icon: "trash", color: C.danger, desc: "Are you sure? This will permanently delete your account and all associated data." })} className="tap" style={{ padding: 0, border: `1px solid #FECACA`, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 16px" }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: C.dangerLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon n="alert" size={20} color={C.danger} />
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: C.danger, fontFamily: "'Nunito',sans-serif" }}>Delete Account</p>
              <p style={{ fontSize: 11, color: "#F87171" }}>Permanently remove all data</p>
            </div>
          </div>
        </Card>
      </div>

      {modal && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={() => setModal(null)} style={{ position: "absolute", inset: 0, background: "rgba(10,15,30,0.45)", backdropFilter: "blur(6px)", animation: "fadeIn .25s ease" }} />
          <div style={{
            position: "relative", width: "100%", background: C.surface, borderRadius: 28, padding: 24, border: `1px solid ${C.border}`,
            boxShadow: "0 22px 64px rgba(0,0,0,0.22)", animation: "popIn .35s cubic-bezier(0.175, 0.885, 0.32, 1.25)"
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: `${modal.color}15`, border: `1px solid ${modal.color}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <Icon n={modal.icon} size={24} color={modal.color} />
            </div>
            <h3 style={{ fontFamily: "'Outfit', 'Nunito', sans-serif", fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 8, lineHeight: 1.2 }}>{modal.title}</h3>
            <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.6, marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>{modal.desc}</p>
            <div onClick={() => setModal(null)} className="tap" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, borderRadius: 15, padding: "14px", textAlign: "center", color: "#fff", fontWeight: 800, fontSize: 14, fontFamily: "'Nunito', sans-serif", boxShadow: `0 8px 18px ${C.accent}40` }}>
              Understood
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Family Chat Screen ──────────────────────────────────────────────────────
const FamilyChatScreen = ({ chat, onBack }) => {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState([
    { role: "other", text: "Hey family, anyone free for a quick call later?", user: "Sarah", time: "10:30 AM", color: C.purple },
    { role: "me", text: "I should be free after 6 PM.", user: "You", time: "10:35 AM", color: C.accent },
    { role: "other", text: "Me too! Want to discuss the weekend plans?", user: "Timmy", time: "10:40 AM", color: C.orange },
  ]);
  const bottomRef = useRef();

  const send = () => {
    if (!input.trim()) return;
    setMsgs(m => [...m, { role: "me", text: input, user: "You", time: "now", color: C.accent }]);
    setInput("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, zIndex: 500, display: "flex", flexDirection: "column", animation: "slideUp .3s ease" }}>
      {/* Header */}
      <div style={{ paddingTop: 10, background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px 14px" }}>
          <div className="tap" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon n="arrowLeft" size={20} color={C.text} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: 18, color: C.text }}>{chat.name}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} />
              <p style={{ fontSize: 11, color: C.textMid, fontWeight: 600 }}>{chat.isGroup ? "3 members active" : "Online"}</p>
            </div>
          </div>
          <div className="tap" style={{ width: 38, height: 38, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon n="settings" size={18} color={C.textMid} />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 16, background: "#F5F7FB" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: m.role === "me" ? "row-reverse" : "row", alignItems: "flex-end", gap: 10 }}>
            {m.role === "other" && <Avatar name={m.user} size={32} color={m.color} />}
            <div style={{ maxWidth: "75%" }}>
              {m.role === "other" && chat.isGroup && <p style={{ fontSize: 10, fontWeight: 700, color: m.color, marginBottom: 4, marginLeft: 4 }}>{m.user}</p>}
              <div style={{
                padding: "12px 16px", borderRadius: m.role === "me" ? "20px 20px 4px 20px" : "4px 20px 20px 20px",
                background: m.role === "me" ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.surface,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)", border: m.role === "me" ? "none" : `1px solid ${C.border}`
              }}>
                <p style={{ fontSize: 14, color: m.role === "me" ? "#fff" : C.text, lineHeight: 1.5 }}>{m.text}</p>
              </div>
              <p style={{ fontSize: 10, color: C.textDim, marginTop: 4, textAlign: m.role === "me" ? "right" : "left" }}>{m.time}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 18px 34px", background: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.bg, borderRadius: 24, padding: "6px 6px 6px 16px", border: `1.5px solid ${C.border}` }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Write a message..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 14 }}
          />
          <div className="tap" onClick={send} style={{ width: 36, height: 36, borderRadius: 18, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon n="send" size={16} color="#fff" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Family Hub Screen ──────────────────────────────────────────────────────
const FamilyScreen = ({ navigate }) => {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [members] = useState([
    { name: "Alex Johnson (You)", role: "Parent", img: "AJ", isMe: true },
    { name: "Sarah Johnson", role: "Spouse", img: "SJ", isMe: false },
    { name: "Timmy Johnson", role: "Child", img: "TJ", isMe: false },
  ]);

  const handleInvite = () => {
    if (!email) return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setEmail("");
      alert("Invitation sent successfully!");
    }, 1500);
  };

  return (
    <div className="screen" style={{ position: "relative", height: "100%" }}>
      {activeChat && <FamilyChatScreen chat={activeChat} onBack={() => setActiveChat(null)} />}
      <div style={{ paddingTop: 62, paddingBottom: 40, height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Dynamic Gradient Header Overlay */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260, background: `linear-gradient(to bottom, ${C.primary}33, transparent)`, zIndex: -1 }} />

        <div style={{ padding: "0 18px" }}>
          {/* Dashboard Title */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 900, color: C.text }}>Family Hub</h1>
          </div>

          {/* Emergency Broadcast System */}
          <div style={{
            background: "rgba(255, 255, 255, 0.45)", backdropFilter: "blur(12px)", borderRadius: 24, border: "1px solid rgba(255, 71, 71, 0.2)",
            padding: 20, marginBottom: 28, boxShadow: "0 10px 30px rgba(255, 71, 71, 0.08)", position: "relative", overflow: "hidden"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
              <div style={{
                width: 50, height: 50, borderRadius: 16, background: C.danger, display: "flex", alignItems: "center", justifyContent: "center",
                animation: "pulse 1.5s infinite", boxShadow: `0 0 20px ${C.danger}50`
              }}>
                <Icon n="alert" size={26} color="#fff" />
              </div>
              <div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 800, color: C.text }}>Emergency Help</p>
                <p style={{ fontSize: 12, color: C.textMid, fontWeight: 500 }}>Alert everyone instantly</p>
              </div>
            </div>
            <div className="tap" onClick={() => window.confirm("Are you sure you want to broadcast an EMERGENCY ALERT to all family members?")} style={{
              background: C.danger, borderRadius: 16, padding: "14px", textAlign: "center", color: "#fff", fontWeight: 800, fontSize: 14,
              fontFamily: "'Outfit', sans-serif", letterSpacing: "0.02em", boxShadow: `0 6px 20px ${C.danger}40`
            }}>
              SEND EMERGENCY ALERT
            </div>
          </div>

          {/* Connectivity & Invites */}
          <SecLabel>Connectivity & Invites</SecLabel>
          <Card style={{ padding: 18, background: "rgba(255, 255, 255, 0.9)", border: `1px solid ${C.border}`, marginBottom: 20, borderRadius: 22 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: "'Outfit', sans-serif" }}>Invite New Member</p>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Gmail or Apple ID"
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 50, background: C.bg, border: `1px solid ${C.border}`,
                    fontSize: 13, outline: "none", fontFamily: "'Inter', sans-serif", color: C.text
                  }}
                />
              </div>
              <div className="tap" onClick={handleInvite} style={{
                width: 46, height: 46, borderRadius: 50, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 12px ${C.accent}30`, flexShrink: 0
              }}>
                {isSending ? (
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <Icon n="send" size={18} color="#fff" />
                )}
              </div>
            </div>
          </Card>

          {/* Pending Requests */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, borderRadius: 18, padding: "12px 16px", border: `1px solid ${C.border}` }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Pending: David Smith</p>
                <p style={{ fontSize: 11, color: C.textMid }}>david.s@email.com</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div className="tap" style={{ width: 34, height: 34, borderRadius: 10, background: `${C.green}14`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.green}20` }}>
                  <Icon n="check" size={16} color={C.green} />
                </div>
                <div className="tap" style={{ width: 34, height: 34, borderRadius: 10, background: `${C.danger}14`, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.danger}20` }}>
                  <Icon n="x" size={16} color={C.danger} />
                </div>
              </div>
            </div>
          </div>

          {/* Family Member Management */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SecLabel style={{ marginBottom: 0 }}>Active Connections</SecLabel>
            <div onClick={() => setActiveChat({ name: "Family Group Chat", isGroup: true })} className="tap" style={{ display: "flex", alignItems: "center", gap: 6, color: C.accent, fontSize: 12, fontWeight: 700 }}>
              <Icon n="messageCircle" size={16} color={C.accent} />
              Group Chat
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {members.map((m, i) => (
              <Card key={i} style={{ padding: "14px 16px", borderRadius: 22, background: "rgba(255, 255, 255, 0.7)", border: `1px solid ${C.border}`, backdropFilter: "blur(10px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ position: "relative" }}>
                    <Avatar name={m.img} size={50} />
                    {m.isMe && (
                      <div style={{
                        position: "absolute", bottom: -2, right: -2, background: C.accent, color: "#fff",
                        fontSize: 9, fontWeight: 900, padding: "2px 6px", borderRadius: 6, border: "2px solid #fff"
                      }}>YOU</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 800, color: C.text }}>{m.name}</p>
                    <p style={{ fontSize: 11, color: C.textMid, fontWeight: 500 }}>{m.role}</p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div onClick={() => setActiveChat({ name: m.name, isGroup: false })} className="tap" style={{ width: 38, height: 38, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon n="messageCircle" size={18} color={C.textMid} />
                    </div>
                    {!m.isMe && (
                      <div className="tap" style={{ width: 38, height: 38, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon n="userMinus" size={18} color={C.danger} />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Phone Frame ────────────────────────────────────────────────────────────
const PhoneFrame = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "28px 16px", background: "linear-gradient(145deg, #E8EDF5 0%, #D4DCF0 100%)" }}>
    <div style={{ position: "relative", width: 390, height: 844, borderRadius: 52, background: C.bg, boxShadow: "0 0 0 1px #CBD5E1, 0 0 0 5px #F1F5FB, 0 30px 90px rgba(60,80,130,0.22)", overflow: "hidden" }}>
      {children}
    </div>
  </div>
);

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("buddy");
  const nav = (t) => setTab(t);
  const screens = {
    buddy: <BuddyScreen navigate={nav} />,
    explore: <ExploreScreen navigate={nav} />,
    memory: <MemoryScreen navigate={nav} />,
    reminder: <ReminderScreen navigate={nav} />,
    family: <FamilyScreen navigate={nav} />,
    settings: <SettingsScreen navigate={nav} />,
  };
  return (
    <>
      <style>{globalCSS}</style>
      <PhoneFrame>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <TopNav tab={tab} setTab={setTab} />
          <div key={tab} style={{ height: "100%", overflow: "hidden" }}>
            {screens[tab]}
          </div>
        </div>
      </PhoneFrame>
    </>
  );
}
