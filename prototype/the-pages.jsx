import { useState, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["All", "Arts", "Community", "Wellness", "Volunteer", "Food"];
const PATTERNS = ["stripes", "dots", "grid", "zigzag", "circles"];
const COLOR_PRESETS = [
  { bg: "#1a1a2e", accent: "#E63946" },
  { bg: "#d8f3dc", accent: "#2d6a4f" },
  { bg: "#ff6b6b", accent: "#ffd93d" },
  { bg: "#003566", accent: "#ffd166" },
  { bg: "#10002b", accent: "#c77dff" },
  { bg: "#fff8f0", accent: "#ff6b35" },
  { bg: "#0d1b2a", accent: "#00b4d8" },
  { bg: "#1a0a00", accent: "#fb8500" },
];
const LIGHT_BGS = ["#d8f3dc", "#ff6b6b", "#fff8f0", "#f5f0e8"];

// ─── API Key ─────────────────────────────────────────────────────────────────
// Set your Anthropic API key here for prototype AI scanning.
// In production, this goes through Supabase Edge Functions (never in client code).
const ANTHROPIC_API_KEY = localStorage.getItem("thepages_anthropic_key") || "";

const MY_PROFILE = {
  name: "Jordan Lee",
  handle: "@jordanlee",
  avatar: "JL",
  avatarColor: "#E63946",
  bio: "Community organizer · lover of local events · always finding the next good thing nearby 🗓️",
  isPublic: true,
  location: "Brooklyn, NY",
};

// ─── Sample data with event groups for carousel demo ─────────────────────────
// Posts 1a, 1b, 1c are all the same event (grouped) — NIGHT MARKET at East Market Plaza
// Posts 2, 3, 4, 5 are standalone (single-post groups)
const INITIAL_FLYERS = [
  // ── GROUPED EVENT: Night Market (3 posts from different people) ──
  { id: "1a", groupId: "g1", user: "Eastside Eats", handle: "@eastsideeats", avatar: "EE", avatarColor: "#c77dff", time: "1d ago", title: "NIGHT MARKET", subtitle: "40+ local vendors", description: "Street food, handmade goods, live music. Every last Saturday of the month.", caption: "Can't wait for this one 🔥", location: "East Market Plaza", date: "SAT APR 26 • 5–11PM", bgColor: "#10002b", accentColor: "#c77dff", textColor: "#ffffff", tags: ["#food", "#market", "#nightlife", "#eastside"], saved: false, category: "Food", pattern: "circles", isPublic: true, isMine: false, saveCount: 12, shareCount: 8 },
  { id: "1b", groupId: "g1", user: "FoodieFinds LA", handle: "@foodiefindsla", avatar: "FF", avatarColor: "#fb8500", time: "18h ago", title: "NIGHT MARKET", subtitle: "40+ local vendors", description: "The best street food in the city all in one spot.", caption: "Last month was incredible, even better lineup this time", location: "East Market Plaza", date: "SAT APR 26 • 5–11PM", bgColor: "#1a0a00", accentColor: "#fb8500", textColor: "#ffffff", tags: ["#food", "#streetfood", "#nightmarket"], saved: true, category: "Food", pattern: "stripes", isPublic: true, isMine: false, saveCount: 5, shareCount: 3 },
  { id: "1c", groupId: "g1", user: "Marco's Tacos", handle: "@marcostacos", avatar: "MT", avatarColor: "#ff6b35", time: "12h ago", title: "EAST MARKET NIGHT MARKET", subtitle: "We'll be at booth 7!", description: "Come try our new birria ramen fusion. Limited 200 servings.", caption: "Booth 7! Come hungry 🌮", location: "East Market Plaza", date: "SAT APR 26 • 5PM", bgColor: "#fff8f0", accentColor: "#ff6b35", textColor: "#1a1a1a", tags: ["#food", "#tacos", "#popup"], saved: false, category: "Food", pattern: "dots", isPublic: true, isMine: false, saveCount: 2, shareCount: 1 },

  // ── STANDALONE EVENTS ──
  { id: 2, groupId: "g2", user: "Riverside Arts Collective", handle: "@riversidearts", avatar: "RA", avatarColor: "#E63946", time: "2h ago", title: "OPEN MIC NIGHT", subtitle: "Every Friday • 8PM", description: "Bring your voice, your instrument, your poetry. All are welcome at the warehouse.", caption: "", location: "The Warehouse, 412 Commerce St", date: "FRI APR 4", bgColor: "#1a1a2e", accentColor: "#E63946", textColor: "#ffffff", tags: ["#music", "#arts", "#community"], saved: false, category: "Arts", pattern: "stripes", isPublic: true, isMine: false, saveCount: 0, shareCount: 0 },
  { id: 3, groupId: "g3", user: "Green Thumb Society", handle: "@greenthumb", avatar: "GT", avatarColor: "#2d6a4f", time: "5h ago", title: "SEED SWAP & PLANT FAIR", subtitle: "Bring seeds, take seeds!", description: "Swap seeds, share cuttings, and meet your fellow gardeners. Free entry. Bring bags.", caption: "", location: "Millbrook Community Garden", date: "SAT APR 12", bgColor: "#d8f3dc", accentColor: "#2d6a4f", textColor: "#1b1b1b", tags: ["#garden", "#sustainability", "#free"], saved: false, category: "Community", pattern: "dots", isPublic: true, isMine: false, saveCount: 0, shareCount: 0 },
  { id: 4, groupId: "g4", user: "Luna Yoga Studio", handle: "@lunayoga", avatar: "LY", avatarColor: "#7b2d8b", time: "8h ago", title: "ROOFTOP SUNRISE YOGA", subtitle: "Free community class", description: "Start your Sunday right. All levels welcome. Mats provided. Limited to 30 spots.", caption: "", location: "The Mercer Building Rooftop", date: "SUN APR 13 • 6:30AM", bgColor: "#ff6b6b", accentColor: "#ffd93d", textColor: "#1a1a1a", tags: ["#yoga", "#wellness", "#sunrise"], saved: true, category: "Wellness", pattern: "grid", isPublic: true, isMine: false, saveCount: 0, shareCount: 0 },
  { id: 5, groupId: "g5", user: "Block by Block", handle: "@blockbyblock", avatar: "BB", avatarColor: "#003566", time: "1d ago", title: "NEIGHBORHOOD CLEANUP", subtitle: "Let's make it shine", description: "Gloves and bags provided. Lunch will be served after. Kids welcome!", caption: "", location: "Corner of Oak & 5th", date: "SAT APR 19 • 9AM", bgColor: "#003566", accentColor: "#ffd166", textColor: "#ffffff", tags: ["#volunteer", "#neighborhood"], saved: false, category: "Volunteer", pattern: "zigzag", isPublic: true, isMine: false, saveCount: 0, shareCount: 0 },
];

// Group flyers by groupId for carousel rendering
function groupFlyers(flyers) {
  const groups = {};
  flyers.forEach(f => {
    if (!f.groupId) return;
    if (!groups[f.groupId]) groups[f.groupId] = [];
    groups[f.groupId].push(f);
  });
  // Sort each group by engagement (saveCount + shareCount) desc
  Object.values(groups).forEach(g =>
    g.sort((a, b) => (b.saveCount + b.shareCount) - (a.saveCount + a.shareCount))
  );
  return groups;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function isLight(bg) { return LIGHT_BGS.includes(bg); }
function textFor(bg) { return isLight(bg) ? "#1a1a1a" : "#ffffff"; }

// Parse rough date strings like "SAT MAR 29 • 5–11PM" or "FRI MAR 14" into a Date
function parseEventDate(dateStr) {
  if (!dateStr) return null;
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const clean = dateStr.toUpperCase().replace(/[•·–—]/g, " ").replace(/\s+/g, " ").trim();
  let month = null, day = null;
  for (const [abbr, idx] of Object.entries(months)) {
    if (clean.includes(abbr)) { month = idx; break; }
  }
  const dayMatch = clean.match(/\b(\d{1,2})\b/);
  if (dayMatch) day = parseInt(dayMatch[1], 10);
  if (month === null || day === null) return null;
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);
  // If date is more than 2 months in the past, assume next year
  if (candidate < new Date(now.getFullYear(), now.getMonth() - 2, 1)) year++;
  return new Date(year, month, day);
}

function isEventPast(dateStr) {
  const d = parseEventDate(dateStr);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

// ─── Pattern background ───────────────────────────────────────────────────────
function PatternBg({ pattern, color }) {
  const base = { position: "absolute", inset: 0, pointerEvents: "none" };
  const p = {
    stripes: { backgroundImage: `repeating-linear-gradient(45deg,${color} 0,${color} 1px,transparent 0,transparent 50%)`, backgroundSize: "22px 22px", opacity: 0.08 },
    dots:    { backgroundImage: `radial-gradient(circle,${color} 1.5px,transparent 1.5px)`, backgroundSize: "20px 20px", opacity: 0.18 },
    grid:    { backgroundImage: `linear-gradient(${color} 1px,transparent 1px),linear-gradient(90deg,${color} 1px,transparent 1px)`, backgroundSize: "28px 28px", opacity: 0.09 },
    zigzag:  { backgroundImage: `repeating-linear-gradient(120deg,${color} 0,${color} 1px,transparent 0,transparent 50%)`, backgroundSize: "24px 24px", opacity: 0.08 },
    circles: { backgroundImage: `radial-gradient(circle at 50% 50%,${color} 30%,transparent 31%)`, backgroundSize: "44px 44px", opacity: 0.07 },
  }[pattern];
  return p ? <div style={{ ...base, ...p }} /> : null;
}

// ─── More Menu (replaces "Report" button) ────────────────────────────────────
function PostActionMenu({ flyer, onClose, onEdit, onDelete, onReport, onDispute }) {
  const isMine = flyer.isMine;
  const isGrouped = flyer.groupId && flyer.groupPostCount > 1;

  const MenuItem = ({ icon, label, color = "#fff", onClick }) => (
    <button onClick={onClick} style={{
      width: "100%", background: "none", border: "none", padding: "14px 24px",
      display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color, letterSpacing: 0.5 }}>{label}</span>
    </button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 400, backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#141414", width: "100%", maxWidth: 480,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        padding: "8px 0 20px", animation: "slideUp 0.18s ease",
        borderTop: "2px solid #222",
      }}>
        <div style={{ width: 36, height: 4, background: "#333", borderRadius: 2, margin: "8px auto 16px" }} />

        {/* Menu title */}
        <div style={{
          padding: "0 24px 10px",
          fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
          color: "#444", letterSpacing: 1.5, textTransform: "uppercase",
        }}>{isMine ? "MORE" : "REPORT"}</div>

        {isMine && (
          <>
            <MenuItem icon="✏️" label="Edit Post" onClick={() => { onEdit(flyer); onClose(); }} />
            <MenuItem icon="🗑️" label="Delete Post" color="#E63946" onClick={() => { onDelete(flyer.id); onClose(); }} />
          </>
        )}

        {!isMine && (
          <MenuItem icon="🚩" label="Report Post" color="#E63946" onClick={() => { onReport(flyer.id); onClose(); }} />
        )}

        {/* Dispute: "Not the same event" — only shows for grouped posts */}
        {!isMine && isGrouped && (
          <MenuItem icon="⊘" label="Not the same event" color="#f59e0b" onClick={() => {
            onDispute && onDispute(flyer.id);
            onClose();
          }} />
        )}

        <button onClick={onClose} style={{
          width: "100%", background: "none", border: "none", padding: "14px 24px",
          display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
          borderTop: "1px solid #1e1e1e", marginTop: 4,
        }}>
          <span style={{ fontSize: 18 }}>✕</span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: "#666", letterSpacing: 0.5 }}>Cancel</span>
        </button>
      </div>
    </div>
  );
}

// ─── Report Confirmation ─────────────────────────────────────────────────────
function ReportConfirm({ onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const reasons = ["harmful", "misleading", "inappropriate", "spam", "pii", "other"];
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 500, backdropFilter: "blur(6px)",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#141414", width: "90%", maxWidth: 360,
        borderRadius: 12, padding: "24px", border: "1px solid #222",
        animation: "slideUp 0.18s ease",
      }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: 1, marginBottom: 16 }}>REPORT POST</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", marginBottom: 14, letterSpacing: 0.5 }}>Select a reason:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {reasons.map(r => (
            <button key={r} onClick={() => setReason(r)} style={{
              border: `1.5px solid ${reason === r ? "#E63946" : "#2a2a2a"}`,
              background: reason === r ? "#E63946" : "transparent",
              color: reason === r ? "#fff" : "#555",
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
              padding: "5px 12px", cursor: "pointer", letterSpacing: 0.5,
              borderRadius: 3, textTransform: "capitalize",
            }}>{r === "pii" ? "PII / Personal Info" : r}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#666",
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700,
            padding: "10px", cursor: "pointer", borderRadius: 4, letterSpacing: 1,
          }}>CANCEL</button>
          <button disabled={!reason} onClick={() => { onSubmit(reason); onClose(); }} style={{
            flex: 1, background: reason ? "#E63946" : "#1a1a1a", border: "none",
            color: reason ? "#fff" : "#333",
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700,
            padding: "10px", cursor: reason ? "pointer" : "not-allowed", borderRadius: 4, letterSpacing: 1,
          }}>REPORT</button>
        </div>
      </div>
    </div>
  );
}

// ─── Spinner Component ───────────────────────────────────────────────────────
function Spinner({ color = "#E63946" }) {
  return (
    <div style={{
      width: 24, height: 24, border: `2px solid rgba(255,255,255,0.1)`,
      borderTopColor: color, borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

// ─── Side Action Icons (save/share/more + user avatar) ──────────────────────
// These stay in the SAME position in both browse and details states
function SideActions({ flyer, activePost, onSave, onShare, onMenuOpen, onGoToProfile, showDetails }) {
  const post = activePost || flyer;
  return (
    <div style={{
      position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      zIndex: 20,
    }}>
      {/* User avatar */}
      <div
        onClick={() => onGoToProfile(post.isMine ? "me" : post.handle)}
        style={{
          width: 32, height: 32, borderRadius: "50%", background: post.avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, color: "#fff",
          border: "2px solid rgba(255,255,255,0.3)", cursor: "pointer",
          transition: "all 0.2s",
        }}
      >{post.avatar}</div>

      {/* Save */}
      <button onClick={() => onSave(post.id)} style={{
        background: post.saved ? "rgba(230,57,70,0.9)" : "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
        border: "1.5px solid rgba(255,255,255,0.2)",
        color: "#fff", width: 36, height: 36, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 16, transition: "all 0.2s",
      }}>{post.saved ? "★" : "☆"}</button>

      {/* Share */}
      <button onClick={() => onShare && onShare(flyer.groupId)} style={{
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        border: "1.5px solid rgba(255,255,255,0.2)",
        color: "#fff", width: 36, height: 36, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 14, transition: "all 0.2s",
      }}>↗</button>

      {/* More */}
      <button onClick={() => onMenuOpen(post)} style={{
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        border: "1.5px solid rgba(255,255,255,0.2)",
        color: "#fff", width: 36, height: 36, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 18, transition: "all 0.2s",
        fontFamily: "'DM Mono', monospace", fontWeight: 700,
      }}>⋮</button>
    </div>
  );
}

// ─── Carousel Dots ──────────────────────────────────────────────────────────
function CarouselDots({ total, activeIndex, accentColor }) {
  if (total <= 1) return null;
  return (
    <div style={{
      display: "flex", gap: 6, justifyContent: "center", alignItems: "center",
      padding: "8px 0",
    }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === activeIndex ? 18 : 6, height: 6,
          borderRadius: 3,
          background: i === activeIndex ? (accentColor || "#E63946") : "rgba(255,255,255,0.25)",
          transition: "all 0.25s ease",
        }} />
      ))}
      {total > 1 && (
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)",
          marginLeft: 6, letterSpacing: 0.5,
        }}>{total} posts</span>
      )}
    </div>
  );
}

// ─── Fullscreen Event Card (with carousel + details slide-up) ────────────────
function FullscreenFlyer({ flyer, groupPosts, onSave, onShare, isLast, onMenuOpen, onGoToProfile, onFilterCategory, onFilterTag }) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [buttonsActive, setButtonsActive] = useState(false);
  const touchStartRef = useRef(null);
  const touchStartYRef = useRef(null);

  const posts = groupPosts || [flyer];
  const activePost = posts[carouselIndex] || posts[0];
  const light = isLight(activePost.bgColor);
  const isGrouped = posts.length > 1;

  // Open details — no artificial delay, smooth CSS handles the transition
  const openDetails = useCallback(() => {
    setShowDetails(true);
    // Use requestAnimationFrame to ensure the DOM has rendered before enabling content
    requestAnimationFrame(() => {
      setDetailsLoaded(true);
      setButtonsActive(true);
    });
  }, []);

  const closeDetails = () => {
    setShowDetails(false);
    setDetailsLoaded(false);
    setButtonsActive(false);
  };

  // Touch handling: horizontal = carousel, tap/swipe up = details
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;

    // Horizontal swipe (carousel)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && carouselIndex < posts.length - 1) {
        setCarouselIndex(i => i + 1);
      } else if (dx > 0 && carouselIndex > 0) {
        setCarouselIndex(i => i - 1);
      }
    }
    // Vertical swipe up (show details)
    else if (dy < -50 && Math.abs(dy) > Math.abs(dx)) {
      if (!showDetails) openDetails();
    }
    // Vertical swipe down (close details)
    else if (dy > 50 && Math.abs(dy) > Math.abs(dx)) {
      if (showDetails) closeDetails();
    }

    touchStartRef.current = null;
    touchStartYRef.current = null;
  };

  // Click handler for non-touch: toggle details
  const handleClick = (e) => {
    // Don't toggle if clicking on buttons
    if (e.target.closest('button') || e.target.closest('[data-action]')) return;
    if (showDetails) closeDetails();
    else openDetails();
  };

  return (
    <div style={{
      position: "relative", width: "100%", height: "calc(100svh - 62px)",
      background: showDetails ? "#0a0a0a" : activePost.bgColor,
      display: "flex", flexDirection: "column",
      overflow: "hidden", scrollSnapAlign: "start", scrollSnapStop: "always", flexShrink: 0,
      transition: "background 0.35s ease",
    }}>

      {/* ── BROWSE STATE: original layout, unchanged ── */}
      {!showDetails && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 1 }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <PatternBg pattern={activePost.pattern} color={activePost.accentColor} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: activePost.accentColor, zIndex: 2 }} />

          {/* Private badge */}
          {!activePost.isPublic && (
            <div style={{
              position: "absolute", top: 14, right: 14, zIndex: 5,
              background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
              border: "1.5px solid rgba(255,255,255,0.2)",
              color: "#fff", fontFamily: "'DM Mono', monospace",
              fontSize: 9, letterSpacing: 1.5, padding: "4px 10px",
            }}>🔒 PRIVATE</div>
          )}

          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            justifyContent: "space-between", padding: "52px 28px 28px",
            position: "relative", zIndex: 1, height: "100%",
          }}>
            {/* Top row: category + more/save buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div onClick={(e) => { e.stopPropagation(); onFilterCategory && onFilterCategory(activePost.category); }} style={{
                background: activePost.accentColor, color: light ? "#111" : "#fff",
                fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
                padding: "5px 13px", letterSpacing: 2, textTransform: "uppercase",
                border: `2px solid ${activePost.textColor}`, cursor: "pointer",
              }}>{activePost.category}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={(e) => { e.stopPropagation(); onMenuOpen(activePost); }} style={{
                  background: "rgba(128,128,128,0.2)", backdropFilter: "blur(4px)",
                  border: `2px solid ${activePost.textColor}`,
                  color: activePost.textColor, width: 42, height: 42, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 16, transition: "all 0.2s",
                  fontFamily: "'DM Mono', monospace", fontWeight: 700, letterSpacing: 2,
                }}>···</button>
                <button onClick={(e) => { e.stopPropagation(); onSave(activePost.id); }} style={{
                  background: activePost.saved ? activePost.accentColor : "rgba(128,128,128,0.2)",
                  border: `2px solid ${activePost.saved ? activePost.accentColor : activePost.textColor}`,
                  color: activePost.saved ? (light ? "#111" : "#fff") : activePost.textColor,
                  width: 42, height: 42, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 18, transition: "all 0.2s",
                  backdropFilter: "blur(4px)",
                }}>{activePost.saved ? "★" : "☆"}</button>
              </div>
            </div>

            {/* Title */}
            <div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "clamp(52px, 13vw, 84px)", fontWeight: 900,
                lineHeight: 0.88, color: activePost.textColor, textTransform: "uppercase",
                letterSpacing: -2, textShadow: !light ? "3px 3px 0 rgba(0,0,0,0.18)" : "none",
              }}>{activePost.title}</div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21,
                fontWeight: 600, letterSpacing: 2, color: activePost.accentColor,
                marginTop: 14, textTransform: "uppercase",
              }}>{activePost.subtitle}</div>
              {activePost.description && (
                <p style={{
                  fontFamily: "'Barlow', sans-serif", fontSize: 15, lineHeight: 1.6,
                  color: activePost.textColor, opacity: 0.72, marginTop: 18, maxWidth: 360,
                }}>{activePost.description}</p>
              )}
            </div>

            {/* Footer */}
            <div>
              <div style={{ height: 1, background: activePost.textColor, opacity: 0.12, marginBottom: 18 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12 }}>📍</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: activePost.textColor, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>{activePost.location}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(activePost.tags || []).map(t => (
                      <span key={t} onClick={(e) => { e.stopPropagation(); onFilterTag && onFilterTag(t); }} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: activePost.textColor, opacity: 0.38, cursor: "pointer" }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{
                  border: `2px solid ${activePost.accentColor}`, color: activePost.accentColor,
                  fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
                  padding: "7px 13px", letterSpacing: 1.5, textTransform: "uppercase",
                }}>{activePost.date}</div>
              </div>
              <div
                onClick={(e) => { e.stopPropagation(); onGoToProfile(activePost.isMine ? "me" : activePost.handle); }}
                style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, cursor: "pointer" }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", background: activePost.avatarColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, color: "#fff",
                  border: `1.5px solid ${activePost.textColor}`, opacity: 0.85, flexShrink: 0,
                }}>{activePost.avatar}</div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: activePost.textColor, opacity: 0.45 }}>{activePost.handle} · {activePost.time}</span>
              </div>

              {/* Carousel dots — only visible on grouped events */}
              {isGrouped && (
                <div style={{ marginTop: 12 }}>
                  <CarouselDots
                    total={posts.length}
                    activeIndex={carouselIndex}
                    accentColor={activePost.accentColor}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DETAILS STATE: image shrinks, details push in ── */}
      {showDetails && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          {/* Shrunk image area (~35% of screen) */}
          <div style={{
            height: "35%", flexShrink: 0, position: "relative", overflow: "hidden",
            background: activePost.bgColor,
            animation: "detailsImageShrink 0.25s ease-out forwards",
            willChange: "max-height",
          }}>
            <PatternBg pattern={activePost.pattern} color={activePost.accentColor} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: activePost.accentColor }} />

            {/* Mini title in shrunk image */}
            <div style={{
              position: "absolute", bottom: 16, left: 20, right: 70, zIndex: 2,
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 28, fontWeight: 900, lineHeight: 0.9,
                color: activePost.textColor, textTransform: "uppercase", letterSpacing: -1,
              }}>{activePost.title}</div>
            </div>

            {/* Carousel dots in image area — bottom center */}
            <div style={{ position: "absolute", bottom: 4, left: 0, right: 60, zIndex: 5 }}>
              <CarouselDots
                total={posts.length}
                activeIndex={carouselIndex}
                accentColor={activePost.accentColor}
              />
            </div>
          </div>

          {/* Details content area */}
          <div style={{
            flex: 1, padding: "20px 20px 20px 20px", overflowY: "auto",
            animation: "detailsSlideUp 0.25s ease-out forwards",
            willChange: "transform, opacity",
          }}>
            {/* Spinner while loading */}
            {!detailsLoaded && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: "100%",
              }}>
                <Spinner color={activePost.accentColor || "#E63946"} />
              </div>
            )}

            {/* Loaded details */}
            {detailsLoaded && (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                {/* Category — tappable to filter browse */}
                <div
                  onClick={(e) => { e.stopPropagation(); onFilterCategory && onFilterCategory(activePost.category); }}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
                    letterSpacing: 3, color: activePost.accentColor, textTransform: "uppercase",
                    marginBottom: 6, cursor: "pointer",
                    display: "inline-block",
                  }}
                >{activePost.category}</div>

                {/* Event name */}
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 900,
                  color: "#fff", textTransform: "uppercase", letterSpacing: -0.5, lineHeight: 1,
                }}>{activePost.title}</div>

                {/* Venue + Date + Price */}
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 600,
                  color: "#aaa", marginTop: 4, letterSpacing: 0.5,
                }}>{activePost.location}</div>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#666",
                  marginTop: 4, letterSpacing: 0.5,
                }}>{activePost.date}</div>

                {/* Caption (poster's take) */}
                {activePost.caption && (
                  <div style={{
                    fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#888",
                    marginTop: 14, lineHeight: 1.5, fontStyle: "italic",
                    borderLeft: `2px solid ${activePost.accentColor}`, paddingLeft: 12,
                  }}>
                    "{activePost.caption}"
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555",
                      marginLeft: 8,
                    }}>— {activePost.handle}</span>
                  </div>
                )}

                {/* Calendar + Maps rows */}
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    disabled={!buttonsActive}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: buttonsActive ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                      border: "1px solid #1e1e1e", borderRadius: 8,
                      padding: "12px 14px", cursor: buttonsActive ? "pointer" : "default",
                      transition: "all 0.2s", width: "100%",
                      opacity: buttonsActive ? 1 : 0.4,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🗓</span>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
                      color: buttonsActive ? "#fff" : "#444", letterSpacing: 0.5,
                    }}>{activePost.date || "Add to Calendar"}</span>
                  </button>
                  <button
                    disabled={!buttonsActive}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: buttonsActive ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                      border: "1px solid #1e1e1e", borderRadius: 8,
                      padding: "12px 14px", cursor: buttonsActive ? "pointer" : "default",
                      transition: "all 0.2s", width: "100%",
                      opacity: buttonsActive ? 1 : 0.4,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>📍</span>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
                      color: buttonsActive ? "#fff" : "#444", letterSpacing: 0.5,
                    }}>{activePost.location || "View on Maps"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Hashtags — pinned to bottom, tappable to filter browse */}
          <div style={{
            padding: "8px 16px 12px", borderTop: "1px solid #1a1a1a",
            display: "flex", gap: 6, overflowX: "auto", flexShrink: 0,
          }}>
            {(activePost.tags || []).map((tag, i) => {
              const tagColors = ["#E63946", "#a67c00", "#6b21a8", "#0891b2"];
              return (
                <span key={tag} onClick={(e) => { e.stopPropagation(); onFilterTag && onFilterTag(tag); }} style={{
                  flexShrink: 0, background: tagColors[i % tagColors.length],
                  color: "#fff", fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12, fontWeight: 700, padding: "4px 10px",
                  borderRadius: 3, letterSpacing: 0.5, cursor: "pointer",
                }}>{tag}</span>
              );
            })}
          </div>
        </div>
      )}

      {/* Side actions only in details state */}
      {showDetails && (
        <SideActions
          flyer={flyer}
          activePost={activePost}
          onSave={onSave}
          onShare={() => {}}
          onMenuOpen={onMenuOpen}
          onGoToProfile={onGoToProfile}
          showDetails={showDetails}
        />
      )}
    </div>
  );
}

// ─── AI Scan + Post Modal ─────────────────────────────────────────────────────
function PostModal({ onClose, onPost, userLocation }) {
  const [step, setStep] = useState("upload"); // upload | scanning | form
  const [scanError, setScanError] = useState("");
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isPublic, setIsPublic] = useState(true);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Community");
  const [eventUrl, setEventUrl] = useState("");
  const [tags, setTags] = useState([]);
  const [bg, setBg] = useState("#1a1a2e");
  const [accent, setAccent] = useState("#E63946");

  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      setImageData({ base64, mediaType });
      setStep("scanning");
      setScanError("");
      // Reset file input AFTER we have the data so re-selecting works
      if (fileRef.current) fileRef.current.value = "";
      await scanWithAI(base64, mediaType);
    } catch (err) {
      console.error("File read error:", err);
      setScanError("Failed to read image. Please try again.");
      setStep("upload");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const scanWithAI = async (base64, mediaType) => {
    const apiKey = ANTHROPIC_API_KEY || prompt("Enter your Anthropic API key for AI scanning.\nThis is stored in localStorage for this browser only.\n\nGet one at: console.anthropic.com → API Keys");
    if (apiKey && !ANTHROPIC_API_KEY) {
      localStorage.setItem("thepages_anthropic_key", apiKey);
    }
    if (!apiKey) {
      setScanError("No API key provided. Fill in details manually.");
      setStep("form");
      return;
    }
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 }
              },
              {
                type: "text",
                text: `You are reading a community event flyer or poster image. Extract all the key information and return ONLY a valid JSON object with no markdown, no backticks, no extra text.${userLocation ? `\n\nIMPORTANT: The user is posting from ${userLocation}. When you identify a venue name, assume it is the location nearest to ${userLocation} — not the most popular or well-known one globally. For example, if the flyer says "El Rio" and the user is in San Francisco, it means El Rio in San Francisco, not another city.` : ""}

Use these exact keys:
{
  "title": "MAIN EVENT NAME in all caps",
  "subtitle": "Short tagline or time info",
  "description": "Brief event description, 1-2 sentences",
  "location": "Venue name and/or address (include city if identifiable, prefer the location nearest to the user)",
  "date": "Date and time, abbreviated like SAT APR 5 • 7PM",
  "category": "One of: Arts, Community, Wellness, Volunteer, Food",
  "tags": ["#tag1", "#tag2"],
  "eventUrl": "Any URL, link, or website visible on the flyer (empty string if none)"
}
If a field is not visible, use an empty string. Return JSON only.`
              }
            ]
          }]
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API error ${res.status}`);
      }
      const data = await res.json();
      const raw = data.content?.find(b => b.type === "text")?.text || "{}";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setTitle(parsed.title || "");
      setSubtitle(parsed.subtitle || "");
      setDescription(parsed.description || "");
      setLocation(parsed.location || "");
      setDate(parsed.date || "");
      if (parsed.eventUrl) setEventUrl(parsed.eventUrl);
      if (parsed.tags && parsed.tags.length > 0) setTags(parsed.tags);
      if (parsed.category && CATEGORIES.includes(parsed.category)) setCategory(parsed.category);
      setStep("form");
    } catch (err) {
      console.error("AI scan error:", err);
      setScanError(`AI scan failed: ${err.message}. Fill in details manually.`);
      setStep("form");
    }
  };

  const canPost = title.trim() && subtitle.trim();
  const lightBg = isLight(bg);
  const textColor = textFor(bg);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 300, backdropFilter: "blur(8px)",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#0e0e0e", width: "100%", maxWidth: 480,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: "94vh", overflowY: "auto",
        borderTop: "3px solid #E63946",
        animation: "slideUp 0.22s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 20px 14px", display: "flex",
          justifyContent: "space-between", alignItems: "center",
          borderBottom: "1px solid #1e1e1e",
        }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: 1, color: "#fff", textTransform: "uppercase" }}>
            Post a Page
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#555" }}>✕</button>
        </div>

        {/* Upload step */}
        {step === "upload" && (
          <div style={{ padding: "28px 20px" }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />

            {/* AI scan zone */}
            <div
              onClick={() => fileRef.current.click()}
              style={{
                border: "2px dashed #333", borderRadius: 12, padding: "40px 20px",
                textAlign: "center", cursor: "pointer", background: "#111",
                transition: "border-color 0.2s",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: 0.5 }}>
                Upload Your Flyer
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", marginTop: 8, letterSpacing: 0.5, lineHeight: 1.6 }}>
                AI will read the image and<br />fill in event details automatically
              </div>
              <div style={{
                display: "inline-block", marginTop: 16,
                background: "#E63946", color: "#fff",
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800,
                letterSpacing: 1.5, padding: "8px 20px",
              }}>SCAN WITH AI →</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: "#222" }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: 1 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: "#222" }} />
            </div>

            <button onClick={() => setStep("form")} style={{
              width: "100%", background: "transparent",
              border: "2px solid #333", color: "#666",
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700,
              letterSpacing: 1.5, padding: "12px", cursor: "pointer",
              transition: "border-color 0.2s, color 0.2s",
            }}>FILL IN MANUALLY</button>
          </div>
        )}

        {/* Scanning step */}
        {step === "scanning" && (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            {imagePreview && (
              <div style={{
                width: 120, height: 120, borderRadius: 10, overflow: "hidden",
                margin: "0 auto 24px", border: "2px solid #222",
              }}>
                <img src={imagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div style={{ animation: "spin 1s linear infinite", fontSize: 32, marginBottom: 16 }}>⟳</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>
              READING YOUR FLYER...
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", marginTop: 8, letterSpacing: 0.5 }}>
              AI is extracting event details
            </div>
          </div>
        )}

        {/* Form step */}
        {step === "form" && (
          <div style={{ padding: "20px" }}>
            {scanError && (
              <div style={{
                background: "#1a0a0a", border: "1px solid #4a1010",
                color: "#ff6b6b", fontFamily: "'DM Mono', monospace",
                fontSize: 10, padding: "10px 14px", marginBottom: 16, letterSpacing: 0.5,
              }}>{scanError}</div>
            )}

            {imagePreview && (
              <div style={{ marginBottom: 16, position: "relative" }}>
                <img src={imagePreview} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 6, border: "1px solid #222" }} />
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
                  color: "#4ade80", fontFamily: "'DM Mono', monospace",
                  fontSize: 9, padding: "4px 10px", letterSpacing: 1,
                }}>✓ AI SCANNED</div>
                <button onClick={() => { setImagePreview(null); setStep("upload"); }} style={{
                  position: "absolute", top: 8, left: 8,
                  background: "rgba(0,0,0,0.7)", border: "none", color: "#aaa",
                  fontFamily: "'DM Mono', monospace", fontSize: 9, padding: "4px 10px",
                  cursor: "pointer", letterSpacing: 1,
                }}>↩ RESCAN</button>
              </div>
            )}

            {/* Live poster preview */}
            <div style={{
              background: bg, borderRadius: 6, padding: "20px 18px",
              border: "1px solid #222", position: "relative", overflow: "hidden",
              minHeight: 130, marginBottom: 20,
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: accent }} />
              <PatternBg pattern="dots" color={accent} />
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 38, fontWeight: 900,
                color: textColor, textTransform: "uppercase", lineHeight: 0.9,
                letterSpacing: -1, position: "relative", zIndex: 1,
              }}>{title || "YOUR TITLE"}</div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15,
                color: accent, marginTop: 8, letterSpacing: 1.5, textTransform: "uppercase",
                position: "relative", zIndex: 1,
              }}>{subtitle || "Subtitle · Time"}</div>
            </div>

            {/* Color presets */}
            <Label>Color Scheme</Label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {COLOR_PRESETS.map((p, i) => (
                <button key={i} onClick={() => { setBg(p.bg); setAccent(p.accent); }} style={{
                  width: 34, height: 34,
                  background: `linear-gradient(135deg,${p.bg} 50%,${p.accent} 50%)`,
                  border: bg === p.bg ? "3px solid #E63946" : "2px solid #222",
                  cursor: "pointer", borderRadius: 4, transition: "border 0.15s",
                }} />
              ))}
            </div>

            {/* Fields */}
            {[
              ["Title *", title, setTitle, "e.g. BLOCK PARTY", false],
              ["Subtitle / Time *", subtitle, setSubtitle, "e.g. Saturday 4PM", false],
              ["Date", date, setDate, "e.g. SAT APR 5 • 7PM", false],
              ["Location", location, setLocation, "e.g. The Park on Main", false],
              ["Event Link", eventUrl, setEventUrl, "e.g. https://eventbrite.com/...", false],
              ["Description", description, setDescription, "What's happening?", true],
            ].map(([label, val, setter, ph, isArea]) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <Label>{label}</Label>
                {isArea ? (
                  <textarea value={val} onChange={e => setter(e.target.value)} placeholder={ph} rows={3} style={{
                    width: "100%", background: "#111", border: "1.5px solid #2a2a2a",
                    color: "#fff", padding: "9px 12px", fontFamily: "'Barlow', sans-serif",
                    fontSize: 14, outline: "none", resize: "none", boxSizing: "border-box", borderRadius: 4,
                  }} />
                ) : (
                  <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} style={{
                    width: "100%", background: "#111", border: "1.5px solid #2a2a2a",
                    color: "#fff", padding: "9px 12px",
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 600,
                    outline: "none", boxSizing: "border-box", borderRadius: 4,
                  }} />
                )}
              </div>
            ))}

            {/* Category */}
            <Label>Category</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {CATEGORIES.filter(c => c !== "All").map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  border: `1.5px solid ${category === c ? "#E63946" : "#2a2a2a"}`,
                  background: category === c ? "#E63946" : "transparent",
                  color: category === c ? "#fff" : "#555",
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
                  padding: "5px 14px", cursor: "pointer", letterSpacing: 0.5, transition: "all 0.15s",
                  borderRadius: 3,
                }}>{c}</button>
              ))}
            </div>

            {/* Public / Private toggle */}
            <Label>Visibility</Label>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {[
                { val: true,  icon: "🌍", label: "Public",  sub: "Anyone can see this" },
                { val: false, icon: "🔒", label: "Private", sub: "Only you can see this" },
              ].map(opt => (
                <button key={opt.label} onClick={() => setIsPublic(opt.val)} style={{
                  flex: 1, padding: "12px 10px", cursor: "pointer",
                  background: isPublic === opt.val ? (opt.val ? "#0a2a0a" : "#1a0a0a") : "#111",
                  border: `1.5px solid ${isPublic === opt.val ? (opt.val ? "#4ade80" : "#E63946") : "#222"}`,
                  borderRadius: 6, textAlign: "left", transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 800,
                    color: isPublic === opt.val ? "#fff" : "#444", letterSpacing: 0.5,
                  }}>{opt.label}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#444", letterSpacing: 0.3, marginTop: 2 }}>{opt.sub}</div>
                </button>
              ))}
            </div>

            <button
              disabled={!canPost}
              onClick={() => {
                onPost({ title, subtitle, description, location, date, category, bgColor: bg, accentColor: accent, textColor, isPublic, imagePreview, eventUrl, tags });
                onClose();
              }}
              style={{
                width: "100%", background: canPost ? "#E63946" : "#1a1a1a",
                color: canPost ? "#fff" : "#333", border: "none",
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 900,
                letterSpacing: 2, textTransform: "uppercase",
                padding: "15px", cursor: canPost ? "pointer" : "not-allowed",
                borderRadius: 4, transition: "background 0.2s",
              }}
            >POST PAGE →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Search Overlay (user search + filter dispatch to browse) ────────────────
function SearchOverlay({ flyers, onClose, onSave, activeCategory, setActiveCategory, onBrowseFilter }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("events"); // "events" | "users"

  // Unique users from flyers
  const allUsers = [];
  const seenHandles = new Set();
  flyers.forEach(f => {
    if (!seenHandles.has(f.handle)) {
      seenHandles.add(f.handle);
      allUsers.push({ handle: f.handle, name: f.user, avatar: f.avatar, avatarColor: f.avatarColor });
    }
  });

  const filteredUsers = allUsers.filter(u =>
    !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.handle.toLowerCase().includes(q.toLowerCase())
  );

  // When searching events, dispatch to browse and close
  const handleEventSearch = () => {
    if (q.trim()) {
      onBrowseFilter(q.trim());
      onClose();
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0e0e0e", zIndex: 200, display: "flex", flexDirection: "column", animation: "slideUp 0.2s ease" }}>
      <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && mode === "events") handleEventSearch(); }} placeholder={mode === "users" ? "Search users..." : "Search events, places, tags..."} style={{
            flex: 1, background: "#111", border: "1.5px solid #2a2a2a",
            color: "#fff", padding: "10px 14px",
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, outline: "none", borderRadius: 4,
          }} />
          <button onClick={onClose} style={{
            background: "none", border: "1.5px solid #2a2a2a", padding: "9px 14px",
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
            cursor: "pointer", letterSpacing: 1, color: "#aaa", borderRadius: 4,
          }}>DONE</button>
        </div>
        {/* Mode tabs: Events vs Users */}
        <div style={{ display: "flex", gap: 0, marginBottom: 10 }}>
          {[["events", "Events"], ["users", "Users"]].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} style={{
              flex: 1, padding: "8px 0", background: "none", border: "none",
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
              letterSpacing: 1, cursor: "pointer",
              color: mode === id ? "#fff" : "#333",
              borderBottom: mode === id ? "2px solid #E63946" : "2px solid transparent",
            }}>{label}</button>
          ))}
        </div>
        {/* Category pills for event search */}
        {mode === "events" && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => { setActiveCategory(cat); onClose(); }} style={{
                flexShrink: 0, border: `1.5px solid ${activeCategory === cat ? "#E63946" : "#222"}`,
                background: activeCategory === cat ? "#E63946" : "transparent",
                color: activeCategory === cat ? "#fff" : "#555",
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
                padding: "4px 12px", cursor: "pointer", letterSpacing: 0.5, transition: "all 0.15s",
                borderRadius: 3,
              }}>{cat}</button>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {mode === "events" && (
          q.trim() ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <button onClick={handleEventSearch} style={{
                background: "#E63946", border: "none", color: "#fff",
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800,
                padding: "12px 24px", cursor: "pointer", letterSpacing: 1, borderRadius: 4,
              }}>FILTER BROWSE FOR "{q.toUpperCase()}"</button>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", marginTop: 10, letterSpacing: 0.5 }}>
                Press Enter or tap to filter the browse feed
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, color: "#333" }}>
              Type to filter events on browse, or tap a category above
            </div>
          )
        )}
        {mode === "users" && (
          filteredUsers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: "#333" }}>No users found</div>
          ) : filteredUsers.map(u => (
            <div key={u.handle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #141414", cursor: "pointer" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: u.avatarColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: "#fff",
                border: "2px solid rgba(255,255,255,0.15)", flexShrink: 0,
              }}>{u.avatar}</div>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800, color: "#fff" }}>{u.name}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555" }}>{u.handle}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
function ProfilePage({ flyers, profile, onProfileChange, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...profile });
  const [activeTab, setActiveTab] = useState("public");

  const myFlyers = flyers.filter(f => f.isMine);
  const shown = activeTab === "past"
    ? myFlyers.filter(f => isEventPast(f.date))
    : myFlyers.filter(f => activeTab === "public" ? (f.isPublic && !isEventPast(f.date)) : !f.isPublic);

  const save = () => { onProfileChange(draft); setEditing(false); };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "calc(100svh - 62px)", overflowY: "auto" }}>
      {/* Header band */}
      <div style={{
        background: "#111", borderBottom: "1px solid #1a1a1a",
        padding: "28px 20px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
            background: profile.avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 700, color: "#fff",
            border: "3px solid #E63946",
          }}>{profile.avatar}</div>

          <div style={{ flex: 1 }}>
            {editing ? (
              <>
                <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, width: "100%", padding: "4px 8px", marginBottom: 6, outline: "none" }} />
                <input value={draft.handle} onChange={e => setDraft(d => ({ ...d, handle: e.target.value }))} style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#555", fontFamily: "'DM Mono', monospace", fontSize: 11, width: "100%", padding: "4px 8px", marginBottom: 6, outline: "none" }} />
                <input value={draft.location} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} placeholder="Location" style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#555", fontFamily: "'DM Mono', monospace", fontSize: 11, width: "100%", padding: "4px 8px", marginBottom: 6, outline: "none" }} />
                <textarea value={draft.bio} onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))} rows={2} style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#aaa", fontFamily: "'Barlow', sans-serif", fontSize: 13, width: "100%", padding: "4px 8px", outline: "none", resize: "none" }} />
              </>
            ) : (
              <>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>{profile.name}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", marginTop: 2 }}>{profile.handle} · {profile.location}</div>
                <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#666", marginTop: 8, lineHeight: 1.5 }}>{profile.bio}</div>
              </>
            )}
          </div>
        </div>

        {/* Profile visibility + edit */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          {/* Public/Private profile toggle */}
          <button onClick={() => onProfileChange({ ...profile, isPublic: !profile.isPublic })} style={{
            background: profile.isPublic ? "#0a2a0a" : "#1a0a0a",
            border: `1.5px solid ${profile.isPublic ? "#4ade80" : "#E63946"}`,
            color: profile.isPublic ? "#4ade80" : "#E63946",
            fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700,
            padding: "6px 14px", cursor: "pointer", letterSpacing: 1.5, borderRadius: 3,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {profile.isPublic ? "🌍 PUBLIC PROFILE" : "🔒 PRIVATE PROFILE"}
          </button>

          <div style={{ flex: 1 }} />

          {editing ? (
            <>
              <button onClick={() => setEditing(false)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#444", fontFamily: "'DM Mono', monospace", fontSize: 9, padding: "6px 12px", cursor: "pointer", letterSpacing: 1, borderRadius: 3 }}>CANCEL</button>
              <button onClick={save} style={{ background: "#E63946", border: "none", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, padding: "6px 14px", cursor: "pointer", letterSpacing: 1, borderRadius: 3 }}>SAVE</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#555", fontFamily: "'DM Mono', monospace", fontSize: 9, padding: "6px 14px", cursor: "pointer", letterSpacing: 1, borderRadius: 3 }}>EDIT</button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 0, marginTop: 18, borderTop: "1px solid #1a1a1a", paddingTop: 16 }}>
          {[
            ["POSTED", myFlyers.length],
            ["PUBLIC", myFlyers.filter(f => f.isPublic).length],
            ["PRIVATE", myFlyers.filter(f => !f.isPublic).length],
            ["SAVED", flyers.filter(f => f.saved).length],
          ].map(([label, val]) => (
            <div key={label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{val}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#444", letterSpacing: 1, marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* My pages tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a" }}>
        {[["public", "🌍 Public"], ["private", "🔒 Private"], ["past", "📁 Past Flyers"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            flex: 1, padding: "12px 0", background: "none", border: "none",
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
            letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
            color: activeTab === id ? "#fff" : "#333",
            borderBottom: activeTab === id ? "2px solid #E63946" : "2px solid transparent",
          }}>{label}</button>
        ))}
      </div>

      {/* My pages grid */}
      {shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, color: "#2a2a2a", letterSpacing: 1 }}>
          NO {activeTab.toUpperCase()} PAGES YET
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, padding: 2 }}>
          {shown.map(f => (
            <div key={f.id} style={{
              background: f.bgColor, aspectRatio: "3/4",
              position: "relative", overflow: "hidden",
              cursor: "pointer",
            }}>
              <PatternBg pattern={f.pattern} color={f.accentColor} />
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: f.accentColor }} />
              <div style={{
                position: "absolute", inset: 0, padding: "14px 12px",
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
              }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900,
                  color: f.textColor, textTransform: "uppercase", letterSpacing: -0.5, lineHeight: 0.9,
                }}>{f.title}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: f.accentColor, marginTop: 5, letterSpacing: 0.5 }}>{f.date}</div>
              </div>
              {!f.isPublic && (
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,0.6)", color: "#fff",
                  fontFamily: "'DM Mono', monospace", fontSize: 8, padding: "2px 6px",
                }}>🔒</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Nav Button ───────────────────────────────────────────────────────────────
function NavBtn({ icon, label, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, border: "none",
      background: active ? "#161616" : "#0e0e0e",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      cursor: "pointer", gap: 3,
      borderLeft: "1px solid #1a1a1a",
      transition: "background 0.15s",
    }}>
      <span style={{ fontSize: 19, lineHeight: 1, color: active ? "#fff" : "#3a3a3a" }}>{icon}</span>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: 1, color: active ? "#aaa" : "#2a2a2a", textTransform: "uppercase" }}>{label}</span>
    </button>
  );
}

// ─── Label helper ─────────────────────────────────────────────────────────────
function Label({ children }) {
  return <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 1, color: "#444", marginBottom: 7, textTransform: "uppercase" }}>{children}</div>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // Load saved state from localStorage on init
  const [flyers, setFlyers] = useState(() => {
    try {
      const saved = localStorage.getItem("thepages_flyers");
      return saved ? JSON.parse(saved) : INITIAL_FLYERS;
    } catch { return INITIAL_FLYERS; }
  });
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("thepages_profile");
      return saved ? JSON.parse(saved) : MY_PROFILE;
    } catch { return MY_PROFILE; }
  });
  const [tab, setTab] = useState("feed");       // feed | saved | profile
  const [showSearch, setShowSearch] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [browseQuery, setBrowseQuery] = useState("");
  const [showBrowseFilter, setShowBrowseFilter] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuFlyer, setMenuFlyer] = useState(null);     // flyer for action menu
  const [reportPostId, setReportPostId] = useState(null); // post being reported
  const [editFlyer, setEditFlyer] = useState(null);      // flyer being edited

  // Persist flyers to localStorage whenever they change
  const updateFlyers = useCallback((updater) => {
    setFlyers(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("thepages_flyers", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Persist profile
  const updateProfile = useCallback((newProfile) => {
    setProfile(newProfile);
    try { localStorage.setItem("thepages_profile", JSON.stringify(newProfile)); } catch {}
  }, []);

  const handleSave = useCallback((id) => {
    updateFlyers(prev => prev.map(f => f.id === id ? { ...f, saved: !f.saved } : f));
  }, [updateFlyers]);

  const handlePost = useCallback((data) => {
    const flyerId = Date.now();
    const newFlyer = {
      id: flyerId,
      groupId: `g_${flyerId}`,
      user: profile.name,
      handle: profile.handle,
      avatar: profile.avatar,
      avatarColor: profile.avatarColor,
      time: "just now",
      title: data.title,
      subtitle: data.subtitle,
      description: data.description || "",
      caption: data.description || "",
      location: data.location || "Location TBD",
      date: data.date || "TBA",
      eventUrl: data.eventUrl || "",
      bgColor: data.bgColor,
      accentColor: data.accentColor,
      textColor: data.textColor,
      tags: data.tags && data.tags.length > 0 ? data.tags : [`#${data.category.toLowerCase()}`],
      saved: false,
      category: data.category,
      pattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
      isPublic: data.isPublic,
      isMine: true,
      imagePreview: data.imagePreview || null,
      saveCount: 0,
      shareCount: 0,
    };
    updateFlyers(prev => [newFlyer, ...prev]);
    setTab("feed");
  }, [profile, updateFlyers]);

  const handleRefresh = useCallback(() => {
    updateFlyers(prev => [...prev].sort(() => Math.random() - 0.5));
    setRefreshKey(k => k + 1);
    setTab("feed");
    setActiveCategory("All");
  }, [updateFlyers]);

  const handleDelete = useCallback((id) => {
    if (window.confirm("Delete this post? This can't be undone.")) {
      updateFlyers(prev => prev.filter(f => f.id !== id));
    }
  }, [updateFlyers]);

  const handleReport = useCallback((reason) => {
    if (reportPostId) {
      alert(`Post reported for: ${reason}. Thank you for keeping the community safe.`);
      setReportPostId(null);
    }
  }, [reportPostId]);

  const handleGoToProfile = useCallback((who) => {
    // For now, always go to own profile (in full app, would navigate to other user's profile)
    setTab("profile");
  }, []);

  const filteredFlyers = flyers.filter(f => {
    if (tab === "saved") return f.saved;
    if (!f.isPublic && !f.isMine) return false;
    // On the feed, hide past events (they go to Past Flyers in profiles)
    if (tab === "feed" && isEventPast(f.date)) return false;
    if (activeCategory !== "All" && f.category !== activeCategory) return false;
    // Browse text filter
    if (browseQuery) {
      const q = browseQuery.toLowerCase();
      const match = [f.title, f.location, f.subtitle, f.description, ...(f.tags || [])].some(
        s => s && s.toLowerCase().includes(q)
      );
      if (!match) return false;
    }
    return true;
  });

  // Build grouped feed: one entry per event group, hero = highest engagement
  const groups = groupFlyers(filteredFlyers);
  const seenGroups = new Set();
  const feedFlyers = [];
  filteredFlyers.forEach(f => {
    if (!f.groupId || seenGroups.has(f.groupId)) return;
    seenGroups.add(f.groupId);
    const groupPosts = groups[f.groupId] || [f];
    feedFlyers.push({ hero: groupPosts[0], groupPosts });
  });

  // Sort feed chronologically: soonest events first, then furthest out
  feedFlyers.sort((a, b) => {
    const dateA = parseEventDate(a.hero.date);
    const dateB = parseEventDate(b.hero.date);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB;
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500;600&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #000; }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes bounce { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(6px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes detailsSlideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes detailsImageShrink { from { max-height: 100%; } to { max-height: 35%; } }
        ::-webkit-scrollbar { display: none; }
        input::placeholder, textarea::placeholder { color: #2e2e2e; }
      `}</style>

      <div style={{
        maxWidth: 480, margin: "0 auto",
        height: "100svh", display: "flex", flexDirection: "column",
        background: "#0a0a0a",
      }}>
        {/* Floating wordmark (only on feed/saved) */}
        {tab !== "profile" && (
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            zIndex: 10, pointerEvents: "none",
          }}>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 18, fontWeight: 900, letterSpacing: 3,
              color: "#fff", textTransform: "uppercase",
              textShadow: "0 2px 20px rgba(0,0,0,0.8)",
              opacity: 0.9,
            }}>THE PAGES</span>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflowY: tab === "profile" ? "auto" : "hidden", display: "flex", flexDirection: "column" }}>
          {tab === "profile" ? (
            <ProfilePage flyers={flyers} profile={profile} onProfileChange={updateProfile} onSave={handleSave} />
          ) : (
            <>
            {/* Browse filter bar — shows when filtering by category, hashtag, or text */}
            {(activeCategory !== "All" || browseQuery) && (
              <div style={{
                position: "absolute", top: 40, left: 0, right: 0, zIndex: 15,
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 14px",
                background: "rgba(14,14,14,0.92)", backdropFilter: "blur(8px)",
                borderBottom: "1px solid #1a1a1a",
              }}>
                {activeCategory !== "All" && (
                  <span style={{
                    background: "#E63946", color: "#fff",
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
                    padding: "4px 10px", borderRadius: 3, letterSpacing: 0.5,
                  }}>{activeCategory}</span>
                )}
                {browseQuery && (
                  <span style={{
                    background: "#222", color: "#aaa",
                    fontFamily: "'DM Mono', monospace", fontSize: 11,
                    padding: "4px 10px", borderRadius: 3, letterSpacing: 0.5,
                  }}>"{browseQuery}"</span>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={() => { setActiveCategory("All"); setBrowseQuery(""); setShowBrowseFilter(false); }} style={{
                  background: "transparent", border: "1.5px solid #E63946", color: "#E63946",
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
                  padding: "4px 12px", cursor: "pointer", letterSpacing: 1, borderRadius: 3,
                }}>CLEAR</button>
              </div>
            )}

            <div
              key={refreshKey}
              style={{
                flex: 1,
                overflowY: "scroll",
                scrollSnapType: "y mandatory",
                scrollBehavior: "smooth",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {feedFlyers.length === 0 ? (
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 14,
                  minHeight: "calc(100svh - 62px)", color: "#222",
                }}>
                  <div style={{ fontSize: 48 }}>📋</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, letterSpacing: 2, color: "#333" }}>
                    {tab === "saved" ? "NO SAVED PAGES YET" : "NO PAGES FOUND"}
                  </div>
                </div>
              ) : (
                feedFlyers.map((entry, i) => (
                  <FullscreenFlyer
                    key={entry.hero.id}
                    flyer={entry.hero}
                    groupPosts={entry.groupPosts}
                    onSave={handleSave}
                    onShare={(groupId) => alert(`Shared event group link for: ${entry.hero.title}`)}
                    isLast={i === feedFlyers.length - 1}
                    onMenuOpen={setMenuFlyer}
                    onGoToProfile={handleGoToProfile}
                    onFilterCategory={(cat) => { setActiveCategory(cat); setRefreshKey(k => k + 1); }}
                    onFilterTag={(tag) => { setBrowseQuery(tag); setRefreshKey(k => k + 1); }}
                  />
                ))
              )}
            </div>
            </>
          )}
        </div>

        {/* Bottom nav */}
        <div style={{
          height: 62, background: "#0e0e0e",
          borderTop: "1px solid #1a1a1a",
          display: "flex", alignItems: "stretch",
          flexShrink: 0, zIndex: 10,
        }}>
          <NavBtn icon="🔍" label="Search" onClick={() => setShowSearch(true)} />
          <NavBtn icon="★" label="Saved" onClick={() => setTab(t => t === "saved" ? "feed" : "saved")} active={tab === "saved"} />

          {/* Post button */}
          <button onClick={() => setShowPost(true)} style={{
            flex: 1, border: "none", background: "#E63946",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer", gap: 3,
            borderLeft: "1px solid #c41f2e", borderRight: "1px solid #c41f2e",
            transition: "background 0.15s",
          }}>
            <span style={{ fontSize: 22, color: "#fff", lineHeight: 1, fontWeight: 300 }}>＋</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Post</span>
          </button>

          <NavBtn icon="↻" label="Shuffle" onClick={handleRefresh} />
          <NavBtn icon="◉" label="Profile" onClick={() => setTab(t => t === "profile" ? "feed" : "profile")} active={tab === "profile"} />
        </div>
      </div>

      {showSearch && (
        <SearchOverlay
          flyers={flyers}
          onClose={() => setShowSearch(false)}
          onSave={handleSave}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          onBrowseFilter={(q) => { setBrowseQuery(q); setTab("feed"); }}
        />
      )}
      {showPost && (
        <PostModal onClose={() => setShowPost(false)} onPost={handlePost} userLocation={profile.location} />
      )}
      {menuFlyer && (
        <PostActionMenu
          flyer={menuFlyer}
          onClose={() => setMenuFlyer(null)}
          onEdit={(f) => { /* TODO: open edit modal */ alert("Edit coming soon — for now, delete and re-post."); }}
          onDelete={handleDelete}
          onReport={(id) => setReportPostId(id)}
          onDispute={(id) => alert(`Dispute submitted for post. At 5+ disputes from different users, this post will be un-grouped from the event carousel.`)}
        />
      )}
      {reportPostId && (
        <ReportConfirm
          onClose={() => setReportPostId(null)}
          onSubmit={handleReport}
        />
      )}
    </>
  );
}
