import { useState, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["All", "Arts", "Community", "Wellness", "Volunteer", "Food"];
const PATTERNS = ["stripes", "dots", "grid", "zigzag", "circles"];
const COLOR_PRESETS = [
  { bg: "#1a1a2e", accent: "#EB736C" },
  { bg: "#d8f3dc", accent: "#2d6a4f" },
  { bg: "#ff6b6b", accent: "#ffd93d" },
  { bg: "#003566", accent: "#ffd166" },
  { bg: "#10002b", accent: "#c77dff" },
  { bg: "#fff8f0", accent: "#ff6b35" },
  { bg: "#0d1b2a", accent: "#00b4d8" },
  { bg: "#1a0a00", accent: "#fb8500" },
];
const LIGHT_BGS = ["#d8f3dc", "#ff6b6b", "#fff8f0", "#f5f0e8"];

const MY_PROFILE = {
  name: "Jordan Lee",
  handle: "@jordanlee",
  avatar: "JL",
  avatarColor: "#EB736C",
  bio: "Community organizer · lover of local events · always finding the next good thing nearby 🗓️",
  isPublic: true,
  location: "Brooklyn, NY",
};

const INITIAL_FLYERS = [
  { id: 1, user: "Riverside Arts Collective", handle: "@riversidearts", avatar: "RA", avatarColor: "#EB736C", time: "2h ago", title: "OPEN MIC NIGHT", subtitle: "Every Friday • 8PM", description: "Bring your voice, your instrument, your poetry. All are welcome at the warehouse.", location: "The Warehouse, 412 Commerce St", date: "FRI MAR 14", bgColor: "#1a1a2e", accentColor: "#EB736C", textColor: "#ffffff", tags: ["#music", "#arts", "#community"], saved: false, category: "Arts", pattern: "stripes", isPublic: true, isMine: false },
  { id: 2, user: "Green Thumb Society", handle: "@greenthumb", avatar: "GT", avatarColor: "#2d6a4f", time: "5h ago", title: "SEED SWAP & PLANT FAIR", subtitle: "Bring seeds, take seeds!", description: "Swap seeds, share cuttings, and meet your fellow gardeners. Free entry. Bring bags.", location: "Millbrook Community Garden", date: "SAT MAR 15", bgColor: "#d8f3dc", accentColor: "#2d6a4f", textColor: "#1b1b1b", tags: ["#garden", "#sustainability", "#free"], saved: false, category: "Community", pattern: "dots", isPublic: true, isMine: false },
  { id: 3, user: "Luna Yoga Studio", handle: "@lunayoga", avatar: "LY", avatarColor: "#7b2d8b", time: "8h ago", title: "ROOFTOP SUNRISE YOGA", subtitle: "Free community class", description: "Start your Sunday right. All levels welcome. Mats provided. Limited to 30 spots.", location: "The Mercer Building Rooftop", date: "SUN MAR 16 • 6:30AM", bgColor: "#ff6b6b", accentColor: "#ffd93d", textColor: "#1a1a1a", tags: ["#yoga", "#wellness", "#sunrise"], saved: true, category: "Wellness", pattern: "grid", isPublic: true, isMine: false },
  { id: 4, user: "Block by Block", handle: "@blockbyblock", avatar: "BB", avatarColor: "#003566", time: "1d ago", title: "NEIGHBORHOOD CLEANUP", subtitle: "Let's make it shine", description: "Gloves and bags provided. Lunch will be served after. Kids welcome!", location: "Corner of Oak & 5th", date: "SAT MAR 22 • 9AM", bgColor: "#003566", accentColor: "#ffd166", textColor: "#ffffff", tags: ["#volunteer", "#neighborhood"], saved: false, category: "Volunteer", pattern: "zigzag", isPublic: true, isMine: false },
  { id: 5, user: "Eastside Eats", handle: "@eastsideeats", avatar: "EE", avatarColor: "#c77dff", time: "1d ago", title: "NIGHT MARKET", subtitle: "40+ local vendors", description: "Street food, handmade goods, live music. Every last Saturday of the month.", location: "East Market Plaza", date: "SAT MAR 29 • 5–11PM", bgColor: "#10002b", accentColor: "#c77dff", textColor: "#ffffff", tags: ["#food", "#market", "#nightlife"], saved: true, category: "Food", pattern: "circles", isPublic: true, isMine: false },
];

// ─── Utility ──────────────────────────────────────────────────────────────────
function isLight(bg) { return LIGHT_BGS.includes(bg); }
function textFor(bg) { return isLight(bg) ? "#1a1a1a" : "#ffffff"; }

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

// ─── Fullscreen Flyer Card ────────────────────────────────────────────────────
function FullscreenFlyer({ flyer, onSave, isLast }) {
  const light = isLight(flyer.bgColor);
  return (
    <div style={{
      position: "relative", width: "100%", height: "calc(100svh - 62px)",
      background: flyer.bgColor, display: "flex", flexDirection: "column",
      overflow: "hidden", scrollSnapAlign: "start", scrollSnapStop: "always", flexShrink: 0,
    }}>
      <PatternBg pattern={flyer.pattern} color={flyer.accentColor} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: flyer.accentColor, zIndex: 2 }} />

      {/* Private badge */}
      {!flyer.isPublic && (
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
        position: "relative", zIndex: 1,
      }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{
            background: flyer.accentColor, color: light ? "#111" : "#fff",
            fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
            padding: "5px 13px", letterSpacing: 2, textTransform: "uppercase",
            border: `2px solid ${flyer.textColor}`,
          }}>{flyer.category}</div>
          <button onClick={() => onSave(flyer.id)} style={{
            background: flyer.saved ? flyer.accentColor : "rgba(128,128,128,0.2)",
            border: `2px solid ${flyer.saved ? flyer.accentColor : flyer.textColor}`,
            color: flyer.saved ? (light ? "#111" : "#fff") : flyer.textColor,
            width: 42, height: 42, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 18, transition: "all 0.2s",
            backdropFilter: "blur(4px)",
          }}>{flyer.saved ? "★" : "☆"}</button>
        </div>

        {/* Title */}
        <div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "clamp(52px, 13vw, 84px)", fontWeight: 900,
            lineHeight: 0.88, color: flyer.textColor, textTransform: "uppercase",
            letterSpacing: -2, textShadow: !light ? "3px 3px 0 rgba(0,0,0,0.18)" : "none",
          }}>{flyer.title}</div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 21,
            fontWeight: 600, letterSpacing: 2, color: flyer.accentColor,
            marginTop: 14, textTransform: "uppercase",
          }}>{flyer.subtitle}</div>
          {flyer.description && (
            <p style={{
              fontFamily: "'Barlow', sans-serif", fontSize: 15, lineHeight: 1.6,
              color: flyer.textColor, opacity: 0.72, marginTop: 18, maxWidth: 360,
            }}>{flyer.description}</p>
          )}
        </div>

        {/* Footer */}
        <div>
          <div style={{ height: 1, background: flyer.textColor, opacity: 0.12, marginBottom: 18 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12 }}>📍</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: flyer.textColor, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>{flyer.location}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(flyer.tags || []).map(t => (
                  <span key={t} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: flyer.textColor, opacity: 0.38 }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{
              border: `2px solid ${flyer.accentColor}`, color: flyer.accentColor,
              fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
              padding: "7px 13px", letterSpacing: 1.5, textTransform: "uppercase",
            }}>{flyer.date}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", background: flyer.avatarColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, color: "#fff",
              border: `1.5px solid ${flyer.textColor}`, opacity: 0.85, flexShrink: 0,
            }}>{flyer.avatar}</div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: flyer.textColor, opacity: 0.45 }}>{flyer.handle} · {flyer.time}</span>
          </div>
        </div>
      </div>

      {!isLast && (
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          opacity: 0.22, zIndex: 2, animation: "bounce 2s infinite", pointerEvents: "none",
        }}>
          <div style={{ width: 1, height: 18, background: flyer.textColor }} />
          <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: `5px solid ${flyer.textColor}` }} />
        </div>
      )}
    </div>
  );
}

// ─── AI Scan + Post Modal ─────────────────────────────────────────────────────
function PostModal({ onClose, onPost }) {
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
  const [bg, setBg] = useState("#1a1a2e");
  const [accent, setAccent] = useState("#EB736C");

  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      setImageData({ base64, mediaType });
      setStep("scanning");
      setScanError("");
      await scanWithAI(base64, mediaType);
    };
    reader.readAsDataURL(file);
  };

  const scanWithAI = async (base64, mediaType) => {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
                text: `You are reading a community event flyer or poster image. Extract all the key information and return ONLY a valid JSON object with no markdown, no backticks, no extra text. Use these exact keys:
{
  "title": "MAIN EVENT NAME in all caps",
  "subtitle": "Short tagline or time info",
  "description": "Brief event description, 1-2 sentences",
  "location": "Venue name and/or address",
  "date": "Date and time, abbreviated like SAT APR 5 • 7PM",
  "category": "One of: Arts, Community, Wellness, Volunteer, Food",
  "tags": ["#tag1", "#tag2"]
}
If a field is not visible, use an empty string. Return JSON only.`
              }
            ]
          }]
        })
      });
      const data = await res.json();
      const raw = data.content?.find(b => b.type === "text")?.text || "{}";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setTitle(parsed.title || "");
      setSubtitle(parsed.subtitle || "");
      setDescription(parsed.description || "");
      setLocation(parsed.location || "");
      setDate(parsed.date || "");
      if (parsed.category && CATEGORIES.includes(parsed.category)) setCategory(parsed.category);
      setStep("form");
    } catch (err) {
      setScanError("Couldn't read the flyer. Fill in details manually.");
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
        borderTop: "3px solid #EB736C",
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
                background: "#EB736C", color: "#fff",
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
                  border: bg === p.bg ? "3px solid #EB736C" : "2px solid #222",
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
                  border: `1.5px solid ${category === c ? "#EB736C" : "#2a2a2a"}`,
                  background: category === c ? "#EB736C" : "transparent",
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
                  border: `1.5px solid ${isPublic === opt.val ? (opt.val ? "#4ade80" : "#EB736C") : "#222"}`,
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
                onPost({ title, subtitle, description, location, date, category, bgColor: bg, accentColor: accent, textColor, isPublic, imagePreview });
                onClose();
              }}
              style={{
                width: "100%", background: canPost ? "#EB736C" : "#1a1a1a",
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

// ─── Search Overlay ───────────────────────────────────────────────────────────
function SearchOverlay({ flyers, onClose, onSave, activeCategory, setActiveCategory }) {
  const [q, setQ] = useState("");
  const results = flyers.filter(f =>
    f.isPublic &&
    (activeCategory === "All" || f.category === activeCategory) &&
    (!q || [f.title, f.location, f.user, ...(f.tags || [])].some(s => s.toLowerCase().includes(q.toLowerCase())))
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0e0e0e", zIndex: 200, display: "flex", flexDirection: "column", animation: "slideUp 0.2s ease" }}>
      <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search pages, places, tags..." style={{
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
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{
              flexShrink: 0, border: `1.5px solid ${activeCategory === cat ? "#EB736C" : "#222"}`,
              background: activeCategory === cat ? "#EB736C" : "transparent",
              color: activeCategory === cat ? "#fff" : "#555",
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700,
              padding: "4px 12px", cursor: "pointer", letterSpacing: 0.5, transition: "all 0.15s",
              borderRadius: 3,
            }}>{cat}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: "#333" }}>No pages found</div>
        ) : results.map(f => (
          <div key={f.id} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #141414" }}>
            <div style={{ width: 70, flexShrink: 0, background: f.bgColor, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
              <PatternBg pattern={f.pattern} color={f.accentColor} />
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 900, color: f.accentColor, textAlign: "center", padding: "0 6px", zIndex: 1, textTransform: "uppercase", lineHeight: 1.1 }}>
                {f.title.split(" ").slice(0, 2).join(" ")}
              </div>
            </div>
            <div style={{ flex: 1, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.3, lineHeight: 1 }}>{f.title}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: "#555", marginTop: 2 }}>{f.subtitle}</div>
                </div>
                <button onClick={() => onSave(f.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: f.saved ? "#f59e0b" : "#2a2a2a", transition: "color 0.15s", paddingLeft: 8 }}>★</button>
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#333", marginTop: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>{f.date} · {f.location}</div>
            </div>
          </div>
        ))}
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
  const shown = myFlyers.filter(f => activeTab === "public" ? f.isPublic : !f.isPublic);

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
            border: "3px solid #EB736C",
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
            border: `1.5px solid ${profile.isPublic ? "#4ade80" : "#EB736C"}`,
            color: profile.isPublic ? "#4ade80" : "#EB736C",
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
              <button onClick={save} style={{ background: "#EB736C", border: "none", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, padding: "6px 14px", cursor: "pointer", letterSpacing: 1, borderRadius: 3 }}>SAVE</button>
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
        {[["public", "🌍 Public"], ["private", "🔒 Private"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            flex: 1, padding: "12px 0", background: "none", border: "none",
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800,
            letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
            color: activeTab === id ? "#fff" : "#333",
            borderBottom: activeTab === id ? "2px solid #EB736C" : "2px solid transparent",
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
  const [flyers, setFlyers] = useState(INITIAL_FLYERS);
  const [profile, setProfile] = useState(MY_PROFILE);
  const [tab, setTab] = useState("feed");       // feed | saved | profile
  const [showSearch, setShowSearch] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSave = useCallback((id) => {
    setFlyers(prev => prev.map(f => f.id === id ? { ...f, saved: !f.saved } : f));
  }, []);

  const handlePost = useCallback((data) => {
    const newFlyer = {
      id: Date.now(),
      user: profile.name,
      handle: profile.handle,
      avatar: profile.avatar,
      avatarColor: profile.avatarColor,
      time: "just now",
      title: data.title,
      subtitle: data.subtitle,
      description: data.description || "",
      location: data.location || "Location TBD",
      date: data.date || "TBA",
      bgColor: data.bgColor,
      accentColor: data.accentColor,
      textColor: data.textColor,
      tags: [`#${data.category.toLowerCase()}`],
      saved: false,
      category: data.category,
      pattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
      isPublic: data.isPublic,
      isMine: true,
      imagePreview: data.imagePreview || null,
    };
    setFlyers(prev => [newFlyer, ...prev]);
    setTab("feed");
  }, [profile]);

  const handleRefresh = useCallback(() => {
    setFlyers(prev => [...prev].sort(() => Math.random() - 0.5));
    setRefreshKey(k => k + 1);
    setTab("feed");
    setActiveCategory("All");
  }, []);

  const feedFlyers = flyers.filter(f => {
    if (tab === "saved") return f.saved;
    if (!f.isPublic && !f.isMine) return false;
    if (activeCategory !== "All") return f.category === activeCategory;
    return true;
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
            <ProfilePage flyers={flyers} profile={profile} onProfileChange={setProfile} onSave={handleSave} />
          ) : (
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
                feedFlyers.map((f, i) => (
                  <FullscreenFlyer key={f.id} flyer={f} onSave={handleSave} isLast={i === feedFlyers.length - 1} />
                ))
              )}
            </div>
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
            flex: 1, border: "none", background: "#EB736C",
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
        />
      )}
      {showPost && (
        <PostModal onClose={() => setShowPost(false)} onPost={handlePost} />
      )}
    </>
  );
}
