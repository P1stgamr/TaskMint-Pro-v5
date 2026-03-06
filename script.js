/* ============================================================
   TASKMINT PRO v5 — Firebase Realtime Database
   সব device থেকে real-time sync হবে
   ============================================================ */

const SESSION_KEY = 'taskmint_v8_session';
const ADMIN_PIN = 'admin123';

/* ============================================================
   FIREBASE CONFIG — এখানে তোমার Firebase config paste করো
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDZSJfWPLRjxlfceUiUHQQ0JonunLVe2_c",
  authDomain: "taskmint-pro.firebaseapp.com",
  databaseURL: "https://taskmint-pro-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "taskmint-pro",
  storageBucket: "taskmint-pro.firebasestorage.app",
  messagingSenderId: "381437349027",
  appId: "1:381437349027:web:8e6a98be52801423470316",
  measurementId: "G-NZPR4758EE"
};



/* ============================================================
   1. DEFAULT CONFIG (Firebase-এ না থাকলে এটাই use হবে)
   ============================================================ */
const DefaultConfig = {
  referralBonus: 500,
  referralTasksReq: 3,
  minWithdraw: 200,
  maintenanceMode: false,
  adReward: 50,
  adTimer: 10,
  adCode: '<div style="color:#555;text-align:center;padding:20px;">ADMIN: PASTE ADS CODE HERE</div>',
  gameCooldown: 24,
  spinCost: 50,
  scratchCost: 20,
  slotCost: 100,
  withdrawMethods: ['bKash', 'Nagad', 'Rocket', 'DBBL Mobile'],
  coinToBDT: 0.01,
  videoAdEnabled: false,
  videoAdTimer: 5,
  videoAdCode: '',
  viewCoinRate: 0.001,
  monetizationCoins: 1000000,
  viewBDTRate: 0.0001
};

/* ============================================================
   2. FIREBASE DATABASE LAYER
   ============================================================ */
let _db = null;       // Firebase database instance
let _appConfig = {}; // cached config
let _currentUser = null; // cached logged-in user

const FDB = {
  // Initialize Firebase
  init: async () => {
    return new Promise((resolve) => {
      const script1 = document.createElement('script');
      script1.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
      script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';
        script2.onload = () => {
          firebase.initializeApp(FIREBASE_CONFIG);
          _db = firebase.database();
          // Load config
          FDB.getConfig().then(cfg => {
            _appConfig = cfg;
            resolve();
          });
        };
        document.head.appendChild(script2);
      };
      document.head.appendChild(script1);
    });
  },

  // Read once from path
  read: (path) => {
    return _db.ref(path).get().then(snap => snap.exists() ? snap.val() : null);
  },

  // Write to path
  write: (path, data) => {
    return _db.ref(path).set(data);
  },

  // Update specific fields
  update: (path, data) => {
    return _db.ref(path).update(data);
  },

  // Push new item (auto ID)
  push: (path, data) => {
    return _db.ref(path).push(data);
  },

  // Delete path
  remove: (path) => {
    return _db.ref(path).remove();
  },

  // Listen for changes
  listen: (path, callback) => {
    _db.ref(path).on('value', snap => callback(snap.exists() ? snap.val() : null));
  },

  /* --- HIGH-LEVEL HELPERS --- */

  getConfig: async () => {
    const cfg = await FDB.read('config');
    if (!cfg) {
      await FDB.write('config', DefaultConfig);
      return { ...DefaultConfig };
    }
    // fill missing keys
    const merged = { ...DefaultConfig, ...cfg };
    return merged;
  },

  getUser: async (userId) => {
    return FDB.read('users/' + userId);
  },

  getUserByUsername: async (username) => {
    const snap = await _db.ref('users').orderByChild('username').equalTo(username).get();
    if (!snap.exists()) return null;
    const val = snap.val();
    const key = Object.keys(val)[0];
    return { ...val[key], _fbKey: key };
  },

  getUserByMobile: async (mobile) => {
    const snap = await _db.ref('users').orderByChild('mobile').equalTo(mobile).get();
    if (!snap.exists()) return null;
    const val = snap.val();
    const key = Object.keys(val)[0];
    return { ...val[key], _fbKey: key };
  },

  getAllUsers: async () => {
    const data = await FDB.read('users');
    if (!data) return [];
    return Object.entries(data).map(([id, u]) => ({ ...u, id }));
  },

  saveUser: async (user) => {
    const { _fbKey, ...cleanUser } = user;
    await FDB.write('users/' + user.id, cleanUser);
  },

  getVideos: async () => {
    const data = await FDB.read('videos');
    if (!data) return [];
    return Object.entries(data).map(([id, v]) => ({ ...v, id }));
  },

  saveVideo: async (video) => {
    await FDB.write('videos/' + video.id, video);
  },

  deleteVideo: async (videoId) => {
    await FDB.remove('videos/' + videoId);
  },

  getTasks: async () => {
    const data = await FDB.read('tasks');
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return Object.entries(data).map(([id, t]) => ({ ...t, id }));
  },

  getWithdrawals: async () => {
    const data = await FDB.read('withdrawals');
    if (!data) return [];
    return Object.entries(data).map(([id, w]) => ({ ...w, _fbKey: id }));
  },

  saveWithdrawal: async (w) => {
    const key = 'w_' + w.id;
    await FDB.write('withdrawals/' + key, w);
  },

  updateWithdrawal: async (wId, changes) => {
    const data = await FDB.read('withdrawals');
    if (!data) return;
    for (const [key, w] of Object.entries(data)) {
      if (w.id === wId) {
        await FDB.update('withdrawals/' + key, changes);
        return;
      }
    }
  }
};

/* ============================================================
   3. SESSION MANAGER (localStorage শুধু session এর জন্য)
   ============================================================ */
const Session = {
  get: () => JSON.parse(localStorage.getItem(SESSION_KEY)),
  set: (u) => {
    _currentUser = u;
    const { videoData, ...safeUser } = u; // videoData save করবো না session এ
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
  },
  clear: () => {
    _currentUser = null;
    localStorage.removeItem(SESSION_KEY);
  },
  verify: async () => {
    const s = Session.get();
    if (!s) return null;
    const u = await FDB.getUser(s.id);
    if (!u || u.isBanned) { Session.clear(); return null; }
    return { ...u, id: s.id };
  },
  verifySync: () => {
    // synchronous version — returns cached user
    return _currentUser || Session.get();
  }
};

/* ============================================================
   4. LOADING OVERLAY
   ============================================================ */
const Loading = {
  show: (msg) => {
    let el = document.getElementById('globalLoading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'globalLoading';
      el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;';
      el.innerHTML = '<div style="width:45px;height:45px;border:4px solid rgba(255,255,255,0.1);border-top:4px solid #00f2ea;border-radius:50%;animation:spin 0.8s linear infinite;"></div><p style="color:white;font-size:0.9rem;">' + (msg||'Loading...') + '</p>';
      document.body.appendChild(el);
    } else {
      el.querySelector('p').textContent = msg || 'Loading...';
      el.style.display = 'flex';
    }
  },
  hide: () => {
    const el = document.getElementById('globalLoading');
    if (el) el.style.display = 'none';
  }
};

/* ============================================================
   5. ROUTER
   ============================================================ */
const Router = {
  go: (pageId) => {
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    const page = document.getElementById('page-' + pageId);
    if (page) page.classList.remove('hidden');
    const nav = document.getElementById('mainNav');
    if (pageId === 'auth' || pageId === 'admin') {
      nav.classList.add('hidden');
    } else {
      nav.classList.remove('hidden');
    }
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('nav-' + pageId);
    if (navEl) navEl.classList.add('active');
    UI.render();
    window.scrollTo(0, 0);
  },
  init: async () => {
    Loading.show('Connecting to database...');
    await FDB.init();
    Loading.hide();
    const s = Session.get();
    if (s) {
      Loading.show('Logging in...');
      const u = await FDB.getUser(s.id);
      Loading.hide();
      if (u && !u.isBanned) {
        _currentUser = { ...u, id: s.id };
        Session.set(_currentUser);
        Router.go('home');
        return;
      }
      Session.clear();
    }
    Router.go('auth');
  }
};

/* ============================================================
   6. AUTH
   ============================================================ */
const Auth = {
  login: async () => {
    const username = document.getElementById('lUser').value.trim();
    const password = document.getElementById('lPass').value;
    if (!username || !password) return UI.toast('Enter username and password', 'warning');
    Loading.show('Logging in...');
    const cfg = await FDB.getConfig();
    if (cfg.maintenanceMode) { Loading.hide(); return UI.toast('Server under maintenance', 'warning'); }
    const user = await FDB.getUserByUsername(username);
    Loading.hide();
    if (!user) return UI.toast('Invalid username or password', 'error');
    if (user.password !== password) return UI.toast('Invalid username or password', 'error');
    if (user.isBanned) return UI.toast('Your account has been suspended', 'error');
    _currentUser = user;
    Session.set(user);
    Router.go('home');
  },

  register: async () => {
    const u = document.getElementById('rUser').value.trim();
    const m = document.getElementById('rMob').value.trim();
    const p = document.getElementById('rPass').value;
    const ref = document.getElementById('rRef').value.trim().toUpperCase();
    if (!u || !m || !p) return UI.toast('Please fill all required fields', 'warning');
    if (u.length < 3) return UI.toast('Username must be at least 3 characters', 'warning');
    if (m.length < 11) return UI.toast('Enter a valid mobile number (11 digits)', 'warning');
    if (p.length < 6) return UI.toast('Password must be at least 6 characters', 'warning');
    Loading.show('Creating account...');
    const existing = await FDB.getUserByUsername(u);
    if (existing) { Loading.hide(); return UI.toast('Username already taken', 'error'); }
    const existMob = await FDB.getUserByMobile(m);
    if (existMob) { Loading.hide(); return UI.toast('Mobile number already registered', 'error'); }
    const cfg = await FDB.getConfig();
    const newId = 'u_' + Date.now();
    const newUser = {
      id: newId, username: u, mobile: m, password: p,
      avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      balance: 0, coins: 100,
      refCode: 'TM' + Math.floor(1000 + Math.random() * 9000),
      referredBy: ref || null,
      joinedAt: new Date().toISOString(),
      isBanned: false, tasksCompleted: 0, lockedRewards: [],
      lastSpin: 0, lastScratch: 0, lastSlot: 0,
      totalEarned: 0, totalWithdrawn: 0,
      videoHistory: [], subscriptions: []
    };
    if (ref) {
      const referrer = await FDB.getUserByUsername(ref) || await (() => {
        // find by refCode
        return FDB.read('users').then(data => {
          if (!data) return null;
          const entry = Object.entries(data).find(([, uu]) => uu.refCode === ref);
          return entry ? { ...entry[1], id: entry[0] } : null;
        });
      })();
      if (referrer) {
        const locks = referrer.lockedRewards || [];
        locks.push({ sourceId: newId, sourceName: u, amount: cfg.referralBonus, unlocked: false, progress: 0 });
        await FDB.update('users/' + referrer.id, { lockedRewards: locks });
      } else {
        newUser.referredBy = null;
      }
    }
    await FDB.saveUser(newUser);
    Loading.hide();
    _currentUser = newUser;
    Session.set(newUser);
    UI.toast('Welcome to TaskMint Pro! You got 100 free coins!', 'success');
    setTimeout(() => Router.go('home'), 1200);
  },

  logout: () => {
    if (confirm('Are you sure you want to logout?')) {
      Session.clear();
      Router.go('auth');
    }
  },

  adminLogin: () => {
    const pin = document.getElementById('adminPin').value;
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('isAdmin', 'true');
      document.getElementById('admin-gate').classList.add('hidden');
      Router.go('admin');
      Admin.init();
    } else {
      UI.toast('Wrong admin PIN', 'error');
    }
  }
};

/* ============================================================
   7. UI CONTROLLER
   ============================================================ */
const UI = {
  toast: (msg, type) => {
    type = type || 'info';
    const colors = {
      success: 'linear-gradient(90deg,#00d26a,#00a855)',
      error: 'linear-gradient(90deg,#ff4b4b,#cc2222)',
      warning: 'linear-gradient(90deg,#ffd700,#c8930a)',
      info: 'linear-gradient(90deg,#00f2ea,#b026ff)'
    };
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:' + (colors[type]||colors.info) + ';color:white;padding:12px 24px;border-radius:30px;font-weight:bold;z-index:99998;font-size:0.9rem;box-shadow:0 4px 20px rgba(0,0,0,0.4);max-width:90%;text-align:center;transition:opacity 0.3s;';
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity = '0', 2800);
    setTimeout(() => t.remove(), 3200);
  },

  toggleAuth: (mode) => {
    if (mode === 'register') {
      document.getElementById('form-login').classList.add('hidden');
      document.getElementById('form-register').classList.remove('hidden');
    } else {
      document.getElementById('form-login').classList.remove('hidden');
      document.getElementById('form-register').classList.add('hidden');
    }
  },

  render: async () => {
    const u = Session.verifySync();
    if (!u) return;
    const cfg = await FDB.getConfig();
    _appConfig = cfg;
    // Refresh user from Firebase
    const freshUser = await FDB.getUser(u.id);
    if (!freshUser) return;
    _currentUser = { ...freshUser, id: u.id };
    Session.set(_currentUser);
    const fu = _currentUser;
    document.querySelectorAll('.u-name').forEach(e => e.innerText = fu.username);
    document.querySelectorAll('.u-bal').forEach(e => e.innerText = '৳' + (fu.balance||0).toFixed(2));
    document.querySelectorAll('.u-coins').forEach(e => e.innerText = (fu.coins||0).toLocaleString());
    document.querySelectorAll('.u-avatar').forEach(e => e.src = fu.avatar);
    const adBox = document.getElementById('homeAdContainer');
    if (adBox) adBox.innerHTML = cfg.adCode || '';
    const upRew = document.getElementById('uploadRewardDisplay');
    if (upRew) upRew.innerText = cfg.uploadReward || '0.001 coin/view';
    UI.renderTasks(fu, cfg);
    UI.renderReferrals(fu, cfg);
    UI.renderWithdrawals(fu);
    UI.renderWithdrawOptions(cfg);
    Games.initButtons(fu, cfg);
    VideoSystem.renderVideoStats(fu);
  },

  renderTasks: async (u, cfg) => {
    const l = document.getElementById('taskList');
    if (!l) return;
    const tasks = await FDB.getTasks();
    if (!tasks.length) {
      l.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px;">No active tasks right now.</p>'; return;
    }
    l.innerHTML = '';
    tasks.forEach(t => {
      l.innerHTML += '<div class="task-card glass"><img src="' + (t.icon||'https://cdn-icons-png.flaticon.com/512/149/149071.png') + '" class="task-icon" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/149/149071.png\'"><div class="task-info"><b>' + t.title + '</b><span class="coin-badge">+' + t.reward + ' Coins</span></div><button class="btn btn-sm task-btn" onclick="Tasks.start(\'' + (t.link||'#') + '\',' + t.reward + ',\'' + t.id + '\')"><i class="fas fa-play"></i> Start</button></div>';
    });
  },

  renderReferrals: async (u, cfg) => {
    const l = document.getElementById('refList');
    if (!l) return;
    const codeEl = document.getElementById('myRefCode');
    if (codeEl) codeEl.innerText = u.refCode || '...';
    const locks = u.lockedRewards || [];
    const unlocked = locks.filter(r => r.unlocked).length;
    const statsEl = document.getElementById('refStats');
    if (statsEl) statsEl.innerHTML = '<div class="ref-stat"><span>' + locks.length + '</span><small>Total Invites</small></div><div class="ref-stat"><span>' + unlocked + '</span><small>Unlocked</small></div><div class="ref-stat"><span>৳' + (unlocked*(cfg.referralBonus||500)*(cfg.coinToBDT||0.01)).toFixed(0) + '</span><small>Earned</small></div>';
    if (!locks.length) { l.innerHTML = '<p class="empty-msg">No referrals yet. Share your code to earn!</p>'; return; }
    l.innerHTML = '';
    locks.forEach(r => {
      l.innerHTML += '<div class="glass ref-item"><div><b>' + r.sourceName + '</b><small style="color:#aaa;display:block;">Progress: ' + r.progress + '/' + (cfg.referralTasksReq||3) + ' tasks</small><div class="progress-bar"><div style="width:' + Math.min(100,(r.progress/(cfg.referralTasksReq||3))*100) + '%"></div></div></div><span class="' + (r.unlocked?'badge-unlocked':'badge-locked') + '">' + (r.unlocked?'✅ ৳'+r.amount:'🔒 ৳'+r.amount) + '</span></div>';
    });
  },

  renderWithdrawals: async (u) => {
    const l = document.getElementById('withdrawList');
    if (!l) return;
    const all = await FDB.getWithdrawals();
    const myW = all.filter(w => w.userId === u.id).reverse();
    if (!myW.length) { l.innerHTML = '<p class="empty-msg">No withdrawal history yet.</p>'; return; }
    const icons = { bKash: '📱', Nagad: '🟠', Rocket: '🚀', 'DBBL Mobile': '🏦' };
    l.innerHTML = '';
    myW.forEach(w => {
      const sc = w.status==='Approved'?'status-approved':w.status==='Rejected'?'status-rejected':'status-pending';
      l.innerHTML += '<div class="glass withdraw-history-item"><div><b>' + (icons[w.method]||'💸') + ' ' + w.method + '</b><small style="color:#aaa;display:block;">' + w.number + ' • ' + new Date(w.id).toLocaleDateString('en-BD') + '</small></div><div style="text-align:right;"><b style="color:var(--neon-gold);">৳' + w.amt.toFixed(2) + '</b><span class="status-badge ' + sc + '">' + w.status + '</span></div></div>';
    });
  },

  renderWithdrawOptions: (cfg) => {
    const sel = document.getElementById('wMethod');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Method --</option>';
    (cfg.withdrawMethods||['bKash','Nagad','Rocket','DBBL Mobile']).forEach(m => {
      sel.innerHTML += '<option value="' + m + '">' + m + '</option>';
    });
  },

  copyRef: () => {
    const code = document.getElementById('myRefCode').innerText;
    navigator.clipboard.writeText(code).then(() => UI.toast('Referral code copied!','success')).catch(() => {
      const el = document.createElement('textarea'); el.value = code;
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
      UI.toast('Referral code copied!','success');
    });
  },

  shareRef: () => {
    const code = document.getElementById('myRefCode').innerText;
    const msg = 'Join TaskMint Pro and earn money! Use my code: ' + code;
    if (navigator.share) { navigator.share({ title: 'TaskMint Pro', text: msg }); }
    else { navigator.clipboard.writeText(msg); UI.toast('Share message copied!','success'); }
  },

  changeAvatar: async (src) => {
    const u = Session.verifySync();
    if (!u) return;
    await FDB.update('users/' + u.id, { avatar: src });
    UI.toast('Avatar updated!','success');
    UI.render();
  },

  requestWithdraw: async () => {
    const method = document.getElementById('wMethod').value;
    const number = document.getElementById('wNumber').value.trim();
    const amt = parseFloat(document.getElementById('wAmt').value);
    if (!method) return UI.toast('Please select a withdrawal method','warning');
    if (!number || number.length < 11) return UI.toast('Enter a valid mobile number','warning');
    if (isNaN(amt) || amt <= 0) return UI.toast('Enter a valid amount','warning');
    Loading.show('Processing...');
    const u = await FDB.getUser(Session.verifySync().id);
    const cfg = await FDB.getConfig();
    Loading.hide();
    if (amt > (u.balance||0)) return UI.toast('Insufficient balance','error');
    if (amt < cfg.minWithdraw) return UI.toast('Minimum withdrawal: ৳' + cfg.minWithdraw,'warning');
    const allW = await FDB.getWithdrawals();
    if (allW.find(w => w.userId === u.id && w.status === 'Pending')) return UI.toast('You already have a pending request','warning');
    Loading.show('Submitting...');
    const newBal = (u.balance||0) - amt;
    await FDB.update('users/' + u.id, { balance: newBal, totalWithdrawn: (u.totalWithdrawn||0)+amt });
    const wId = Date.now();
    await FDB.saveWithdrawal({ id: wId, userId: u.id, username: u.username, mobile: u.mobile, amt, method, number, status: 'Pending', requestedAt: new Date().toISOString(), processedAt: null });
    Loading.hide();
    document.getElementById('wMethod').value='';
    document.getElementById('wNumber').value='';
    document.getElementById('wAmt').value='';
    UI.toast('Withdrawal request submitted!','success');
    UI.render();
  }
};

/* ============================================================
   8. TASK ENGINE
   ============================================================ */
const Tasks = {
  start: (link, reward, taskId) => {
    if (link && link !== 'undefined' && link !== '#') window.open(link, '_blank');
    const overlay = document.getElementById('taskOverlay');
    const timerEl = document.getElementById('taskTimer');
    overlay.classList.remove('hidden');
    let left = _appConfig.adTimer || 10;
    timerEl.innerText = left;
    const interval = setInterval(() => {
      left--; timerEl.innerText = left;
      if (left <= 0) { clearInterval(interval); overlay.classList.add('hidden'); Tasks.complete(reward); }
    }, 1000);
  },
  complete: async (reward) => {
    const u = Session.verifySync();
    if (!u) return;
    const userData = await FDB.getUser(u.id);
    const cfg = _appConfig;
    const newCoins = (userData.coins||0) + reward;
    const newBal = (userData.balance||0) + (reward * (cfg.coinToBDT||0.01));
    const newTasks = (userData.tasksCompleted||0) + 1;
    const newEarned = (userData.totalEarned||0) + (reward * (cfg.coinToBDT||0.01));
    await FDB.update('users/' + u.id, { coins: newCoins, balance: newBal, tasksCompleted: newTasks, totalEarned: newEarned });
    // referral progress
    if (userData.referredBy) {
      const allUsers = await FDB.getAllUsers();
      const ref = allUsers.find(x => x.refCode === userData.referredBy);
      if (ref) {
        const locks = ref.lockedRewards || [];
        const lock = locks.find(r => r.sourceId === u.id);
        if (lock && !lock.unlocked) {
          lock.progress++;
          if (lock.progress >= (cfg.referralTasksReq||3)) {
            lock.unlocked = true;
            await FDB.update('users/' + ref.id, { balance: (ref.balance||0) + (lock.amount*(cfg.coinToBDT||0.01)), lockedRewards: locks });
          } else {
            await FDB.update('users/' + ref.id, { lockedRewards: locks });
          }
        }
      }
    }
    UI.toast('+' + reward + ' Coins earned!','success');
    UI.render();
  }
};

/* ============================================================
   9. GAMES ENGINE
   ============================================================ */
const Games = {
  formatTime: (ms) => { const h=Math.floor(ms/3600000); const m=Math.floor((ms%3600000)/60000); return h+'h '+m+'m'; },
  checkCd: (last, hours) => { const diff=Date.now()-last; const req=hours*3600000; if(diff<req) return {ok:false,wait:req-diff}; return {ok:true}; },
  initButtons: (u, cfg) => {
    Games.updateBtn('btnSpin', u.lastSpin, cfg.gameCooldown, 'Spin ('+(cfg.spinCost||50)+' Coins)');
    Games.updateBtn('btnSlot', u.lastSlot, cfg.gameCooldown, 'Play ('+(cfg.slotCost||100)+' Coins)');
  },
  updateBtn: (id, last, cd, text) => {
    const el=document.getElementById(id); if(!el) return;
    const st=Games.checkCd(last||0, cd||24);
    if(!st.ok) { el.innerHTML='<i class="fas fa-clock"></i> '+Games.formatTime(st.wait); el.disabled=true; el.style.opacity='0.5'; }
    else { el.innerHTML=text; el.disabled=false; el.style.opacity='1'; }
  },
  playSpin: async () => {
    const u = Session.verifySync(); if (!u) return;
    const userData = await FDB.getUser(u.id);
    const cfg = _appConfig;
    const st = Games.checkCd(userData.lastSpin||0, cfg.gameCooldown||24);
    if (!st.ok) return UI.toast('Cooldown: '+Games.formatTime(st.wait),'warning');
    if ((userData.coins||0) < (cfg.spinCost||50)) return UI.toast('Need '+(cfg.spinCost||50)+' coins to spin','error');
    const w = document.getElementById('wheel');
    const deg = 3600 + Math.floor(Math.random()*3600);
    w.style.transition='transform 4s cubic-bezier(0.17,0.67,0.12,0.99)';
    w.style.transform='rotate('+deg+'deg)';
    document.getElementById('btnSpin').disabled=true;
    const win = Math.floor(Math.random()*150)+10;
    await FDB.update('users/'+u.id, { coins:(userData.coins||0)-(cfg.spinCost||50)+win, lastSpin:Date.now() });
    setTimeout(() => {
      UI.toast('You won '+win+' Coins!','success');
      UI.render();
      setTimeout(() => { w.style.transition='none'; w.style.transform='rotate(0deg)'; },100);
    }, 4200);
  },
  playScratch: async (el) => {
    if (el.dataset.used==='1') return;
    const u = Session.verifySync(); if (!u) return;
    const userData = await FDB.getUser(u.id);
    const cfg = _appConfig;
    const st = Games.checkCd(userData.lastScratch||0, cfg.gameCooldown||24);
    if (!st.ok) return UI.toast('Cooldown: '+Games.formatTime(st.wait),'warning');
    if ((userData.coins||0) < (cfg.scratchCost||20)) return UI.toast('Need '+(cfg.scratchCost||20)+' coins','error');
    const win = Math.floor(Math.random()*60)+5;
    await FDB.update('users/'+u.id, { coins:(userData.coins||0)-(cfg.scratchCost||20)+win, lastScratch:Date.now() });
    el.dataset.used='1';
    el.style.background='linear-gradient(135deg,#1a1a2e,#16213e)';
    el.style.border='2px solid var(--neon-gold)';
    el.innerHTML='<div style="text-align:center;"><h2 style="color:var(--neon-gold);font-size:2rem;">+'+win+'</h2><p style="color:#aaa;">Coins Won!</p></div>';
    UI.toast('Scratch Card: +'+win+' Coins!','success');
    UI.render();
    setTimeout(() => {
      el.dataset.used='0'; el.style.background=''; el.style.border='';
      el.innerHTML='<div style="text-align:center;color:#aaa;"><i class="fas fa-ticket-alt" style="font-size:2rem;"></i><p>Tap to Scratch ('+(cfg.scratchCost||20)+' Coins)</p></div>';
    },3000);
  },
  playSlot: async () => {
    const u = Session.verifySync(); if (!u) return;
    const userData = await FDB.getUser(u.id);
    const cfg = _appConfig;
    const st = Games.checkCd(userData.lastSlot||0, cfg.gameCooldown||24);
    if (!st.ok) return UI.toast('Cooldown: '+Games.formatTime(st.wait),'warning');
    if ((userData.coins||0) < (cfg.slotCost||100)) return UI.toast('Need '+(cfg.slotCost||100)+' coins','error');
    const symbols=['🍋','🍒','💎','7️⃣','🔔','⭐'];
    const r=[0,1,2].map(()=>Math.floor(Math.random()*symbols.length));
    const rand=Math.random();
    if(rand>0.95){r[0]=r[1]=r[2]=3;} else if(rand>0.75){r[2]=r[0];}
    ['s1','s2','s3'].forEach((id,i)=>{document.getElementById(id).innerText=symbols[r[i]];});
    let win=0;
    if(r[0]===3&&r[1]===3&&r[2]===3) win=1000;
    else if(r[0]===r[1]&&r[1]===r[2]) win=300;
    else if(r[0]===r[1]||r[1]===r[2]||r[0]===r[2]) win=60;
    await FDB.update('users/'+u.id, { coins:(userData.coins||0)-(cfg.slotCost||100)+win, lastSlot:Date.now() });
    setTimeout(() => {
      if(win>=1000) UI.toast('JACKPOT! +'+win+' Coins!','success');
      else if(win>0) UI.toast('Nice! +'+win+' Coins!','success');
      else UI.toast('No match. Try again!','info');
      UI.render();
    },400);
  }
};

/* ============================================================
   10. VIDEO SYSTEM
   ============================================================ */
const VideoSystem = {
  _timer:null, _elapsed:0, _currentVideo:null, _claimed:false,
  _adTimer:null, _pendingVideoId:null,

  extractYTId: (input) => {
    if(!input) return null; input=input.trim();
    if(/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    const pp=[/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,/youtu\.be\/([a-zA-Z0-9_-]{11})/,/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/];
    for(const p of pp){const m=input.match(p);if(m)return m[1];}
    return null;
  },

  switchTab: (tab) => {
    ['watch','upload','myvideos','monetize'].forEach(t=>{
      const el=document.getElementById('vtab-'+t);
      const btn=document.getElementById('vtab-btn-'+t);
      if(el) el.classList.toggle('hidden',t!==tab);
      if(btn) btn.classList.toggle('active',t===tab);
    });
    if(tab==='watch') VideoSystem.renderVideoList();
    if(tab==='myvideos') VideoSystem.renderMyVideos();
    if(tab==='monetize') MonetizeSystem.renderMonetizeTab();
  },

  renderVideoList: async () => {
    const l=document.getElementById('videoList');
    const empty=document.getElementById('videoEmptyMsg');
    if(!l) return;
    const u = Session.verifySync(); if (!u) return;
    const userData = await FDB.getUser(u.id);
    const videos = await FDB.getVideos();
    if(!videos.length){l.innerHTML='';if(empty)empty.classList.remove('hidden');return;}
    if(empty) empty.classList.add('hidden');
    const today=new Date().toDateString();
    l.innerHTML='';
    videos.forEach(v=>{
      const isWatched=!!((userData.videoHistory||[]).find(h=>h.vid===v.id&&new Date(h.watchedAt).toDateString()===today));
      const ytId=VideoSystem.extractYTId(v.url||'');
      const thumb=v.thumbnail||(ytId?'https://img.youtube.com/vi/'+ytId+'/mqdefault.jpg':'');
      const ubadge=v.uploaderId?'<span class="user-upload-badge"><i class="fas fa-user"></i> User</span>':'';
      const catBadge=v.category?'<span class="video-cat-badge">'+v.category+'</span>':'';
      const clickFn=isWatched?'UI.toast(\'Already watched today!\',\'warning\')':'VideoSystem.startVideoFlow(\''+v.id+'\')';
      l.innerHTML+='<div class="video-card glass">'+
        '<div class="video-thumb-wrap" onclick="'+clickFn+'">'+
        (thumb?'<img src="'+thumb+'" class="video-thumb" onerror="this.style.background=\'#1a1a2e\'">':'<div class="video-thumb" style="position:absolute;inset:0;background:#1a1a2e;display:flex;align-items:center;justify-content:center;"><i class="fas fa-play-circle" style="font-size:3rem;color:#333;"></i></div>')+
        '<div class="video-play-icon '+(isWatched?'video-watched':'')+'">'+
        (isWatched?'<i class="fas fa-check-circle"></i>':'<i class="fas fa-play"></i>')+
        '</div></div><div class="video-card-info">'+
        '<h4 class="video-title">'+v.title+ubadge+'</h4>'+
        '<div class="video-meta"><span class="coin-badge"><i class="fas fa-eye"></i> '+(v.views||0).toLocaleString()+'</span>'+catBadge+'</div>'+
        (isWatched?'<div class="video-done-badge"><i class="fas fa-check"></i> Watched Today</div>':
          '<button class="btn btn-sm video-watch-btn" onclick="VideoSystem.startVideoFlow(\''+v.id+'\')"><i class="fas fa-play"></i> Watch</button>')+
        '</div></div>';
    });
  },

  renderVideoStats: async (u) => {
    const userData = u || await FDB.getUser(Session.verifySync()?.id);
    if (!userData) return;
    const today=new Date().toDateString();
    const hist=(userData.videoHistory||[]);
    const todayH=hist.filter(h=>new Date(h.watchedAt).toDateString()===today);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.innerText=v;};
    set('vidTodayEarned', todayH.reduce((s,h)=>s+(h.reward||0),0));
    set('vidTodayCount', todayH.length);
    set('vidTotalWatched', hist.length);
  },

  renderMyVideos: async () => {
    const l=document.getElementById('myVideosList'); if(!l) return;
    const u = Session.verifySync(); if (!u) return;
    const videos = await FDB.getVideos();
    const myVids = videos.filter(v=>v.uploaderId===u.id).reverse();
    if(!myVids.length){
      l.innerHTML='<div style="text-align:center;padding:40px 20px;color:#aaa;"><i class="fas fa-video-slash" style="font-size:2.5rem;opacity:0.3;display:block;margin-bottom:10px;"></i><p>No videos uploaded yet.</p><small>Go to Upload tab!</small></div>';
      return;
    }
    const userData = await FDB.getUser(u.id);
    const cfg = _appConfig;
    l.innerHTML='';
    myVids.forEach(v=>{
      l.innerHTML+=`<div class="video-card glass">
        <div class="video-thumb-wrap" onclick="ChannelSystem.openChannel('${u.id}')">
          ${v.thumbnail?`<img src="${v.thumbnail}" class="video-thumb">`:'<div class="video-thumb" style="position:absolute;inset:0;background:#1a1a2e;display:flex;align-items:center;justify-content:center;"><i class="fas fa-film" style="font-size:2rem;color:#444;"></i></div>'}
          <div class="video-play-icon" style="background:rgba(0,0,0,0.4);cursor:default;"><i class="fas fa-eye" style="color:var(--neon-cyan);font-size:1.5rem;"></i></div>
        </div>
        <div class="video-card-info">
          <h4 class="video-title">${v.title} <span class="user-upload-badge"><i class="fas fa-user"></i> Mine</span></h4>
          <div class="video-meta">
            <span class="coin-badge"><i class="fas fa-eye"></i> ${(v.views||0).toLocaleString()} views</span>
            <span class="video-cat-badge">${v.category||'Video'}</span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap;">
            <span style="color:var(--neon-gold);font-size:0.82rem;"><i class="fas fa-coins"></i> ${((v.views||0)*0.001).toFixed(3)} coins</span>
            ${userData.monetized?`<span style="color:var(--success);font-size:0.82rem;">৳${((v.views||0)*0.001*(cfg.coinToBDT||0.01)).toFixed(6)}</span>`:'<span style="color:#666;font-size:0.78rem;">Monetize for BDT</span>'}
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-sm btn-outline" onclick="ChannelSystem.openChannel('${u.id}')"><i class="fas fa-external-link-alt"></i> Channel</button>
            <button class="btn btn-sm btn-danger" onclick="VideoSystem.deleteMyVideo('${v.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`;
    });
  },

  startVideoFlow: async (videoId) => {
    const u = Session.verifySync(); if (!u) return;
    const cfg = _appConfig;
    if (cfg.videoAdEnabled && cfg.videoAdCode) {
      VideoSystem._pendingVideoId = videoId;
      VideoSystem.showAd(cfg);
    } else {
      VideoSystem.openPlayer(videoId);
    }
  },

  showAd: (cfg) => {
    const overlay=document.getElementById('videoAdOverlay');
    const content=document.getElementById('videoAdContent');
    const skipBtn=document.getElementById('adSkipBtn');
    const fill=document.getElementById('adCountdownFill');
    const text=document.getElementById('adCountdownText');
    if(!overlay||!content){VideoSystem.skipAd();return;}
    content.innerHTML=cfg.videoAdCode;
    skipBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
    let left=cfg.videoAdTimer||5;
    text.innerText=left+'s'; fill.style.width='100%';
    VideoSystem._adTimer=setInterval(()=>{
      left--; text.innerText=left+'s';
      fill.style.width=((left/(cfg.videoAdTimer||5))*100)+'%';
      if(left<=0){clearInterval(VideoSystem._adTimer);skipBtn.classList.remove('hidden');fill.style.width='0%';}
    },1000);
  },

  skipAd: () => {
    clearInterval(VideoSystem._adTimer);
    const ov=document.getElementById('videoAdOverlay'); if(ov) ov.classList.add('hidden');
    if(VideoSystem._pendingVideoId){VideoSystem.openPlayer(VideoSystem._pendingVideoId);VideoSystem._pendingVideoId=null;}
  },

  openPlayer: async (videoId) => {
    const u = Session.verifySync(); if (!u) return;
    Loading.show('Loading video...');
    const userData = await FDB.getUser(u.id);
    const videos = await FDB.getVideos();
    const video = videos.find(v=>v.id===videoId);
    Loading.hide();
    if (!video) return UI.toast('Video not found','error');
    const today=new Date().toDateString();
    if ((userData.videoHistory||[]).find(h=>h.vid===videoId&&new Date(h.watchedAt).toDateString()===today))
      return UI.toast('Already watched today! Come back tomorrow.','warning');
    const isLocal=!!video.videoData;
    const ytId=isLocal?null:VideoSystem.extractYTId(video.url||'');
    if(!isLocal&&!ytId) return UI.toast('Invalid video','error');
    VideoSystem._currentVideo=video; VideoSystem._elapsed=0; VideoSystem._claimed=false;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.innerText=v;};
    const frame=document.getElementById('vpFrame');
    const claimBtn=document.getElementById('vpClaimBtn');
    const watchMsg=document.getElementById('vpWatchMsg');
    const fill=document.getElementById('vpProgressFill');
    const pct=document.getElementById('vpProgressText');
    set('vpTitle', video.title);
    set('vpReward', 'Creator earns 0.001 coin from your view');
    if(isLocal){
      const ic=document.querySelector('.video-iframe-container');
      if(ic) ic.innerHTML='<video id="vpLocalVideo" src="'+video.videoData+'" controls autoplay style="position:absolute;inset:0;width:100%;height:100%;background:#000;"></video>';
    } else {
      if(frame) frame.src='https://www.youtube.com/embed/'+ytId+'?autoplay=1&rel=0&modestbranding=1';
    }
    if(claimBtn) claimBtn.classList.add('hidden');
    if(watchMsg){watchMsg.style.display='block';watchMsg.innerText='Watch to support the creator!';}
    if(fill){fill.style.width='0%';fill.style.background='';fill.style.transition='width 0.5s';}
    if(pct) pct.innerText='0%';
    set('vpTimeElapsed','0s'); set('vpTimeNeeded',(video.watchDuration||15)+'s');
    document.getElementById('videoOverlay').classList.remove('hidden');
    VideoSystem._timer=setInterval(()=>{
      VideoSystem._elapsed++;
      const p=Math.min(100,Math.round((VideoSystem._elapsed/(video.watchDuration||15))*100));
      if(fill) fill.style.width=p+'%';
      if(pct) pct.innerText=p+'%';
      set('vpTimeElapsed',VideoSystem._elapsed+'s');
      if(VideoSystem._elapsed>=(video.watchDuration||15)&&!VideoSystem._claimed){
        clearInterval(VideoSystem._timer);
        if(claimBtn) claimBtn.classList.remove('hidden');
        if(watchMsg) watchMsg.style.display='none';
        if(fill) fill.style.background='linear-gradient(90deg,#00cc66,#00ff88)';
        UI.toast('Watch complete! Claim to register your view.','success');
      }
    },1000);
  },

  closePlayer: () => {
    clearInterval(VideoSystem._timer);
    const frame=document.getElementById('vpFrame'); if(frame) frame.src='';
    const ic=document.querySelector('.video-iframe-container');
    if(ic&&!document.getElementById('vpFrame'))
      ic.innerHTML='<iframe id="vpFrame" src="" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    document.getElementById('videoOverlay').classList.add('hidden');
    VideoSystem._currentVideo=null; VideoSystem._elapsed=0; VideoSystem._claimed=false;
  },

  claimReward: async () => {
    if(VideoSystem._claimed) return;
    const video=VideoSystem._currentVideo; if(!video) return;
    VideoSystem._claimed=true;
    const u = Session.verifySync(); if (!u) return;
    Loading.show('Registering view...');
    const userData = await FDB.getUser(u.id);
    const hist = userData.videoHistory||[];
    hist.push({vid:video.id,title:video.title,reward:0,watchedAt:new Date().toISOString()});
    await FDB.update('users/'+u.id, {videoHistory: hist});
    // Update video view count
    const currentViews = (video.views||0) + 1;
    await FDB.update('videos/'+video.id, {views: currentViews});
    // Give uploader 0.001 coin
    if(video.uploaderId && video.uploaderId!==u.id){
      const uploader = await FDB.getUser(video.uploaderId);
      if(uploader){
        const cfg = _appConfig;
        const viewCoin = cfg.viewCoinRate||0.001;
        const newUploaderCoins = (uploader.coins||0) + viewCoin;
        const newTotalViews = (uploader.totalVideoViews||0) + 1;
        const updates = {coins:newUploaderCoins, totalVideoViews:newTotalViews};
        if(uploader.monetized){
          const bdt = viewCoin*(cfg.coinToBDT||0.01);
          updates.balance = (uploader.balance||0)+bdt;
          updates.videoEarnings = (uploader.videoEarnings||0)+bdt;
        }
        await FDB.update('users/'+video.uploaderId, updates);
      }
    }
    Loading.hide();
    VideoSystem.closePlayer();
    UI.toast('View registered! Creator earned 0.001 coin.','success');
    UI.render();
  },

  submitVideo: async () => {
    const fileInput=document.getElementById('uVFile');
    const title=document.getElementById('uVTitle').value.trim();
    const category=document.getElementById('uVCategory').value;
    const u = Session.verifySync(); if(!u) return;
    if(!title) return UI.toast('Please enter a video title','warning');
    if(!fileInput||!fileInput.files||!fileInput.files[0]) return UI.toast('Please select a video file','warning');
    const file=fileInput.files[0];
    if(file.size>100*1024*1024) return UI.toast('File too large! Max 100MB.','error');
    if(!file.type.startsWith('video/')) return UI.toast('Please select a valid video file.','error');
    const submitBtn=document.getElementById('uploadSubmitBtn');
    if(submitBtn){submitBtn.disabled=true;submitBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Uploading...';}
    const reader=new FileReader();
    reader.onload=(e)=>{
      const videoEl=document.createElement('video');
      videoEl.src=e.target.result; videoEl.currentTime=1;
      videoEl.onloadeddata=async()=>{
        const canvas=document.createElement('canvas'); canvas.width=320; canvas.height=180;
        canvas.getContext('2d').drawImage(videoEl,0,0,320,180);
        const thumb=canvas.toDataURL('image/jpeg',0.7);
        Loading.show('Saving video...');
        const newVid={
          id:'v_'+Date.now(), title, category,
          uploaderId:u.id, uploaderName:Session.verifySync()?.username||'',
          videoData:e.target.result, thumbnail:thumb,
          watchDuration:15, views:0, addedAt:new Date().toISOString()
        };
        await FDB.saveVideo(newVid);
        Loading.hide();
        if(submitBtn){submitBtn.disabled=false;submitBtn.innerHTML='<i class="fas fa-paper-plane"></i> Submit Video';}
        document.getElementById('uVTitle').value='';
        fileInput.value='';
        document.getElementById('uploadPreview').classList.add('hidden');
        VideoSystem.switchTab('myvideos');
        UI.toast('Video uploaded successfully! 🎉','success');
      };
      videoEl.onerror=()=>{
        Loading.hide();
        if(submitBtn){submitBtn.disabled=false;submitBtn.innerHTML='<i class="fas fa-paper-plane"></i> Submit Video';}
        UI.toast('Error reading video file.','error');
      };
    };
    reader.onerror=()=>{
      Loading.hide();
      if(submitBtn){submitBtn.disabled=false;submitBtn.innerHTML='<i class="fas fa-paper-plane"></i> Submit Video';}
      UI.toast('Error reading file.','error');
    };
    reader.readAsDataURL(file);
  },

  previewFile: (input) => {
    const preview=document.getElementById('uploadPreview');
    if(!input.files||!input.files[0]){if(preview)preview.classList.add('hidden');return;}
    const file=input.files[0];
    if(!file.type.startsWith('video/')){UI.toast('Please select a video file','warning');return;}
    const previewVid=document.getElementById('previewVidEl');
    if(previewVid){previewVid.src=URL.createObjectURL(file);preview.classList.remove('hidden');}
    const sizeEl=document.getElementById('uploadFileInfo');
    if(sizeEl) sizeEl.innerText=file.name+' — '+(file.size/1024/1024).toFixed(1)+'MB';
  },

  deleteMyVideo: async (videoId) => {
    if(!confirm('Delete this video?')) return;
    Loading.show('Deleting...');
    await FDB.deleteVideo(videoId);
    Loading.hide();
    VideoSystem.renderMyVideos();
    UI.toast('Video deleted','info');
  }
};

/* ============================================================
   11. SUBSCRIBE SYSTEM
   ============================================================ */
const SubSystem = {
  subscribe: async (targetUserId) => {
    const me = Session.verifySync(); if(!me) return;
    if(me.id===targetUserId) return UI.toast('You cannot subscribe to yourself','warning');
    const meData = await FDB.getUser(me.id);
    const subs = meData.subscriptions||[];
    const already = subs.includes(targetUserId);
    if(already){
      await FDB.update('users/'+me.id, {subscriptions: subs.filter(id=>id!==targetUserId)});
      UI.toast('Unsubscribed','info');
    } else {
      subs.push(targetUserId);
      await FDB.update('users/'+me.id, {subscriptions: subs});
      UI.toast('Subscribed! 🔔','success');
    }
    ChannelSystem.renderChannel(targetUserId);
  },
  getSubscriberCount: async (userId) => {
    const all = await FDB.getAllUsers();
    return all.filter(u=>(u.subscriptions||[]).includes(userId)).length;
  }
};

/* ============================================================
   12. CHANNEL SYSTEM
   ============================================================ */
const ChannelSystem = {
  openChannel: async (userId) => {
    document.querySelectorAll('.page-section').forEach(el=>el.classList.add('hidden'));
    document.getElementById('page-channel').classList.remove('hidden');
    document.getElementById('mainNav').classList.remove('hidden');
    window.scrollTo(0,0);
    ChannelSystem.renderChannel(userId);
  },
  renderChannel: async (userId) => {
    const me = Session.verifySync();
    Loading.show('Loading channel...');
    const user = await FDB.getUser(userId);
    const subCount = await SubSystem.getSubscriberCount(userId);
    const allVids = await FDB.getVideos();
    Loading.hide();
    if(!user) return;
    const meData = me ? await FDB.getUser(me.id) : null;
    const isSub = meData ? (meData.subscriptions||[]).includes(userId) : false;
    const isMe = me && me.id===userId;
    const userVids = allVids.filter(v=>v.uploaderId===userId);
    const hdr=document.getElementById('channelHeader');
    if(hdr) hdr.innerHTML=`
      <div class="channel-banner" style="background:linear-gradient(135deg,#0a0a1a,#1a1a3e,#0a2a1a);"></div>
      <div class="channel-info-row">
        <img src="${user.avatar}" class="channel-avatar">
        <div class="channel-meta">
          <h2>${user.username} ${user.monetized?'<span class="monetized-badge">💰 Monetized</span>':''}</h2>
          <div class="channel-stats-row">
            <span><b>${subCount.toLocaleString()}</b> Subscribers</span>
            <span><b>${userVids.length}</b> Videos</span>
            <span><b>${(user.totalVideoViews||0).toLocaleString()}</b> Views</span>
          </div>
          ${!isMe?`<button class="btn ${isSub?'btn-outline':''} channel-sub-btn" onclick="SubSystem.subscribe('${userId}')">
            <i class="fas fa-${isSub?'bell-slash':'bell'}"></i> ${isSub?'Subscribed':'Subscribe'}
          </button>`:`<button class="btn btn-sm btn-outline" onclick="Router.go('profile')"><i class="fas fa-cog"></i> My Profile</button>`}
        </div>
      </div>`;
    const vl=document.getElementById('channelVideoList'); if(!vl) return;
    if(!userVids.length){vl.innerHTML='<p style="color:#aaa;text-align:center;padding:30px;">No videos uploaded yet.</p>';return;}
    const today=new Date().toDateString();
    vl.innerHTML='';
    userVids.forEach(v=>{
      const isWatched=meData?!!(meData.videoHistory||[]).find(h=>h.vid===v.id&&new Date(h.watchedAt).toDateString()===today):false;
      vl.innerHTML+=`<div class="video-card glass">
        <div class="video-thumb-wrap" onclick="VideoSystem.startVideoFlow('${v.id}')">
          ${v.thumbnail?`<img src="${v.thumbnail}" class="video-thumb">`:'<div class="video-thumb" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1a1a2e;"><i class="fas fa-play-circle" style="font-size:3rem;color:#444;"></i></div>'}
          <div class="video-play-icon ${isWatched?'video-watched':''}">${isWatched?'<i class="fas fa-check-circle"></i>':'<i class="fas fa-play"></i>'}</div>
        </div>
        <div class="video-card-info">
          <h4 class="video-title">${v.title}</h4>
          <div class="video-meta"><span class="coin-badge"><i class="fas fa-eye"></i> ${(v.views||0).toLocaleString()}</span><span class="video-cat-badge">${v.category||'Video'}</span></div>
          ${!isWatched?`<button class="btn btn-sm video-watch-btn" onclick="VideoSystem.startVideoFlow('${v.id}')"><i class="fas fa-play"></i> Watch</button>`:'<div class="video-done-badge"><i class="fas fa-check"></i> Watched Today</div>'}
        </div>
      </div>`;
    });
  }
};

/* ============================================================
   13. MONETIZATION SYSTEM
   ============================================================ */
const MonetizeSystem = {
  REQUIRED_COINS: 1000000,
  renderMonetizeTab: async () => {
    const u = Session.verifySync(); if(!u) return;
    const userData = await FDB.getUser(u.id);
    const el=document.getElementById('monetizeContent'); if(!el) return;
    const totalCoins=userData.coins||0;
    const isMonetized=userData.monetized===true;
    const hasPending=userData.monetizeStatus==='Pending';
    el.innerHTML=`
      <div class="glass monetize-hero">
        <div class="monetize-icon">${isMonetized?'💰':'🚀'}</div>
        <h2>${isMonetized?'You are Monetized!':'Unlock Monetization'}</h2>
        <p style="color:#aaa;font-size:0.85rem;">${isMonetized?'Your videos earn real BDT from views!':'Reach 1,000,000 coins to apply'}</p>
      </div>
      ${!isMonetized?`
      <div class="glass">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#aaa;font-size:0.85rem;">Progress to Monetization</span>
          <span style="color:var(--neon-gold);font-weight:bold;">${totalCoins.toLocaleString()} / 1,000,000</span>
        </div>
        <div class="monetize-progress-bar"><div style="width:${Math.min(100,(totalCoins/1000000*100))}%"></div></div>
        <p style="color:#aaa;font-size:0.82rem;margin-top:8px;text-align:center;">${totalCoins>=1000000?'✅ Eligible! Apply now.':`Need ${(1000000-totalCoins).toLocaleString()} more coins`}</p>
      </div>`:''}
      <div class="glass monetize-benefits">
        <h3 style="margin-bottom:12px;">💎 Monetization Benefits</h3>
        <div class="benefit-item ${isMonetized?'active':''}"><i class="fas fa-coins"></i><div><b>Coin Earnings</b><small>0.001 coins per view — always active</small></div></div>
        <div class="benefit-item ${isMonetized?'active':'locked'}"><i class="fas fa-${isMonetized?'check-circle':'lock'}"></i><div><b>BDT Earnings</b><small>${isMonetized?'Active! Views → real balance':'Unlocks after approval'}</small></div></div>
        <div class="benefit-item ${isMonetized?'active':'locked'}"><i class="fas fa-${isMonetized?'check-circle':'lock'}"></i><div><b>Creator Badge</b><small>${isMonetized?'Shown on your channel!':'Monetized badge on profile'}</small></div></div>
      </div>
      ${!isMonetized&&!hasPending?`<div style="padding:0 0 15px;"><button class="btn btn-success" onclick="MonetizeSystem.apply()" ${totalCoins<1000000?'disabled style="opacity:0.5;"':''}><i class="fas fa-paper-plane"></i> Apply for Monetization</button></div>`:''}
      ${hasPending?`<div class="glass" style="text-align:center;padding:20px;color:var(--neon-gold);"><i class="fas fa-clock" style="font-size:2rem;display:block;margin-bottom:10px;"></i><b>Application Under Review</b><p style="color:#aaa;font-size:0.85rem;margin-top:5px;">Admin will review within 48 hours.</p></div>`:''}
      ${isMonetized?`<div class="glass monetize-stats"><h3 style="margin-bottom:12px;">📊 Video Earnings</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><div class="monetize-stat-box"><i class="fas fa-eye" style="color:var(--neon-cyan);"></i><h3>${(userData.totalVideoViews||0).toLocaleString()}</h3><small>Total Views</small></div><div class="monetize-stat-box"><i class="fas fa-coins" style="color:gold;"></i><h3>${((userData.totalVideoViews||0)*0.001).toFixed(3)}</h3><small>Coins from Views</small></div><div class="monetize-stat-box"><i class="fas fa-money-bill" style="color:var(--neon-gold);"></i><h3>৳${(userData.videoEarnings||0).toFixed(4)}</h3><small>BDT from Views</small></div><div class="monetize-stat-box"><i class="fas fa-video" style="color:var(--neon-purple);"></i><h3>Loading...</h3><small>Videos</small></div></div></div>`:''}
    `;
  },
  apply: async () => {
    const u = Session.verifySync(); if(!u) return;
    const userData = await FDB.getUser(u.id);
    if((userData.coins||0)<1000000) return UI.toast('You need 1,000,000 coins to apply!','error');
    await FDB.update('users/'+u.id,{monetizeStatus:'Pending'});
    MonetizeSystem.renderMonetizeTab();
    UI.toast('Application submitted!','success');
  }
};

/* ============================================================
   14. ADMIN PANEL
   ============================================================ */
const Admin = {
  init: async () => {
    if(sessionStorage.getItem('isAdmin')!=='true'){Router.go('auth');return;}
    Admin.renderOverview();
    Admin.renderTab('overview');
    // load video ad config
    const cfg = await FDB.getConfig();
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
    const setCheck=(id,v)=>{const e=document.getElementById(id);if(e)e.checked=v;};
    setCheck('admVideoAdEnabled',!!cfg.videoAdEnabled);
    set('admVideoAdTimer',cfg.videoAdTimer||5);
    set('admVideoAdCode',cfg.videoAdCode||'');
    // config tab
    set('admCooldown',cfg.gameCooldown||24);
    set('admSpinCost',cfg.spinCost||50);
    set('admScratchCost',cfg.scratchCost||20);
    set('admSlotCost',cfg.slotCost||100);
    set('admMinWithdraw',cfg.minWithdraw||200);
    set('admCoinRate',cfg.coinToBDT||0.01);
    set('admRefBonus',cfg.referralBonus||500);
    set('admRefReq',cfg.referralTasksReq||3);
    set('admAdCode',cfg.adCode||'');
    setCheck('admMaintenance',!!cfg.maintenanceMode);
  },

  renderTab: (tab) => {
    document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c=>c.classList.add('hidden'));
    const btn=document.getElementById('tab-btn-'+tab);
    const content=document.getElementById('tab-'+tab);
    if(btn) btn.classList.add('active');
    if(content) content.classList.remove('hidden');
  },

  renderOverview: async () => {
    const users = await FDB.getAllUsers();
    const withdrawals = await FDB.getWithdrawals();
    const total=users.length;
    const pending=withdrawals.filter(w=>w.status==='Pending').length;
    const approved=withdrawals.filter(w=>w.status==='Approved').length;
    const totalPaid=withdrawals.filter(w=>w.status==='Approved').reduce((s,w)=>s+w.amt,0);
    const banned=users.filter(u=>u.isBanned).length;
    const today=new Date().toDateString();
    const newToday=users.filter(u=>new Date(u.joinedAt).toDateString()===today).length;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.innerText=v;};
    set('admTotalUsers',total);set('admPending',pending);set('admApproved',approved);
    set('admTotalPaid','৳'+totalPaid.toFixed(2));set('admBanned',banned);set('admNewToday',newToday);
  },

  renderWithdrawals: async (filter) => {
    filter=filter||'all';
    const l=document.getElementById('admWithdrawList'); if(!l) return;
    const all = await FDB.getWithdrawals();
    let list=[...all].reverse();
    if(filter!=='all') list=list.filter(w=>w.status===filter);
    if(!list.length){l.innerHTML='<p style="color:#aaa;text-align:center;padding:20px;">No withdrawals found.</p>';return;}
    const icons={bKash:'📱',Nagad:'🟠',Rocket:'🚀','DBBL Mobile':'🏦'};
    l.innerHTML='';
    list.forEach(w=>{
      const sc=w.status==='Approved'?'status-approved':w.status==='Rejected'?'status-rejected':'status-pending';
      l.innerHTML+='<div class="admin-withdraw-card"><div class="admin-withdraw-info"><b>'+(icons[w.method]||'💸')+' '+w.username+'</b><span style="color:#aaa;">'+w.method+' &bull; '+w.number+'</span><span style="color:var(--neon-gold);font-size:1.1rem;">৳'+w.amt.toFixed(2)+'</span><small style="color:#666;">'+new Date(w.id).toLocaleString('en-BD')+'</small></div><div class="admin-withdraw-actions"><span class="status-badge '+sc+'">'+w.status+'</span>'+(w.status==='Pending'?'<button class="btn btn-sm btn-success" onclick="Admin.processWithdraw('+w.id+',\'Approved\')">✅ Approve</button><button class="btn btn-sm btn-danger" onclick="Admin.processWithdraw('+w.id+',\'Rejected\')">❌ Reject</button>':'')+'</div></div>';
    });
  },

  processWithdraw: async (wId, status) => {
    Loading.show('Processing...');
    const all = await FDB.getWithdrawals();
    const w = all.find(x=>x.id===wId); if(!w){Loading.hide();return;}
    if(status==='Rejected'&&w.status==='Pending'){
      const user = await FDB.getUser(w.userId);
      if(user) await FDB.update('users/'+w.userId,{balance:(user.balance||0)+w.amt,totalWithdrawn:Math.max(0,(user.totalWithdrawn||0)-w.amt)});
    }
    await FDB.updateWithdrawal(wId,{status,processedAt:new Date().toISOString()});
    Loading.hide();
    Admin.renderWithdrawals('all'); Admin.renderOverview();
    UI.toast('Withdrawal '+status,'success');
  },

  renderUsers: async (search) => {
    search=search||'';
    const l=document.getElementById('admUserList'); if(!l) return;
    l.innerHTML='<p style="color:#aaa;text-align:center;padding:10px;">Loading...</p>';
    let users = await FDB.getAllUsers();
    if(search) users=users.filter(u=>u.username.toLowerCase().includes(search.toLowerCase())||u.mobile.includes(search));
    if(!users.length){l.innerHTML='<p style="color:#aaa;text-align:center;padding:20px;">No users found.</p>';return;}
    l.innerHTML='';
    users.forEach(u=>{
      l.innerHTML+='<div class="admin-user-card"><img src="'+u.avatar+'" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--neon-cyan);"><div style="flex-grow:1;margin-left:10px;"><b>'+u.username+(u.isBanned?' <span style="color:red;">[BANNED]</span>':'')+'</b><small style="color:#aaa;display:block;">📱 '+u.mobile+' &bull; '+new Date(u.joinedAt).toLocaleDateString('en-BD')+'</small><small style="color:#888;">Tasks: '+u.tasksCompleted+' | Coins: '+(u.coins||0)+' | ৳'+(u.balance||0).toFixed(2)+'</small></div><div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;"><button class="btn btn-sm '+(u.isBanned?'btn-success':'btn-danger')+'" onclick="Admin.toggleBan(\''+u.id+'\')">'+(u.isBanned?'Unban':'Ban')+'</button><button class="btn btn-sm btn-outline" onclick="Admin.editBalance(\''+u.id+'\')">Edit ৳</button></div></div>';
    });
  },

  editBalance: async (uid) => {
    const u = await FDB.getUser(uid); if(!u) return;
    const val=prompt('Edit balance for '+u.username+'\nCurrent: ৳'+(u.balance||0).toFixed(2)+'\nEnter new balance:');
    if(val===null) return;
    const num=parseFloat(val);
    if(isNaN(num)||num<0) return UI.toast('Invalid amount','error');
    await FDB.update('users/'+uid,{balance:num});
    Admin.renderUsers(); UI.toast('Balance updated','success');
  },

  toggleBan: async (id) => {
    const u = await FDB.getUser(id); if(!u) return;
    await FDB.update('users/'+id,{isBanned:!u.isBanned});
    Admin.renderUsers(); Admin.renderOverview();
    UI.toast((u.isBanned?'User unbanned: ':'User banned: ')+(u.username),u.isBanned?'success':'warning');
  },

  renderTasks: async () => {
    const l=document.getElementById('admTaskList'); if(!l) return;
    const tasks = await FDB.getTasks();
    if(!tasks.length){l.innerHTML='<p style="color:#aaa;text-align:center;padding:10px;">No tasks yet.</p>';return;}
    l.innerHTML='';
    tasks.forEach((t,i)=>{
      l.innerHTML+='<div class="admin-task-item"><img src="'+(t.icon||'https://cdn-icons-png.flaticon.com/512/149/149071.png')+'" style="width:35px;height:35px;border-radius:8px;" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/149/149071.png\'"><div style="flex-grow:1;margin-left:10px;"><b>'+t.title+'</b><small style="color:#aaa;display:block;">Reward: '+t.reward+' Coins</small></div><button class="btn btn-sm btn-danger" onclick="Admin.delTask(\''+t.id+'\')">🗑️</button></div>';
    });
  },

  addTask: async () => {
    const title=document.getElementById('admTTitle').value.trim();
    const reward=parseInt(document.getElementById('admTReward').value);
    const link=document.getElementById('admTLink').value.trim();
    const icon=document.getElementById('admTIcon').value.trim();
    if(!title) return UI.toast('Task title required','warning');
    if(!reward||reward<1) return UI.toast('Valid reward required','warning');
    const newTask={id:'t_'+Date.now(),title,reward,type:'link',icon:icon||'https://cdn-icons-png.flaticon.com/512/149/149071.png',link:link||'#'};
    await FDB.write('tasks/'+newTask.id, newTask);
    ['admTTitle','admTReward','admTLink','admTIcon'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    Admin.renderTasks(); UI.toast('Task created!','success');
  },

  delTask: async (taskId) => {
    if(!confirm('Delete this task?')) return;
    await FDB.remove('tasks/'+taskId);
    Admin.renderTasks(); UI.toast('Task deleted','info');
  },

  saveConfig: async () => {
    const getNum=(id,def)=>{const e=document.getElementById(id);return e?(parseFloat(e.value)||def):def;};
    const updates={
      gameCooldown:getNum('admCooldown',24), spinCost:getNum('admSpinCost',50),
      scratchCost:getNum('admScratchCost',20), slotCost:getNum('admSlotCost',100),
      minWithdraw:getNum('admMinWithdraw',200), coinToBDT:getNum('admCoinRate',0.01),
      referralBonus:getNum('admRefBonus',500), referralTasksReq:getNum('admRefReq',3)
    };
    const adEl=document.getElementById('admAdCode');if(adEl)updates.adCode=adEl.value;
    const mEl=document.getElementById('admMaintenance');if(mEl)updates.maintenanceMode=mEl.checked;
    await FDB.update('config',updates);
    _appConfig={..._appConfig,...updates};
    UI.toast('Configuration saved!','success');
  },

  exportUsers: async () => {
    const users = await FDB.getAllUsers();
    const csv=['Username,Mobile,Balance,Coins,Tasks,Joined,Banned'].concat(
      users.map(u=>u.username+','+u.mobile+','+(u.balance||0).toFixed(2)+','+(u.coins||0)+','+(u.tasksCompleted||0)+','+new Date(u.joinedAt).toLocaleDateString()+','+u.isBanned)
    ).join('\n');
    const a=document.createElement('a');
    a.href='data:text/csv,'+encodeURIComponent(csv);
    a.download='taskmint_users.csv'; a.click();
    UI.toast('Users exported!','success');
  },

  clearAllData: async () => {
    if(confirm('This will DELETE ALL DATA. Are you sure?')){
      const val=prompt('Type RESET to confirm:');
      if(val==='RESET'){
        await FDB.write('users',null);
        await FDB.write('withdrawals',null);
        await FDB.write('videos',null);
        await FDB.write('tasks',null);
        UI.toast('All data cleared. Refreshing...','info');
        setTimeout(()=>location.reload(),1500);
      }
    }
  },

  renderVideos: async () => {
    const l=document.getElementById('admVideoList');
    const countEl=document.getElementById('admVideoCount'); if(!l) return;
    const videos = await FDB.getVideos();
    if(countEl) countEl.innerText=videos.length+' video'+(videos.length!==1?'s':'');
    if(!videos.length){l.innerHTML='<p style="color:#aaa;text-align:center;padding:15px;">No videos yet.</p>';return;}
    l.innerHTML='';
    videos.forEach(v=>{
      const ytId=VideoSystem.extractYTId(v.url||'');
      const thumb=v.thumbnail||(ytId?'https://img.youtube.com/vi/'+ytId+'/mqdefault.jpg':'');
      l.innerHTML+='<div class="admin-video-item"><img src="'+thumb+'" style="width:80px;height:50px;object-fit:cover;border-radius:8px;flex-shrink:0;" onerror="this.style.background=\'#1a1a2e\'"><div style="flex-grow:1;margin-left:10px;min-width:0;"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+v.title+'</b><small style="color:#aaa;">'+(v.uploaderId?'👤 '+v.uploaderName:'Admin')+' &bull; 👁 '+(v.views||0)+'</small></div><button class="btn btn-sm btn-danger" onclick="Admin.delVideo(\''+v.id+'\')" style="flex-shrink:0;margin-left:8px;">🗑️</button></div>';
    });
  },

  addVideo: async () => {
    const title=document.getElementById('admVTitle').value.trim();
    const url=document.getElementById('admVUrl').value.trim();
    const reward=parseInt(document.getElementById('admVReward').value)||50;
    const duration=parseInt(document.getElementById('admVDuration').value)||30;
    const thumb=document.getElementById('admVThumb').value.trim();
    if(!title) return UI.toast('Video title required','warning');
    if(!url) return UI.toast('YouTube URL required','warning');
    const ytId=VideoSystem.extractYTId(url); if(!ytId) return UI.toast('Invalid YouTube URL','error');
    const newVid={id:'v_'+Date.now(),title,url:ytId,reward,watchDuration:duration,thumbnail:thumb,views:0,addedAt:new Date().toISOString()};
    await FDB.saveVideo(newVid);
    ['admVTitle','admVUrl','admVReward','admVDuration','admVThumb'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    Admin.renderVideos(); UI.toast('Video added!','success');
  },

  delVideo: async (id) => {
    if(!confirm('Delete this video?')) return;
    await FDB.deleteVideo(id);
    Admin.renderVideos(); UI.toast('Video deleted','info');
  },

  saveVideoAdConfig: async () => {
    const en=document.getElementById('admVideoAdEnabled');
    const timer=document.getElementById('admVideoAdTimer');
    const code=document.getElementById('admVideoAdCode');
    const updates={};
    if(en) updates.videoAdEnabled=en.checked;
    if(timer) updates.videoAdTimer=parseInt(timer.value)||5;
    if(code) updates.videoAdCode=code.value;
    await FDB.update('config',updates);
    _appConfig={..._appConfig,...updates};
    UI.toast('Video ad settings saved!','success');
  },

  renderMonetizations: async () => {
    const l=document.getElementById('admMonetizeList'); if(!l) return;
    const users = await FDB.getAllUsers();
    const pending=users.filter(u=>u.monetizeStatus==='Pending');
    const approved=users.filter(u=>u.monetized===true);
    if(!pending.length&&!approved.length){l.innerHTML='<p style="color:#aaa;text-align:center;padding:15px;">No monetization requests.</p>';return;}
    l.innerHTML='';
    pending.forEach(u=>{
      l.innerHTML+=`<div class="admin-user-card">
        <img src="${u.avatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid gold;">
        <div style="flex-grow:1;margin-left:10px;">
          <b>${u.username} <span style="color:gold;font-size:0.8rem;">[PENDING]</span></b>
          <small style="color:#aaa;display:block;">Coins: ${(u.coins||0).toLocaleString()}</small>
        </div>
        <div style="display:flex;gap:5px;flex-direction:column;align-items:flex-end;">
          <button class="btn btn-sm btn-success" onclick="Admin.approveMonetize('${u.id}')">✅ Approve</button>
          <button class="btn btn-sm btn-danger" onclick="Admin.rejectMonetize('${u.id}')">❌ Reject</button>
        </div>
      </div>`;
    });
    if(approved.length){
      l.innerHTML+='<p style="color:var(--neon-gold);margin:10px 0 5px;font-size:0.85rem;">✅ Monetized Creators</p>';
      approved.forEach(u=>{
        l.innerHTML+=`<div class="admin-user-card" style="border:1px solid rgba(255,215,0,0.2);">
          <img src="${u.avatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid var(--neon-gold);">
          <div style="flex-grow:1;margin-left:10px;">
            <b>${u.username} <span class="monetized-badge">💰 Monetized</span></b>
            <small style="color:#aaa;display:block;">Views: ${(u.totalVideoViews||0).toLocaleString()} &bull; ৳${(u.videoEarnings||0).toFixed(4)}</small>
          </div>
          <button class="btn btn-sm btn-danger btn-outline" onclick="Admin.revokeMonetize('${u.id}')">Revoke</button>
        </div>`;
      });
    }
  },

  approveMonetize: async (uid) => {
    await FDB.update('users/'+uid,{monetized:true,monetizeStatus:'Approved'});
    Admin.renderMonetizations(); UI.toast('Monetization approved! 💰','success');
  },

  rejectMonetize: async (uid) => {
    await FDB.update('users/'+uid,{monetizeStatus:'Rejected'});
    Admin.renderMonetizations(); UI.toast('Rejected','info');
  },

  revokeMonetize: async (uid) => {
    if(!confirm('Revoke monetization?')) return;
    await FDB.update('users/'+uid,{monetized:false,monetizeStatus:null});
    Admin.renderMonetizations(); UI.toast('Monetization revoked','warning');
  }
};

/* ============================================================
   INIT
   ============================================================ */
// Add spin animation CSS
const style = document.createElement('style');
style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', Router.init);
