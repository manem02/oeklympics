import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, remove } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import './App.css';

// ============================================
// FIREBASE CONFIG
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyBOv2UDlwB0oqvkvj-6EivkkfeO11ZNNHQ",
  authDomain: "oeklympics.firebaseapp.com",
  databaseURL: "https://oeklympics-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "oeklympics",
  storageBucket: "oeklympics.firebasestorage.app",
  messagingSenderId: "323608790037",
  appId: "1:323608790037:web:0a52e846e23e6349f23a1c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// ============================================
// ASSET PATHS (files live in the public/ folder)
// ============================================
const HERO_IMG = `${process.env.PUBLIC_URL}/hero.jpg`;
const LOGO_IMG = `${process.env.PUBLIC_URL}/oek_logo_white.png`;

// ============================================
// DATA
// Each event/team has a stable `id` (DB key) and a display `name`.
// Renaming later won't break stored scores.
// ============================================
const TEAMS = [
  { id: 'eg', name: 'EG' },
  { id: 'stock1', name: '1. Stock' },
  { id: 'stock2', name: '2. Stock' },
  { id: 'stock3', name: '3. Stock' },
  { id: 'stock4', name: '4. Stock' }
];

const EVENTS = [
  { id: 'e01', name: 'Schach' },
  { id: 'e02', name: 'Tabu' },
  { id: 'e03', name: 'Sudoku' },
  { id: 'e04', name: 'FIFA' },
  { id: 'e05', name: 'Mario Kart' },
  { id: 'e06', name: 'Ping Pong' },
  { id: 'e07', name: 'Darts' },
  { id: 'e08', name: 'Kicker' },
  { id: 'e09', name: 'Treppen Bier' },
  { id: 'e10', name: 'Flanky Ball' },
  { id: 'e11', name: 'Slippery Bags' },
  { id: 'e12', name: 'Tug War' },
  { id: 'e13', name: 'Volleyball' },
  { id: 'e14', name: 'Spike Ball' },
  { id: 'e15', name: 'Beerpong' },
  { id: 'e16', name: 'Most Hair Cutting' },
  { id: 'e17', name: 'Videos with Quests' },
  { id: 'e18', name: '100m Sprint' },
  { id: 'e19', name: 'Karaoke' },
  { id: 'e20', name: 'Hot Dog Eating Contest' },
  { id: 'e21', name: 'Drawing of Johanna' },
  { id: 'e22', name: 'Questions About Johanna' },
  { id: 'e23', name: 'Trivia' }
];

// ============================================
// FLOOR PASSWORDS for the live comment feed.
// Each password maps to the floor name shown on the comment.
// Change these strings any time — they're the only place passwords live.
// NOTE: these are visible in the app's code to anyone who inspects it.
// That's fine for a fun dorm feed; it just keeps out casual randoms.
// ============================================
const FLOOR_PASSWORDS = {
  'oekheim-helden': 'EG',
  'oekheim-legenden': '1. Stock',
  'oekheim-champions': '2. Stock',
  'oekheim-sieger': '3. Stock',
  'oekheim-gladiatoren': '4. Stock'
};

// ============================================
// SCROLL REVEAL HOOK
// Adds class "in" when an element scrolls into view.
// ============================================
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reveal = () => el.classList.add('in');
    const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              reveal();
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -10% 0px' }
    );
    obs.observe(el);
    // Fallback: if the observer hasn't fired within 1.2s (can happen on some
    // mobile browsers with fixed layers), reveal anyway so content never stays hidden.
    const fallback = setTimeout(reveal, 1200);
    return () => {
      obs.disconnect();
      clearTimeout(fallback);
    };
  }, []);
  return ref;
}

function Reveal({ children, className = '' }) {
  const ref = useReveal();
  return (
      <div ref={ref} className={`reveal ${className}`}>
        {children}
      </div>
  );
}

// ============================================
// LIVE COMMENT FEED (public, floor-password gated)
// ============================================
function CommentFeed({ comments, isAdmin }) {
  // "Remember me" — prefill from the last time this person posted (stored on
  // their own device). Wrapped in try/catch so a browser that blocks storage
  // (private mode, etc.) just falls back to empty fields instead of crashing.
  const readStored = (key) => {
    try { return window.localStorage.getItem(key) || ''; } catch { return ''; }
  };

  const [name, setName] = useState(() => readStored('oek_name'));
  const [text, setText] = useState('');
  const [pass, setPass] = useState(() => readStored('oek_pass'));
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);

  // newest first
  const list = Object.entries(comments || {})
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const handlePost = async (e) => {
    e.preventDefault();
    setError('');
    const floor = FLOOR_PASSWORDS[pass.trim()];
    if (!floor) {
      setError('Incorrect floor password.');
      return;
    }
    if (!text.trim()) {
      setError('Write a message first.');
      return;
    }
    setPosting(true);
    try {
      await push(ref(database, 'comments'), {
        name: name.trim().slice(0, 30) || 'Anonymous',
        floor,
        text: text.trim().slice(0, 240),
        ts: Date.now()
      });
      // Remember name + floor password on this device for next time.
      try {
        window.localStorage.setItem('oek_name', name.trim());
        window.localStorage.setItem('oek_pass', pass.trim());
      } catch { /* storage blocked — ignore, posting still worked */ }
      setText('');
      // keep name + password in the fields so they can post again easily
    } catch (err) {
      setError('Could not post. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await remove(ref(database, `comments/${id}`));
    } catch (err) {
      alert('Could not delete comment.');
    }
  };

  // Whether we currently have a remembered, valid floor password.
  const rememberedFloor = FLOOR_PASSWORDS[pass.trim()];
  const clearRemembered = () => {
    try {
      window.localStorage.removeItem('oek_name');
      window.localStorage.removeItem('oek_pass');
    } catch { /* ignore */ }
    setName('');
    setPass('');
  };

  const timeAgo = (ts) => {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
      <div className="comment-feed">
        <h2 className="section-title">Live Commentary</h2>

        <form className="comment-form glass" onSubmit={handlePost}>
          {rememberedFloor && name.trim() && (
              <div className="posting-as">
                Posting as <strong>{name.trim()}</strong> · {rememberedFloor}
                <button type="button" className="posting-as-clear" onClick={clearRemembered}>
                  Not you?
                </button>
              </div>
          )}
          <div className="comment-form-row">
            <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
            />
            <input
                type="password"
                placeholder="Floor password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
            />
          </div>
          <textarea
              placeholder="Say something… (e.g. EG is on fire 🔥)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={240}
              rows={2}
          />
          <div className="comment-form-bottom">
            <span className="char-count">{text.length}/240</span>
            <button type="submit" disabled={posting}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
          {error && <div className="comment-error">{error}</div>}
        </form>

        <div className="comment-list">
          {list.length === 0 && (
              <div className="comment-empty">No comments yet — be the first!</div>
          )}
          {list.map((c) => (
              <div key={c.id} className="comment glass">
                <div className="comment-head">
                  <span className="comment-author">{c.name}</span>
                  <span className="comment-floor">{c.floor}</span>
                  <span className="comment-time">{timeAgo(c.ts)}</span>
                  {isAdmin && (
                      <button className="comment-del" onClick={() => handleDelete(c.id)} title="Delete">
                        ✕
                      </button>
                  )}
                </div>
                <div className="comment-text">{c.text}</div>
              </div>
          ))}
        </div>
      </div>
  );
}

// ============================================
// LEADERBOARD VIEW (PUBLIC)
// ============================================
function Leaderboard({ scores, comments, isAdmin }) {
  const rankedTeams = TEAMS
      .map((team) => {
        let total = 0;
        EVENTS.forEach((event) => {
          total += scores?.[event.id]?.[team.id] || 0;
        });
        return { ...team, total };
      })
      .sort((a, b) => b.total - a.total);

  const leader = rankedTeams[0];

  // Scroll-driven fade: the photo holds through the rankings, then dissolves
  // into the Sunrise gradient as the event-breakdown section comes into view.
  const eventsRef = useRef(null);
  const [fade, setFade] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = eventsRef.current;
      const vh = window.innerHeight || 1;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // Begin fading when the events section is one screen away (top === vh),
      // finish when its top reaches ~30% down the screen.
      const start = vh;        // fade = 0
      const end = vh * 0.3;    // fade = 1
      const f = Math.min(1, Math.max(0, (start - top) / (start - end)));
      setFade(f);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // ---- Animated rank changes (FLIP technique) ----
  // Measure each row's offsetTop (position within the list, independent of
  // page scroll). When a row's position changes between renders, play a slide
  // from its old spot to the new one via the Web Animations API. Using
  // offsetTop (not getBoundingClientRect) means scrolling doesn't trigger
  // false movements.
  const rowRefs = useRef({});
  const prevPositions = useRef({});
  useLayoutEffect(() => {
    const next = {};
    Object.keys(rowRefs.current).forEach((id) => {
      const el = rowRefs.current[id];
      if (!el) return;
      const newTop = el.offsetTop;
      next[id] = newTop;
      const oldTop = prevPositions.current[id];
      if (oldTop != null && oldTop !== newTop && typeof el.animate === 'function') {
        const delta = oldTop - newTop;
        el.animate(
            [
              { transform: `translateY(${delta}px)` },
              { transform: 'translateY(0)' }
            ],
            { duration: 1000, easing: 'cubic-bezier(0.16,1,0.3,1)' }
        );
      }
    });
    prevPositions.current = next;
  });

  return (
      <div className="board">
        {/* HERO: fixed photo background lives in CSS via .hero-bg */}
        <section className="hero">
          <div className="hero-bg" style={{ backgroundImage: `url(${HERO_IMG})` }} />
          <div className="hero-shade" />
          {/* Sunrise fade layer — opacity driven by scroll */}
          <div className="hero-fade" style={{ opacity: fade }} />
          <div className="hero-logo" style={{ backgroundImage: `url(${LOGO_IMG})`, opacity: 1 - fade * 0.6 }} aria-label="ÖK logo" />
          <div className="hero-title" style={{ opacity: 1 - fade }}>
            <h1>ÖKLYMPICS</h1>
            <p className="hero-sub">Live Standings</p>
          </div>

          {/* Hero leader card */}
          <div className="hero-leader glass" style={{ opacity: 1 - fade }}>
            <div className="crown">👑</div>
            <div className="leader-info">
              <div className="leader-label">Leading</div>
              <div className="leader-name">{leader ? leader.name : '—'}</div>
            </div>
            <div className="leader-pts">
              {leader ? leader.total : 0}
              <span>pts</span>
            </div>
          </div>

          <div className="scroll-hint" style={{ opacity: 1 - fade }}>Scroll for full standings ↓</div>
        </section>

        {/* CONTENT scrolls over the fixed hero, sits on the Sunrise gradient */}
        <section className="content">
          <Reveal className="rankings-wrap">
            <h2 className="section-title">Full Rankings</h2>
            <div className="ranking-list">
              {rankedTeams.map((entry, idx) => (
                  <div
                      key={entry.id}
                      ref={(el) => { rowRefs.current[entry.id] = el; }}
                      className={`rank-row glass ${idx === 0 ? 'is-leader' : ''}`}
                  >
                    <div className="rk">{idx + 1}</div>
                    <div className="nm">{entry.name}</div>
                    <div className="pts">
                      {entry.total}
                      <span>pts</span>
                    </div>
                  </div>
              ))}
            </div>
          </Reveal>

          <div ref={eventsRef} aria-hidden="true" />
          <Reveal className="events-wrap">
            <h2 className="section-title">Event Breakdown</h2>
            <div className="event-grid">
              {EVENTS.map((event) => (
                  <div key={event.id} className="event-card glass">
                    <h3>{event.name}</h3>
                    <div className="event-scores-inner">
                      {TEAMS.map((team) => (
                          <div key={`${event.id}-${team.id}`} className="event-score">
                            <span className="team-label">{team.name}</span>
                            <span className="points">{scores?.[event.id]?.[team.id] || 0}</span>
                          </div>
                      ))}
                    </div>
                  </div>
              ))}
            </div>
          </Reveal>

          <Reveal className="comments-wrap">
            <CommentFeed comments={comments} isAdmin={isAdmin} />
          </Reveal>
        </section>
      </div>
  );
}

// ============================================
// ADMIN LOGIN
// ============================================
function AdminLogin({ onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="login-container">
        <div className="login-card glass-solid">
          <div className="login-logo" style={{ backgroundImage: `url(${LOGO_IMG})` }} aria-label="ÖK logo" />
          <h1>Admin Panel</h1>
          <p className="login-subtitle">Manage Öklympics Scores</p>

          <form onSubmit={handleLogin}>
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Enter Admin Panel'}
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}

          <button className="link-btn" onClick={onBack}>← Back to scoreboard</button>
        </div>
      </div>
  );
}

// ============================================
// ADMIN DASHBOARD
// ============================================
function AdminDashboard({ user, scores, comments, onLogout }) {
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventScores, setEventScores] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingEvent) {
      const existing = scores?.[editingEvent.id] || {};
      const filled = {};
      TEAMS.forEach((team) => {
        filled[team.id] = existing[team.id] || 0;
      });
      setEventScores(filled);
    }
  }, [editingEvent, scores]);

  const handleScoreChange = (teamId, newScore) => {
    setEventScores((prev) => ({
      ...prev,
      [teamId]: Math.max(0, newScore)
    }));
  };

  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      await set(ref(database, `scores/${editingEvent.id}`), eventScores);
      setEditingEvent(null);
    } catch (err) {
      alert('Error saving scores. Are you still logged in?');
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="admin-container">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <div className="admin-user">
            <span>{user.email}</span>
            <button onClick={onLogout} className="logout-btn">Logout</button>
          </div>
        </div>

        {editingEvent ? (
            <div className="edit-event-panel glass-solid">
              <h2>Editing: {editingEvent.name}</h2>
              <div className="score-inputs">
                {TEAMS.map((team) => (
                    <div key={team.id} className="input-group">
                      <label>{team.name}</label>
                      <input
                          type="number"
                          value={eventScores[team.id] ?? 0}
                          onChange={(e) => handleScoreChange(team.id, parseInt(e.target.value, 10) || 0)}
                          min="0"
                      />
                    </div>
                ))}
              </div>
              <div className="button-group">
                <button onClick={handleSaveEvent} className="save-btn" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditingEvent(null)} className="cancel-btn">Cancel</button>
              </div>
            </div>
        ) : (
            <div className="events-list glass-solid">
              <h2>Select Event to Edit</h2>
              <div className="events-grid">
                {EVENTS.map((event) => (
                    <button key={event.id} onClick={() => setEditingEvent(event)} className="event-button">
                      <div className="event-name">{event.name}</div>
                      <div className="event-status">Edit Scores</div>
                    </button>
                ))}
              </div>
            </div>
        )}

        <CommentModeration comments={comments} />
      </div>
  );
}

// ============================================
// ADMIN COMMENT MODERATION
// ============================================
function CommentModeration({ comments }) {
  const list = Object.entries(comments || {})
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const handleDelete = async (id) => {
    try {
      await remove(ref(database, `comments/${id}`));
    } catch (err) {
      alert('Could not delete comment.');
    }
  };

  return (
      <div className="moderation glass-solid">
        <h2>Comments ({list.length})</h2>
        {list.length === 0 && <p className="mod-empty">No comments yet.</p>}
        <div className="mod-list">
          {list.map((c) => (
              <div key={c.id} className="mod-row">
                <div className="mod-info">
                  <strong>{c.name}</strong> <span className="mod-floor">{c.floor}</span>
                  <div className="mod-text">{c.text}</div>
                </div>
                <button className="mod-del" onClick={() => handleDelete(c.id)}>Delete</button>
              </div>
          ))}
        </div>
      </div>
  );
}

// ============================================
// MAIN APP
// ============================================
export default function OeklympicsApp() {
  const [user, setUser] = useState(null);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const scoresRef = ref(database, 'scores');
    const unsubscribeScores = onValue(
        scoresRef,
        (snapshot) => {
          setScores(snapshot.exists() ? snapshot.val() : {});
        },
        (err) => {
          console.error('Firebase read error:', err);
        }
    );

    const commentsRef = ref(database, 'comments');
    const unsubscribeComments = onValue(
        commentsRef,
        (snapshot) => {
          setComments(snapshot.exists() ? snapshot.val() : {});
        },
        (err) => {
          console.error('Firebase comments read error:', err);
        }
    );

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      unsubscribeScores();
      unsubscribeComments();
      unsubscribeAuth();
    };
  }, []);

  const handleLogout = () => {
    signOut(auth);
    setShowLogin(false);
  };

  if (loading) {
    return <div className="loading">Loading Öklympics...</div>;
  }

  if (user) {
    return (
        <div className="app-wrapper admin-bg">
          <AdminDashboard user={user} scores={scores} comments={comments} onLogout={handleLogout} />
        </div>
    );
  }

  if (showLogin) {
    return (
        <div className="app-wrapper admin-bg">
          <AdminLogin onBack={() => setShowLogin(false)} />
        </div>
    );
  }

  return (
      <div className="app-wrapper">
        <Leaderboard scores={scores} comments={comments} isAdmin={false} />
        <button className="admin-fab" onClick={() => setShowLogin(true)}>
          🔐 Admin
        </button>
      </div>
  );
}