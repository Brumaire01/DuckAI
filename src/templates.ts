/** 登录页面模板 */
export const loginTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>后台登录</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <script>
    // 提前应用主题，避免闪烁
    try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}
  </script>
  <style>
    :root{
      --primary:#8b5cf6;--primary-strong:#7c3aed;--primary-2:#d946ef;
      --grad:linear-gradient(135deg,#8b5cf6 0%,#d946ef 100%);
      --glow:rgba(139,92,246,.16);
      --text:#1e1b3a;--text-2:#6b6a8f;--text-3:#9a98c0;
      --field:#f6f4fb;--field-bd:#e9e5f5;--field-focus:#8b5cf6;
      --card:#ffffff;--card-bd:#ece7f7;
      --shadow:0 24px 60px rgba(30,23,66,.14),0 2px 6px rgba(30,23,66,.06);
      --danger:#ef4444;--danger-bg:rgba(239,68,68,.08);
      --success:#10b981;
      --radius:18px;
    }
    [data-theme="dark"]{
      --primary:#a78bfa;--primary-strong:#c4b5fd;--primary-2:#e879f9;
      --grad:linear-gradient(135deg,#8b5cf6 0%,#d946ef 100%);
      --glow:rgba(167,139,250,.2);
      --text:#e6e1f5;--text-2:#a7a3c9;--text-3:#76739a;
      --field:rgba(255,255,255,.05);--field-bd:#272347;--field-focus:#a78bfa;
      --card:#14112a;--card-bd:#272347;
      --shadow:0 26px 70px rgba(0,0,0,.55);
      --danger:#f87171;--danger-bg:rgba(248,113,113,.14);
      --success:#34d399;
    }
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%}
    body{
      display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;
      color:var(--text);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",system-ui,sans-serif;
      -webkit-font-smoothing:antialiased;
      background:linear-gradient(150deg,#f8f6ff 0%,#f0eafc 48%,#e7dff8 100%);
      transition:color .3s,background .3s;
    }
    [data-theme="dark"] body{background:linear-gradient(150deg,#0a0814 0%,#120e24 48%,#1a1233 100%)}
    body::before,body::after{content:"";position:absolute;border-radius:50%;filter:blur(100px);opacity:.38}
    body::before{width:460px;height:460px;background:#c084fc;top:-150px;left:-130px;animation:float1 16s ease-in-out infinite}
    body::after{width:400px;height:400px;background:#e879f9;bottom:-140px;right:-100px;animation:float2 18s ease-in-out infinite}
    [data-theme="dark"] body::before{background:#6d28d9;opacity:.45}
    [data-theme="dark"] body::after{background:#a21caf;opacity:.4}
    @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(60px,40px)}}
    @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,-40px)}}
    .card{
      position:relative;width:400px;max-width:92vw;padding:42px 38px 32px;border-radius:20px;
      background:var(--card);box-shadow:var(--shadow);
      backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--card-bd);
      animation:rise .55s cubic-bezier(.2,.8,.2,1)
    }
    @keyframes rise{from{opacity:0;transform:translateY(30px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    .theme-toggle{
      position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:10px;border:1px solid var(--card-bd);
      background:transparent;color:var(--text-3);cursor:pointer;display:flex;align-items:center;justify-content:center;
      transition:all .2s
    }
    .theme-toggle:hover{color:var(--primary);border-color:var(--primary);background:var(--field);transform:rotate(20deg)}
    .theme-toggle svg{width:17px;height:17px}
    .logo{
      width:64px;height:64px;margin:0 auto 18px;border-radius:18px;
      background:var(--grad);
      display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(139,92,246,.35);
      animation:pop .5s .15s both
    }
    @keyframes pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
    .logo svg{width:32px;height:32px}
    h1{text-align:center;font-size:22px;font-weight:700;margin-bottom:6px;letter-spacing:.4px}
    .sub{text-align:center;color:var(--text-3);font-size:13px;margin-bottom:24px;letter-spacing:.3px}
    .field{position:relative;margin-bottom:16px}
    .field label{display:block;font-size:12.5px;font-weight:600;color:var(--text-2);margin-bottom:7px;padding-left:2px;letter-spacing:.2px}
    .field .ic{position:absolute;left:14px;top:calc(50% + 4px);transform:translateY(-50%);color:var(--text-3);display:flex;pointer-events:none;transition:color .25s}
    .field .ic svg{width:20px;height:20px}
    .field input{
      width:100%;padding:12px 44px 12px 46px;border:1px solid var(--field-bd);border-radius:12px;
      font-size:14px;outline:none;transition:border-color .25s,box-shadow .25s,background .25s;
      background:var(--field);color:var(--text)
    }
    .field input::placeholder{color:var(--text-3)}
    .field input:focus{
      border-color:var(--field-focus);background:transparent;
      box-shadow:0 0 0 4px var(--glow)
    }
    .field input:focus + .ic{color:var(--field-focus)}
    .field.invalid input{border-color:var(--danger)}
    .field.valid input{border-color:var(--success)}
    .field .toggle-pw{
      position:absolute;right:12px;bottom:9px;width:30px;height:30px;border:none;background:transparent;
      color:var(--text-3);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:color .2s
    }
    .field .toggle-pw:hover{color:var(--primary)}
    .field .toggle-pw svg{width:18px;height:18px}
    .field-msg{font-size:12px;margin:6px 2px 0;min-height:14px;color:var(--danger);opacity:0;transition:opacity .2s}
    .field.invalid .field-msg{opacity:1}
    .row{display:flex;align-items:center;justify-content:space-between;margin:-4px 2px 18px}
    .remember{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text-2);cursor:pointer;user-select:none}
    .remember input{width:15px;height:15px;accent-color:var(--primary);cursor:pointer}
    .btn{
      width:100%;padding:13px;border:none;border-radius:12px;cursor:pointer;
      color:#fff;font-size:15px;font-weight:600;letter-spacing:3px;
      background:var(--grad);box-shadow:0 4px 14px rgba(139,92,246,.24);
      transition:transform .18s,box-shadow .25s,filter .25s;
      display:flex;align-items:center;justify-content:center;gap:8px
    }
    .btn:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(139,92,246,.34);filter:brightness(1.06)}
    .btn:active{transform:translateY(1px) scale(.99);box-shadow:0 5px 14px rgba(139,92,246,.3)}
    .btn:disabled{opacity:.65;cursor:not-allowed;transform:none;box-shadow:none;filter:none}
    .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .tip{min-height:18px;text-align:center;color:var(--danger);font-size:13px;margin-top:14px;background:var(--danger-bg);
      border:1px solid rgba(239,68,68,.16);border-radius:10px;padding:0;opacity:0;transition:opacity .25s,max-height .25s;max-height:0;overflow:hidden}
    .tip.show{opacity:1;padding:9px 12px;max-height:60px}
    .tip.shake{animation:shake .4s}
    @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
    .foot{text-align:center;margin-top:18px;color:var(--text-3);font-size:12px;letter-spacing:.3px}
    @media (max-width:480px){
      .card{padding:32px 22px 26px;border-radius:16px}
      h1{font-size:20px}
    }
  </style>
</head>
<body>
  <div class="card">
    <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" title="切换主题" aria-label="切换主题">
      <svg id="themeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
    </button>
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    </div>
    <h1>欢迎登录</h1>
    <p class="sub">后台管理系统</p>
    <form id="loginForm" novalidate>
      <div class="field" id="f-username">
        <label for="username">账号</label>
        <input id="username" type="text" placeholder="请输入账号" autocomplete="username" />
        <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
        <div class="field-msg">请输入账号</div>
      </div>
      <div class="field" id="f-password">
        <label for="password">密码</label>
        <input id="password" type="password" placeholder="请输入密码" autocomplete="current-password" />
        <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></span>
        <button type="button" class="toggle-pw" id="togglePw" aria-label="显示/隐藏密码">
          <svg id="eyeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <div class="field-msg">请输入密码</div>
      </div>
      <div class="row">
        <label class="remember"><input type="checkbox" id="remember" checked />记住我</label>
      </div>
      <button type="submit" class="btn" id="loginBtn">登 录</button>
      <div class="tip" id="tip"></div>
    </form>
    <div class="foot">© 2026 后台管理系统</div>
  </div>
  <script>
    var SUN='<path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="5"/>';
    var MOON='<path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/>';
    var EYE='<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
    var EYE_OFF='<path d="M17.94 17.94A10.07 10.07 0 0112 20c-6.5 0-10-7-10-7a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c6.5 0 10 7 10 7a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    function syncThemeIcon(){
      var dark=document.documentElement.getAttribute('data-theme')==='dark';
      document.getElementById('themeIcon').innerHTML=dark?SUN:MOON
    }
    function toggleTheme(){
      var dark=document.documentElement.getAttribute('data-theme')==='dark';
      if(dark){document.documentElement.removeAttribute('data-theme');try{localStorage.removeItem('theme')}catch(e){}}
      else{document.documentElement.setAttribute('data-theme','dark');try{localStorage.setItem('theme','dark')}catch(e){}}
      syncThemeIcon()
    }
    syncThemeIcon();

    var uField=document.getElementById('f-username'),uInput=document.getElementById('username');
    var pField=document.getElementById('f-password'),pInput=document.getElementById('password');
    var tip=document.getElementById('tip'),btn=document.getElementById('loginBtn');
    var eyeIcon=document.getElementById('eyeIcon'),pwShown=false;

    function setValid(field,ok,msg){
      field.classList.toggle('invalid',!ok);
      field.classList.toggle('valid',ok);
      if(msg&&!ok) field.querySelector('.field-msg').textContent=msg;
    }
    function validate(silent){
      var okU=uInput.value.trim().length>0, okP=pInput.value.trim().length>0;
      if(!silent) setValid(uField,okU,'请输入账号');
      if(!silent) setValid(pField,okP,'请输入密码');
      uField.classList.toggle('valid',okU);
      pField.classList.toggle('valid',okP);
      return okU&&okP;
    }
    uInput.addEventListener('input',()=>setValid(uField,uInput.value.trim().length>0,'请输入账号'));
    pInput.addEventListener('input',()=>setValid(pField,pInput.value.trim().length>0,'请输入密码'));
    uInput.addEventListener('blur',()=>{if(uInput.value.trim().length===0)setValid(uField,false,'请输入账号')});
    pInput.addEventListener('blur',()=>{if(pInput.value.trim().length===0)setValid(pField,false,'请输入密码')});

    document.getElementById('togglePw').addEventListener('click',function(){
      pwShown=!pwShown;
      pInput.type=pwShown?'text':'password';
      eyeIcon.innerHTML=pwShown?EYE_OFF:EYE;
    });

    function showError(msg){
      tip.textContent=msg;
      tip.classList.remove('show');void tip.offsetWidth;tip.classList.add('show');
      tip.classList.remove('shake');void tip.offsetWidth;tip.classList.add('shake');
    }
    async function doLogin() {
      validate(false);
      const username=uInput.value.trim(), password=pInput.value.trim();
      if(!username||!password){showError('请输入账号和密码');return}
      btn.disabled=true;btn.innerHTML='<span class="spinner"></span>登录中...';tip.className='tip';tip.textContent='';
      try{
        const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
        const data=await res.json();
        if(data.ok){location.href='/console'}
        else{showError(data.msg||'登录失败')}
      }catch(e){showError('网络错误，请重试')}
      finally{btn.disabled=false;btn.textContent='登 录'}
    }
    document.getElementById('loginForm').addEventListener('submit',function(e){e.preventDefault();doLogin()});
  </script>
</body>
</html>`

/** 后台控制台模板 */
export const consoleTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>后台控制台</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <script>
    try{
      var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);
      var n=localStorage.getItem('navCollapsed');if(n)document.documentElement.setAttribute('data-nav','collapsed')
    }catch(e){}
  </script>
  <style>
    :root{
      /* ===== 背景 / 表面 ===== */
      --bg:#f7f5ff;--bg-soft:#efeafb;
      --surface:#ffffff;--surface-2:#faf8ff;--surface-3:#f3efff;--surface-4:#ece6fb;
      --glass:rgba(255,255,255,.82);
      /* ===== 文字 ===== */
      --text:#1e1b3a;--text-2:#6b6a8f;--text-3:#9a98c0;
      /* ===== 边框 ===== */
      --border:#e9e5f5;--border-strong:#d6cfe8;
      /* ===== 主色 / 辅助色 ===== */
      --primary:#8b5cf6;--primary-hover:#7c3aed;--primary-active:#6d28d9;--primary-2:#d946ef;
      --primary-soft:rgba(139,92,246,.1);--primary-soft-2:rgba(139,92,246,.18);
      --grad:linear-gradient(135deg,#8b5cf6 0%,#d946ef 100%);
      --ring:rgba(139,92,246,.16);
      /* ===== 状态色 ===== */
      --success:#10b981;--success-soft:rgba(16,185,129,.12);--success-fg:#0f9d6e;
      --danger:#ef4444;--danger-soft:rgba(239,68,68,.1);--danger-fg:#dc2626;
      --warning:#f59e0b;--warning-soft:rgba(245,158,11,.14);--warning-fg:#d97706;
      /* ===== 阴影 ===== */
      --shadow-xs:0 1px 2px rgba(30,23,66,.05);
      --shadow-sm:0 2px 8px rgba(30,23,66,.06);
      --shadow:0 8px 22px rgba(30,23,66,.08);
      --shadow-lg:0 22px 55px rgba(30,23,66,.16);
      /* ===== 圆角 ===== */
      --radius:16px;--radius-sm:10px;--radius-xs:7px;
      /* ===== 侧边导航 ===== */
      --sidebar:#1e1b4b;--sidebar-2:#312e81;--side-bd:rgba(255,255,255,.08);
      --side-text:#bfb9e4;--side-text-hi:#ffffff;--side-sub:#8b8bb0;
      --side-hover:rgba(255,255,255,.07);--side-active:rgba(255,255,255,.12);--side-bar:#f0abfc;
      --sbw:248px;--sbw-mini:76px;
    }
    [data-theme="dark"]{
      --bg:#0a0814;--bg-soft:#120e24;
      --surface:#14112a;--surface-2:#211f3d;--surface-3:#282440;--surface-4:#302b4d;
      --glass:rgba(20,17,42,.82);
      --text:#e6e1f5;--text-2:#a7a3c9;--text-3:#76739a;
      --border:#272347;--border-strong:#342f54;
      --primary:#a78bfa;--primary-hover:#b79dfb;--primary-active:#c4b5fd;--primary-2:#e879f9;
      --primary-soft:rgba(139,92,246,.18);--primary-soft-2:rgba(139,92,246,.26);
      --grad:linear-gradient(135deg,#8b5cf6 0%,#d946ef 100%);
      --ring:rgba(167,139,250,.22);
      --success:#34d399;--success-soft:rgba(52,211,153,.14);--success-fg:#6ee7b7;
      --danger:#f87171;--danger-soft:rgba(248,113,113,.14);--danger-fg:#fca5a5;
      --warning:#fbbf24;--warning-soft:rgba(251,191,36,.14);--warning-fg:#fcd34d;
      --shadow-xs:0 1px 2px rgba(0,0,0,.4);
      --shadow-sm:0 2px 8px rgba(0,0,0,.45);
      --shadow:0 8px 22px rgba(0,0,0,.5);
      --shadow-lg:0 22px 55px rgba(0,0,0,.6);
      --sidebar:#0b0a1f;--sidebar-2:#16143a;--side-bd:rgba(255,255,255,.06);
      --side-text:#a49fce;--side-sub:#76739a;--side-active:rgba(255,255,255,.1);
    }
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%}
    body{
      background:var(--bg);color:var(--text);font-size:14px;line-height:1.6;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",system-ui,"Helvetica Neue",Arial,sans-serif;
      -webkit-font-smoothing:antialiased;transition:background .3s,color .3s
    }
    ::selection{background:var(--primary-soft-2);color:var(--text)}
    :focus-visible{outline:2px solid var(--primary);outline-offset:2px}
    ::-webkit-scrollbar{width:10px;height:10px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:6px;border:2px solid var(--bg)}
    ::-webkit-scrollbar-thumb:hover{background:var(--text-3)}
    /* ===== 布局 ===== */
    .layout{display:flex;min-height:100vh}
    /* ===== 侧边导航 ===== */
    .sidebar{
      width:var(--sbw);background:linear-gradient(180deg,var(--sidebar),var(--sidebar-2));
      color:var(--side-text);display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;
      border-right:1px solid var(--side-bd);z-index:30;
      transition:width .26s cubic-bezier(.4,0,.2,1),transform .3s ease
    }
    [data-nav="collapsed"] .sidebar{width:var(--sbw-mini)}
    .brand{display:flex;align-items:center;gap:12px;padding:20px 18px;font-size:16px;font-weight:700;
      color:var(--side-text-hi);white-space:nowrap;letter-spacing:.2px}
    .brand-logo{width:30px;height:30px;flex-shrink:0;color:var(--side-bar)}
    .brand-txt{overflow:hidden;transition:opacity .2s,width .26s}
    .brand small{display:block;font-size:10.5px;font-weight:500;color:var(--side-sub);letter-spacing:1.6px;margin-top:2px}
    .nav-collapse{
      margin-left:auto;width:30px;height:30px;flex-shrink:0;border-radius:9px;border:1px solid var(--side-bd);
      background:rgba(255,255,255,.05);color:var(--side-text);cursor:pointer;
      display:flex;align-items:center;justify-content:center;transition:all .2s
    }
    .nav-collapse:hover{background:rgba(255,255,255,.13);color:var(--side-text-hi)}
    .nav-collapse svg{width:16px;height:16px}
    .nav{flex:1;padding:10px 14px 16px;overflow-y:auto}
    .nav::-webkit-scrollbar{width:6px}
    .nav-group{font-size:10.5px;color:var(--side-sub);letter-spacing:1.6px;padding:14px 14px 8px;font-weight:600}
    .nav-item{
      position:relative;display:flex;align-items:center;gap:12px;
      padding:11px 14px;margin-bottom:3px;border-radius:10px;cursor:pointer;
      font-size:14px;color:var(--side-text);white-space:nowrap;
      transition:background .2s,color .2s,box-shadow .2s
    }
    .nav-item svg{width:19px;height:19px;transition:transform .25s;flex-shrink:0}
    .nav-item:hover{background:var(--side-hover);color:var(--side-text-hi)}
    .nav-item:hover svg{transform:scale(1.08)}
    .nav-item.active{background:var(--side-active);color:var(--side-text-hi);font-weight:600;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
    .nav-item.active svg{color:var(--side-bar)}
    .nav-item.active::before{
      content:"";position:absolute;left:-14px;top:50%;transform:translateY(-50%);
      width:3px;height:20px;border-radius:0 3px 3px 0;background:var(--side-bar)
    }
    .nav-foot{padding:14px;border-top:1px solid var(--side-bd);font-size:11px;color:var(--side-sub);
      text-align:center;letter-spacing:.5px;white-space:nowrap}
    [data-nav="collapsed"] .sidebar .nav-txt{display:none}
    [data-nav="collapsed"] .sidebar .brand{justify-content:center;padding:20px 0}
    [data-nav="collapsed"] .sidebar .brand-txt{opacity:0;width:0}
    [data-nav="collapsed"] .sidebar .nav-collapse{display:none}
    [data-nav="collapsed"] .sidebar .nav-group,[data-nav="collapsed"] .sidebar .nav-foot{display:none}
    [data-nav="collapsed"] .sidebar .nav-item{justify-content:center;padding:11px 0}
    [data-nav="collapsed"] .sidebar .nav-item.active::before{left:-14px}
    .main{flex:1;display:flex;flex-direction:column;min-width:0}
    /* ===== 顶栏 ===== */
    .topbar{
      height:64px;background:var(--glass);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
      display:flex;align-items:center;justify-content:space-between;gap:16px;
      padding:0 24px;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20
    }
    .topbar .left{display:flex;align-items:center;gap:14px;min-width:0}
    .menu-btn{
      width:36px;height:36px;flex-shrink:0;border-radius:9px;border:1px solid var(--border);background:var(--surface-2);
      color:var(--text-2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s
    }
    .menu-btn:hover{color:var(--primary);border-color:var(--primary);background:var(--primary-soft)}
    .menu-btn svg{width:18px;height:18px}
    .topbar h2{font-size:17px;font-weight:700;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .topbar .crumb{color:var(--text-3);font-size:12px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .user-box{display:flex;align-items:center;gap:10px}
    .icon-btn{width:36px;height:36px;border-radius:9px;border:1px solid var(--border);background:var(--surface-2);
      color:var(--text-2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
    .icon-btn:hover{color:var(--primary);border-color:var(--primary);background:var(--primary-soft);transform:translateY(-1px)}
    .icon-btn svg{width:17px;height:17px}
    .avatar{
      width:36px;height:36px;border-radius:11px;color:#fff;font-weight:700;font-size:15px;
      background:var(--grad);box-shadow:0 2px 8px rgba(139,92,246,.32);
      display:flex;align-items:center;justify-content:center;flex-shrink:0
    }
    .user-meta{display:flex;flex-direction:column;line-height:1.25}
    .user-meta .nm{font-size:13.5px;font-weight:600}
    .user-meta .rl{font-size:11px;color:var(--success-fg);display:flex;align-items:center;gap:5px}
    .user-meta .rl::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--success)}
    .cp-btn{
      padding:8px 13px;border:1px solid var(--border);border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;
      color:var(--text-2);background:var(--surface);transition:all .2s;white-space:nowrap
    }
    .cp-btn:hover{color:var(--primary);border-color:var(--primary);background:var(--primary-soft)}
    .logout-btn{
      padding:8px 13px;border:1px solid transparent;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;
      color:var(--danger-fg);background:var(--danger-soft);transition:all .2s;white-space:nowrap
    }
    .logout-btn:hover{background:var(--danger);color:#fff;box-shadow:0 4px 12px rgba(239,68,68,.3)}
    /* ===== 内容 ===== */
    .content{flex:1;padding:24px;overflow:auto}
    .fade{animation:fade .32s ease}
    @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
    .stat{
      background:var(--surface);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--shadow-xs);
      display:flex;align-items:center;gap:16px;border:1px solid var(--border);
      transition:transform .2s,box-shadow .2s,border-color .2s
    }
    .stat:hover{transform:translateY(-3px);box-shadow:var(--shadow);border-color:var(--border-strong)}
    .stat .ic{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
      box-shadow:0 4px 12px rgba(30,23,66,.14)}
    .stat .ic svg{width:24px;height:24px;color:#fff}
    .stat .num{font-size:27px;font-weight:700;line-height:1.15;color:var(--text);letter-spacing:-.5px;font-variant-numeric:tabular-nums}
    .stat .lbl{color:var(--text-2);font-size:13px;margin-top:3px}
    .panel{background:var(--surface);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow-xs);border:1px solid var(--border)}
    .panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap}
    .panel-head .title{font-size:15px;font-weight:700;letter-spacing:.2px;display:flex;align-items:center;gap:9px}
    .panel-head .title::before{content:"";width:3px;height:15px;border-radius:3px;background:var(--grad);flex-shrink:0}
    .panel-head .title small{display:block;font-size:12px;color:var(--text-3);font-weight:400;margin-top:2px}
    .panel-head .right{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .search{position:relative}
    .search input{
      padding:9px 13px 9px 36px;border:1px solid var(--border);border-radius:var(--radius-sm);outline:none;
      font-size:13px;width:240px;transition:all .2s;background:var(--surface-2);color:var(--text)
    }
    .search input::placeholder{color:var(--text-3)}
    .search input:hover{border-color:var(--border-strong)}
    .search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--text-3)}
    .search input:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--ring);background:var(--surface)}
    .btn-primary{
      padding:9px 15px;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-weight:600;color:#fff;
      background:var(--grad);box-shadow:0 2px 8px rgba(139,92,246,.22);
      transition:all .2s;display:flex;align-items:center;gap:6px
    }
    .btn-primary svg{width:15px;height:15px}
    .btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(139,92,246,.32);filter:brightness(1.05)}
    .btn-primary:active{transform:translateY(0);box-shadow:0 2px 6px rgba(139,92,246,.25)}
    .btn-primary:disabled{opacity:.6;cursor:not-allowed;transform:none;box-shadow:none}
    /* ===== 表格 ===== */
    .table-wrap{overflow:auto;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface)}
    table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:640px}
    thead th{position:sticky;top:0;background:var(--surface-3);color:var(--text-2);font-weight:600;font-size:12px;
      text-align:left;padding:11px 16px;border-bottom:1px solid var(--border);white-space:nowrap;letter-spacing:.3px}
    tbody td{padding:12px 16px;border-bottom:1px solid var(--border);color:var(--text)}
    tbody tr{transition:background .15s}
    tbody tr:hover td{background:var(--surface-2)}
    tbody tr:last-child td{border-bottom:none}
    .tag{padding:3px 10px;border-radius:20px;font-size:12px;font-weight:500;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
    .tag::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.85}
    .tag-on{background:var(--success-soft);color:var(--success-fg)}
    .tag-off{background:var(--danger-soft);color:var(--danger-fg)}
    .tag-warn{background:var(--warning-soft);color:var(--warning-fg)}
    .op{color:var(--primary);cursor:pointer;margin-right:14px;font-size:13px;font-weight:500;transition:opacity .15s}
    .op.del{color:var(--danger-fg)}
    .op:hover{text-decoration:underline;opacity:.85}
    .empty{text-align:center;color:var(--text-3);padding:48px 0;font-size:13.5px}
    .mono{font-family:Consolas,"SF Mono",Menlo,monospace;color:var(--text-2);font-size:12.5px}
    .cell-strong{font-weight:600;color:var(--text)}
    /* 分页器美化 */
    .pager{display:flex;align-items:center;justify-content:space-between;margin-top:16px;flex-wrap:wrap;gap:12px}
    .pager-info{font-size:13px;color:var(--text-3)}
    .pager-info b{color:var(--text);font-weight:600}
    .pager-btns{display:flex;align-items:center;gap:8px}
    .pager-btns .page-now{font-size:13px;color:var(--text-2);padding:0 6px;white-space:nowrap}
    .pager-btns .page-now b{color:var(--primary);font-size:14px}
    /* ===== 弹窗 ===== */
    .mask{position:fixed;inset:0;background:rgba(30,20,60,.5);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:50;padding:20px}
    .mask.show{display:flex;animation:fade .2s ease}
    .modal{width:440px;max-width:100%;background:var(--surface);border-radius:18px;padding:24px;animation:rise .28s cubic-bezier(.2,.8,.2,1);box-shadow:var(--shadow-lg);border:1px solid var(--border)}
    @keyframes rise{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    .modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
    .modal h3{font-size:17px;font-weight:700;letter-spacing:.2px}
    .modal .x{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-3);cursor:pointer;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;transition:all .2s}
    .modal .x:hover{color:var(--danger-fg);border-color:var(--danger);background:var(--danger-soft)}
    .modal label{display:block;font-size:12.5px;color:var(--text-2);margin:13px 0 6px;font-weight:600}
    .modal label:first-of-type{margin-top:0}
    .modal input,.modal select{
      width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13.5px;
      outline:none;transition:all .2s;background:var(--surface-2);color:var(--text)
    }
    .modal input:hover,.modal select:hover{border-color:var(--border-strong)}
    .modal input::placeholder{color:var(--text-3)}
    .modal input:focus,.modal select:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--ring);background:var(--surface)}
    .modal-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
    .btn-cancel{
      padding:9px 17px;border:1px solid var(--border);background:var(--surface);border-radius:var(--radius-sm);
      cursor:pointer;font-size:13px;color:var(--text-2);transition:all .2s
    }
    .btn-cancel:hover{background:var(--surface-2);border-color:var(--border-strong);color:var(--text)}
    .btn-danger{padding:9px 17px;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-weight:600;color:#fff;background:var(--danger);box-shadow:0 2px 8px rgba(239,68,68,.25);transition:all .2s}
    .btn-danger:hover{filter:brightness(1.06);box-shadow:0 6px 16px rgba(239,68,68,.35);transform:translateY(-1px)}
    /* ===== 系统信息 ===== */
    .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:6px}
    .info-item{padding:15px 16px;border-radius:var(--radius-sm);background:var(--surface-2);border:1px solid var(--border);transition:background .2s,border-color .2s}
    .info-item:hover{border-color:var(--border-strong);background:var(--surface-3)}
    .info-item .k{font-size:11.5px;color:var(--text-3);margin-bottom:5px;letter-spacing:.3px}
    .info-item .v{font-size:14.5px;color:var(--text);font-weight:600}
    /* ===== 网关调试 ===== */
    .gw-form{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px 14px;align-items:center;max-width:720px}
    .gw-form>label{font-size:13px;color:var(--text-2);margin:0}
    .gw-form input[type=text],.gw-form input:not([type]),.gw-form select{width:100%}
    .gw-form .gw-row{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-2)}
    .gw-out{margin-top:16px;padding:14px 16px;border-radius:var(--radius-sm);background:var(--surface-2);border:1px solid var(--border);
      font-family:Consolas,"SF Mono",Menlo,monospace;font-size:12.5px;line-height:1.65;color:var(--text-2);
      white-space:pre-wrap;word-break:break-all;max-height:360px;overflow:auto}
    /* ===== 加载骨架 ===== */
    .skeleton{background:linear-gradient(90deg,var(--surface-2) 25%,var(--surface-3) 37%,var(--surface-2) 63%);background-size:400% 100%;animation:sk 1.3s ease infinite;border-radius:8px;height:16px}
    @keyframes sk{0%{background-position:100% 0}100%{background-position:-100% 0}}
    .loading-flex{display:flex;align-items:center;justify-content:center;gap:10px;color:var(--text-3);padding:60px 0;font-size:13.5px}
    .loading-flex .spinner{width:18px;height:18px;border:2px solid var(--border-strong);border-top-color:var(--primary);border-radius:50%;animation:spin .7s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    /* ===== Toast ===== */
    .toast-wrap{position:fixed;top:20px;right:20px;z-index:100;display:flex;flex-direction:column;gap:10px;pointer-events:none}
    .toast{display:flex;align-items:center;gap:10px;min-width:240px;max-width:360px;padding:12px 16px;border-radius:11px;
      background:var(--surface);box-shadow:var(--shadow-lg);border:1px solid var(--border);border-left:3px solid var(--primary);
      animation:toastIn .32s cubic-bezier(.2,.8,.2,1);font-size:13.5px;color:var(--text);pointer-events:auto}
    .toast.success{border-left-color:var(--success)}
    .toast.error{border-left-color:var(--danger)}
    .toast.out{animation:toastOut .3s forwards}
    .toast svg{width:17px;height:17px;flex-shrink:0}
    .toast.success svg{color:var(--success)} .toast.error svg{color:var(--danger)} .toast.info svg{color:var(--primary)}
    @keyframes toastIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
    @keyframes toastOut{to{opacity:0;transform:translateX(30px)}}
    /* ===== 移动端遮罩 ===== */
    .scrim{position:fixed;inset:0;background:rgba(30,20,60,.45);z-index:25;display:none}
    .scrim.show{display:block}
    @media (max-width:880px){
      .sidebar,[data-nav="collapsed"] .sidebar{position:fixed;top:0;left:0;height:100%;width:var(--sbw);transform:translateX(-100%)}
      .sidebar.show{transform:translateX(0)}
      [data-nav="collapsed"] .sidebar .nav-txt{display:inline}
      [data-nav="collapsed"] .sidebar .brand{justify-content:flex-start;padding:20px 18px}
      [data-nav="collapsed"] .sidebar .brand-txt{opacity:1;width:auto}
      [data-nav="collapsed"] .sidebar .nav-collapse{display:flex;margin-left:auto}
      [data-nav="collapsed"] .sidebar .nav-group{display:block}
      [data-nav="collapsed"] .sidebar .nav-item{justify-content:flex-start;padding:11px 14px}
      .menu-btn{display:flex}
      .user-meta{display:none}
      .cp-btn{padding:8px 12px}
    }
    @media (max-width:560px){
      .topbar{padding:0 14px;gap:10px}
      .content{padding:14px} .logout-btn span{display:none}
      .search input{width:160px}
      .cards{gap:12px}
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <svg class="brand-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l9 4v6c0 5-3.5 9.5-9 11-5.5-1.5-9-6-9-11V6z"/><path d="M9 12l2 2 4-4"/>
        </svg>
        <div class="brand-txt">控制面板<small>ADMIN CONSOLE</small></div>
        <button class="nav-collapse" id="navCollapse" onclick="toggleNav()" title="收起导航栏" aria-label="收起导航栏">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>
      <nav class="nav" id="nav">
        <div class="nav-group">主导航</div>
        <div class="nav-item active" data-page="dashboard" title="仪表看板" onclick="switchPage('dashboard')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
          <span class="nav-txt">仪表看板</span>
        </div>
        <div class="nav-item" data-page="users" title="用户管理" onclick="switchPage('users')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg>
          <span class="nav-txt">用户管理</span>
        </div>
        <div class="nav-item" data-page="keys" title="密钥管理" onclick="switchPage('keys')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/></svg>
          <span class="nav-txt">密钥管理</span>
        </div>
        <div class="nav-item" data-page="gateway" title="中转网关" onclick="switchPage('gateway')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><circle cx="12" cy="12" r="4"/></svg>
          <span class="nav-txt">中转网关</span>
        </div>
        <div class="nav-foot">Cloudflare Workers · KV</div>
      </nav>
    </aside>
    <div class="scrim" id="scrim" onclick="closeSidebar()"></div>
    <div class="main">
      <header class="topbar">
        <div class="left">
          <button class="menu-btn" id="navToggle" onclick="toggleNav()" title="收起/展开导航栏" aria-label="收起/展开导航栏">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
          </button>
          <div>
            <h2 id="pageTitle">仪表看板</h2>
            <div class="crumb" id="pageCrumb">系统概览与统计</div>
          </div>
        </div>
        <div class="user-box">
          <button class="icon-btn" onclick="toggleTheme()" title="切换明暗主题" aria-label="切换主题">
            <svg id="themeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
          </button>
          <div class="avatar" id="avatar">A</div>
          <div class="user-meta">
            <span class="nm" id="userName">管理员</span>
            <span class="rl">在线</span>
          </div>
          <button class="cp-btn" onclick="openPwdModal()">修改密码</button>
          <button class="logout-btn" onclick="doLogout()"><span>退出后台</span></button>
        </div>
      </header>
      <main class="content" id="content"></main>
    </div>
  </div>
  <div class="mask" id="mask">
    <div class="modal">
      <div class="modal-head">
        <h3 id="modalTitle">编辑</h3>
        <button class="x" onclick="closeModal()">&times;</button>
      </div>
      <div id="modalBody"></div>
      <div class="modal-foot" id="modalFoot">
        <button class="btn-cancel" onclick="closeModal()">取消</button>
        <button class="btn-primary" id="modalSave" onclick="saveModal()">保存</button>
      </div>
    </div>
  </div>
  <div class="toast-wrap" id="toastWrap"></div>
  <script>
    let currentPage='dashboard',modalCtx={type:'',record:null};
    const TITLES={dashboard:'仪表看板',users:'用户管理',keys:'密钥管理',gateway:'中转网关'};
    const CRUMBS={dashboard:'系统概览与统计',users:'账号的新增、编辑与权限管理',keys:'API 密钥的生成与生命周期管理',gateway:'Duck.ai 上游 · 兼容 OpenAI / Anthropic / Responses 三协议'};
    const SUN='<path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="5"/>';
    const MOON='<path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/>';
    const $=id=>document.getElementById(id);
    const val=id=>$(id)?.value.trim()||'';
    const postJson=data=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});

    // ===== 主题 =====
    function syncThemeIcon(){
      var dark=document.documentElement.getAttribute('data-theme')==='dark';
      var el=document.getElementById('themeIcon');if(el)el.innerHTML=dark?SUN:MOON
    }
    function toggleTheme(){
      var dark=document.documentElement.getAttribute('data-theme')==='dark';
      if(dark){document.documentElement.removeAttribute('data-theme');try{localStorage.removeItem('theme')}catch(e){}}
      else{document.documentElement.setAttribute('data-theme','dark');try{localStorage.setItem('theme','dark')}catch(e){}}
      syncThemeIcon()
    }
    syncThemeIcon();
    function toggleSidebar(){document.getElementById('sidebar').classList.toggle('show');document.getElementById('scrim').classList.toggle('show')}
    function closeSidebar(){document.getElementById('sidebar').classList.remove('show');document.getElementById('scrim').classList.remove('show')}
    // ===== 导航栏收起 / 展开 =====
    function isNavCollapsed(){return document.documentElement.getAttribute('data-nav')==='collapsed'}
    function setNavCollapsed(v){
      try{v?localStorage.setItem('navCollapsed','1'):localStorage.removeItem('navCollapsed')}catch(e){}
      if(v)document.documentElement.setAttribute('data-nav','collapsed');
      else document.documentElement.removeAttribute('data-nav');
      var tip=v?'展开导航栏':'收起导航栏';
      ['navCollapse','navToggle'].forEach(function(id){
        var el=$(id);if(el){el.title=tip;el.setAttribute('aria-label',tip)}
      })
    }
    function toggleNav(){
      if(window.innerWidth<=880){toggleSidebar();return}
      setNavCollapsed(!isNavCollapsed())
    }
    setNavCollapsed(isNavCollapsed());

    // ===== 通用请求 =====
    async function api(url,options){
      const res=await fetch(url,options);
      if(res.status===401){location.href='/';return null}
      return await res.json()
    }
    // ===== Toast =====
    function toast(msg,type='info'){
      const wrap=$('toastWrap');
      const icons={success:'<path d="M20 6L9 17l-5-5"/>',error:'<path d="M18 6L6 18M6 6l12 12"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>'};
      const el=document.createElement('div');
      el.className='toast '+type;
      el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(icons[type]||icons.info)+'</svg><span>'+msg+'</span>';
      wrap.appendChild(el);
      setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),300)},2600)
    }

    // ===== 自定义确认框（替代原生 confirm）=====
    function confirmDialog(title,msg,okText){
      return new Promise(resolve=>{
        const m=$('mask');
        $('modalTitle').textContent=title;
        $('modalBody').innerHTML='<p style="color:var(--text-2);line-height:1.7">'+msg+'</p>';
        const foot=$('modalFoot');
        foot.innerHTML='<button class="btn-cancel" id="dlgCancel">取消</button><button class="btn-danger" id="dlgOk">'+okText+'</button>';
        foot.querySelector('#dlgCancel').onclick=()=>{closeModal();resolve(false)};
        foot.querySelector('#dlgOk').onclick=()=>{closeModal();resolve(true)};
        openModal()
      })
    }

    // ===== 导航切换 =====
    function switchPage(page){
      currentPage=page;
      document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
      $('pageTitle').textContent=TITLES[page];
      $('pageCrumb').textContent=CRUMBS[page];
      closeSidebar();
      if(page==='dashboard')renderDashboard();
      else if(page==='users')renderUsers();
      else if(page==='keys')renderKeys();
      else if(page==='gateway')renderGateway()
    }
    async function doLogout(){
      if(!await confirmDialog('退出登录','确定要退出当前账号吗？','退出'))return;
      await api('/api/logout',{method:'POST'});location.href='/'
    }

    // ===== 仪表看板 =====
    async function renderDashboard(){
      const box=$('content');box.className='content fade';
      box.innerHTML='<div class="loading-flex"><span class="spinner"></span>加载中…</div>';
      const data=(await api('/api/dashboard'))?.data;
      if(!data)return;
      $('userName').textContent=data.loginUser;
      $('avatar').textContent=data.loginUser.charAt(0).toUpperCase();
      box.innerHTML=\`
        <div class="cards">
          \${statCard('#8b5cf6,#a78bfa',data.userCount,'用户总数','M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 108 0 4 4 0 00-8 0')}
          \${statCard('#a855f7,#d946ef',data.keyCount,'密钥总数','M21 2l-2 2M11.4 11.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8z')}
          \${statCard('#d946ef,#f472b6',data.adminCount,'管理员数','M12 2l9 4v6c0 5-3.5 9.5-9 11-5.5-1.5-9-6-9-11V6z')}
        </div>
        <div class="panel" style="margin-top:22px">
          <div class="panel-head"><div class="title">系统信息<small>当前实例运行状态</small></div></div>
          <div class="info-grid">
            <div class="info-item"><div class="k">当前登录用户</div><div class="v">\${data.loginUser}</div></div>
            <div class="info-item"><div class="k">服务器时间</div><div class="v mono">\${new Date(data.serverTime).toLocaleString('zh-CN')}</div></div>
            <div class="info-item"><div class="k">运行环境</div><div class="v mono">Cloudflare Workers + KV</div></div>
          </div>
        </div>\`
    }
    function statCard(grad,num,label,path){
      return \`<div class="stat">
        <div class="ic" style="background:linear-gradient(135deg,\${grad})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="\${path}"/></svg>
        </div>
        <div><div class="num">\${num}</div><div class="lbl">\${label}</div></div>
      </div>\`
    }

    // ===== 用户管理 =====
    async function renderUsers(kw=''){
      const box=$('content');box.className='content fade';
      box.innerHTML='<div class="loading-flex"><span class="spinner"></span>加载中…</div>';
      const list=(await api('/api/users?kw='+encodeURIComponent(kw)))?.data||[];
      const rows=list.length?list.map(u=>\`
        <tr>
          <td class="cell-strong">\${u.username}</td>
          <td>\${u.email||'<span style="color:var(--text-3)">-</span>'}</td>
          <td>\${u.role}</td>
          <td><span class="tag \${u.hasPassword?'tag-on':'tag-warn'}">\${u.hasPassword?'已设置':'未设置'}</span></td>
          <td><span class="tag \${u.status==='启用'?'tag-on':'tag-off'}">\${u.status}</span></td>
          <td class="mono">\${new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
          <td>
            <span class="op" onclick='openUserModal(\${JSON.stringify(u)})'>编辑</span>
            <span class="op del" onclick="delUser('\${u.id}')">删除</span>
          </td>
        </tr>\`).join(''):'<tr><td colspan="7" class="empty">暂无用户数据</td></tr>';
      box.innerHTML=\`
        <div class="panel">
          <div class="panel-head">
            <div class="title">用户列表<small>共 \${list.length} 条记录</small></div>
            <div class="right">
              <div class="search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                <input id="userKw" placeholder="搜索账号 / 邮箱 / 角色" value="\${kw}" oninput="onUserSearch(this.value)" />
              </div>
              <button class="btn-primary" onclick="openUserModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>新增用户
              </button>
            </div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>账号</th><th>邮箱</th><th>角色</th><th>密码</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>\${rows}</tbody></table></div>
        </div>\`
    }
    let userTimer;
    function onUserSearch(v){clearTimeout(userTimer);userTimer=setTimeout(()=>renderUsers(v),300)}
    function openUserModal(record){
      modalCtx={type:'user',record:record||null};
      $('modalTitle').textContent=record?'编辑用户':'新增用户';
      const r=record||{};
      $('modalBody').innerHTML=\`
        <label for="f_username">账号</label><input id="f_username" value="\${r.username||''}" placeholder="请输入账号" />
        <label for="f_password">密码</label><input id="f_password" type="password" value="" placeholder="\${record?'留空则不修改':'请输入密码'}" autocomplete="new-password" />
        <label for="f_email">邮箱</label><input id="f_email" value="\${r.email||''}" placeholder="请输入邮箱" />
        <label for="f_role">角色</label><select id="f_role">
          <option \${r.role==='管理员'?'selected':''}>管理员</option>
          <option \${r.role==='普通用户'||!r.role?'selected':''}>普通用户</option>
        </select>
        <label for="f_status">状态</label><select id="f_status">
          <option \${r.status==='启用'||!r.status?'selected':''}>启用</option>
          <option \${r.status==='禁用'?'selected':''}>禁用</option>
        </select>\`;
      showSaveFoot();openModal()
    }
    async function delUser(id){
      if(!await confirmDialog('删除用户','确定删除该用户吗？此操作不可恢复。','删除'))return;
      await api('/api/users/'+id,{method:'DELETE'});toast('用户已删除','success');renderUsers($('userKw')?.value||'')
    }

    // ===== 密钥管理 =====
    async function renderKeys(kw=''){
      const box=$('content');box.className='content fade';
      box.innerHTML='<div class="loading-flex"><span class="spinner"></span>加载中…</div>';
      const list=(await api('/api/keys?kw='+encodeURIComponent(kw)))?.data||[];
      const rows=list.length?list.map(k=>\`
        <tr>
          <td class="cell-strong">\${k.name}</td>
          <td class="mono">\${maskKey(k.value)}</td>
          <td>\${k.description||'<span style="color:var(--text-3)">-</span>'}</td>
          <td><span class="tag \${k.status==='有效'?'tag-on':'tag-off'}">\${k.status}</span></td>
          <td class="mono">\${new Date(k.createdAt).toLocaleDateString('zh-CN')}</td>
          <td>
            <span class="op" onclick='openKeyModal(\${JSON.stringify(k)})'>编辑</span>
            <span class="op del" onclick="delKey('\${k.id}')">删除</span>
          </td>
        </tr>\`).join(''):'<tr><td colspan="6" class="empty">暂无密钥数据</td></tr>';
      box.innerHTML=\`
        <div class="panel">
          <div class="panel-head">
            <div class="title">密钥列表<small>共 \${list.length} 条记录</small></div>
            <div class="right">
              <div class="search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                <input id="keyKw" placeholder="搜索名称 / 描述" value="\${kw}" oninput="onKeySearch(this.value)" />
              </div>
              <button class="btn-primary" onclick="openKeyModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>新增密钥
              </button>
            </div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>名称</th><th>密钥</th><th>描述</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>\${rows}</tbody></table></div>
        </div>\`
    }
    function maskKey(v){return v&&v.length>12?v.slice(0,6)+'••••••'+v.slice(-4):v}
    let keyTimer;
    function onKeySearch(v){clearTimeout(keyTimer);keyTimer=setTimeout(()=>renderKeys(v),300)}
    function openKeyModal(record){
      modalCtx={type:'key',record:record||null};
      $('modalTitle').textContent=record?'编辑密钥':'新增密钥';
      const r=record||{};
      $('modalBody').innerHTML=\`
        <label for="f_name">名称</label><input id="f_name" value="\${r.name||''}" placeholder="请输入密钥名称" />
        <label for="f_value">密钥值（留空自动生成）</label><input id="f_value" value="\${r.value||''}" placeholder="sk-xxxx" />
        <label for="f_description">描述</label><input id="f_description" value="\${r.description||''}" placeholder="用途描述" />
        <label for="f_status">状态</label><select id="f_status">
          <option \${r.status==='有效'||!r.status?'selected':''}>有效</option>
          <option \${r.status==='禁用'?'selected':''}>禁用</option>
        </select>\`;
      showSaveFoot();openModal()
    }
    async function delKey(id){
      if(!await confirmDialog('删除密钥','确定删除该密钥吗？此操作不可恢复。','删除'))return;
      await api('/api/keys/'+id,{method:'DELETE'});toast('密钥已删除','success');renderKeys($('keyKw')?.value||'')
    }

    // ===== 中转网关 =====
    async function renderGateway(){
      const box=$('content');box.className='content fade';
      box.innerHTML='<div class="loading-flex"><span class="spinner"></span>加载中…</div>';
      const data=(await api('/api/gateway/status'))?.data;
      if(!data){box.innerHTML='<div class="panel">网关状态读取失败，请稍后重试</div>';return}
      const keys=(await api('/api/keys'))?.data||[];
      const usable=keys.filter(k=>k.status!=='禁用');
      const keyOpts=usable.length
        ? usable.map(k=>\`<option value="\${k.value}">\${k.name||k.id} · \${maskKey(k.value)}</option>\`).join('')
        : '<option value="">后台还没有可用密钥，请先到「密钥管理」生成</option>';
      const endpoints=[
        ['POST','/v1/chat/completions','OpenAI Chat Completions（流式 / 非流式）'],
        ['POST','/v1/messages','Anthropic Messages（流式 / 非流式）'],
        ['POST','/v1/messages/count_tokens','Anthropic token 估算（不请求上游）'],
        ['POST','/v1/responses','OpenAI Responses（流式 / 非流式）'],
        ['GET','/v1/models','模型目录'],
        ['GET','/health','健康检查（无需密钥）']
      ];
      const epRows=endpoints.map(function(e){
        return \`<tr>
          <td><span class="tag tag-on">\${e[0]}</span></td>
          <td class="mono">\${e[1]}</td>
          <td>\${e[2]}</td>
          <td><span class="op" onclick="gwCopy('\${e[1]}')">复制地址</span></td>
        </tr>\`
      }).join('');
      // 模型目录：把 id 原样展示出来（之前只显示数量，用户拿不到可用模型名），
      // 并按实测结论标出「可用 / 受限 / 封禁」。
      const models=data.models||[];
      const okCount=models.filter(function(m){return m.state==='ok'}).length;
      const stateTag={ok:['tag-on','可用'],restricted:['tag-off','受限'],banned:['tag-off','封禁'],unknown:['tag-warn','未实测']};
      const modelRows=models.length?models.map(function(m){
        const isDefault=m.id===data.defaultModel;
        const st=stateTag[m.state]||stateTag.unknown;
        return \`<tr data-model="\${m.id}">
          <td class="cell-strong mono">\${m.id}</td>
          <td><span class="tag tag-on">\${m.ownedBy||'duck.ai'}</span></td>
          <td><span class="tag \${st[0]}">\${st[1]}</span>\${isDefault?' <span class="tag tag-on">默认</span>':''}</td>
          <td style="color:var(--text-2)">\${m.note||''}</td>
          <td>
            <span class="op" onclick="gwCopyText('\${m.id}')">复制 ID</span>
            <span class="op" onclick="gwUseModel('\${m.id}')">用于调试</span>
          </td>
        </tr>\`
      }).join(''):'<tr><td colspan="5" class="empty">上游未返回模型目录，请点右上角刷新状态重试</td></tr>';
      const modelOpts=models.length
        ? models.map(function(m){return \`<option value="\${m.id}"\${m.id===data.defaultModel?' selected':''}>\${m.id}\${m.state==='ok'?'':'（'+(stateTag[m.state]||stateTag.unknown)[1]+'）'}</option>\`}).join('')
        : \`<option value="\${data.defaultModel}">\${data.defaultModel}</option>\`;
      box.innerHTML=\`
        <div class="panel">
          <div class="panel-head">
            <div class="title">网关概览<small>上游 duck.ai · 与后台共用同一个 Worker 与 KV</small></div>
            <div class="right"><button class="btn-primary" onclick="renderGateway()">刷新状态</button></div>
          </div>
          <div class="info-grid">
            <div class="info-item"><div class="k">Base URL</div><div class="v mono">\${data.baseUrl}/v1</div></div>
            <div class="info-item"><div class="k">上游状态</div><div class="v">\${data.healthy?'<span class="tag tag-on">正常</span>':'<span class="tag tag-off">异常</span>'}</div></div>
            <div class="info-item"><div class="k">默认模型</div><div class="v mono">\${data.defaultModel}</div></div>
            <div class="info-item"><div class="k">可用模型</div><div class="v">\${okCount} / \${models.length} 个</div></div>
          </div>
          \${data.error?\`<p style="margin-top:14px;font-size:13px;color:var(--danger-fg)">上游探测失败：\${data.error}</p>\`:''}
        </div>
        <div class="panel" style="margin-top:22px">
          <div class="panel-head">
            <div class="title">可用模型<small>共 \${models.length} 个，其中 \${okCount} 个实测可用 · 请求体里的 model 字段填下表的 ID</small></div>
            <div class="right">
              <div class="search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                <input id="gwModelKw" placeholder="筛选模型 ID / 提供方" oninput="gwFilterModels(this.value)" />
              </div>
              <button class="btn-primary" onclick="gwCopyModels()">复制全部 ID</button>
            </div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>模型 ID</th><th>提供方</th><th>状态</th><th>说明</th><th>操作</th></tr></thead><tbody id="gwModelBody">\${modelRows}</tbody></table></div>
          <p style="margin-top:12px;font-size:12.5px;color:var(--text-3);line-height:1.7">
            状态为 <b>实测结论</b>（2026-10-19 逐模型单发一次请求），上游策略会变；
            带 <code class="mono">tinfoil/</code> 前缀的 ID 要原样传入。
            日常建议用 <code class="mono">gpt-6-luna</code>；<code class="mono">gpt-5.6-terra / gpt-5.6-sol</code> 目前需登录或受区域限制。
          </p>
        </div>
        <div class="panel" style="margin-top:22px">
          <div class="panel-head"><div class="title">接口列表<small>鉴权使用「密钥管理」中状态为有效的密钥</small></div></div>
          <div class="table-wrap"><table><thead><tr><th>方法</th><th>路径</th><th>说明</th><th>操作</th></tr></thead><tbody>\${epRows}</tbody></table></div>
        </div>
        <div class="panel" style="margin-top:22px">
          <div class="panel-head"><div class="title">在线调试<small>用真实密钥发起一次真实请求</small></div></div>
          <div class="gw-form">
            <label>密钥</label><select id="gwKey">\${keyOpts}</select>
            <label>模型</label><select id="gwModel">\${modelOpts}</select>
            <label>协议</label><select id="gwProto">
              <option value="openai">OpenAI · /v1/chat/completions</option>
              <option value="anthropic">Anthropic · /v1/messages</option>
              <option value="responses">Responses · /v1/responses</option>
            </select>
            <label>提示词</label><input id="gwPrompt" value="只回复两个字：可以" />
            <label>选项</label><div class="gw-row"><input type="checkbox" id="gwStream" /> 流式输出</div>
          </div>
          <div style="margin-top:16px"><button class="btn-primary" onclick="gwSend()">发送请求</button></div>
          <pre id="gwOut" class="gw-out">等待发送…</pre>
        </div>\`;
    }

    function gwCopy(path){
      const text=location.origin+path;
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(function(){toast('已复制：'+text,'success')}).catch(function(){toast(text,'info')})
      }else{toast(text,'info')}
    }

    function gwCopyRaw(text,label){
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(function(){toast('已复制'+(label?'：'+label:''),'success')}).catch(function(){toast(text,'info')})
      }else{toast(text,'info')}
    }

    function gwCopyText(id){gwCopyRaw(id,id)}

    function gwCopyModels(){
      const rows=[].slice.call(document.querySelectorAll('#gwModelBody tr[data-model]')).filter(function(r){return r.style.display!=='none'});
      if(!rows.length){toast('暂无可复制的模型','error');return}
      const ids=rows.map(function(r){return r.getAttribute('data-model')});
      gwCopyRaw(ids.join('\\n'),ids.length+' 个模型 ID');
    }

    function gwFilterModels(kw){
      const q=(kw||'').trim().toLowerCase();
      [].slice.call(document.querySelectorAll('#gwModelBody tr[data-model]')).forEach(function(tr){
        const hit=!q||tr.getAttribute('data-model').toLowerCase().indexOf(q)>=0||tr.textContent.toLowerCase().indexOf(q)>=0;
        tr.style.display=hit?'':'none';
      });
    }

    function gwUseModel(id){
      const sel=$('gwModel');
      if(sel)sel.value=id;
      toast('调试模型已切换为 '+id,'success');
      const out=$('gwOut');
      if(out)out.scrollIntoView({behavior:'smooth',block:'center'});
    }

    async function gwSend(){
      const keySel=$('gwKey');
      const key=keySel?keySel.value:'';
      const protoSel=$('gwProto');
      const proto=protoSel?protoSel.value:'openai';
      const modelSel=$('gwModel');
      const model=modelSel?modelSel.value:'';
      const prompt=val('gwPrompt')||'只回复两个字：可以';
      const stream=!!$('gwStream')?.checked;
      const out=$('gwOut');
      if(!key){toast('请先在「密钥管理」生成一个有效密钥','error');return}
      out.textContent='请求中…';
      const t0=Date.now();
      let url='/v1/chat/completions',body;
      if(proto==='anthropic'){url='/v1/messages';body={model:model,max_tokens:512,messages:[{role:'user',content:prompt}],stream}}
      else if(proto==='responses'){url='/v1/responses';body={model:model,input:prompt,stream}}
      else{body={model:model,messages:[{role:'user',content:prompt}],stream}}
      try{
        const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key,'x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify(body)});
        const text=await res.text();
        out.textContent='HTTP '+res.status+' · '+(Date.now()-t0)+'ms\\n\\n'+(text.length>6000?text.slice(0,6000)+'\\n…（已截断，共 '+text.length+' 字符）':text);
      }catch(e){out.textContent='请求失败：'+(e&&e.message?e.message:e)}
    }

    // ===== 通用弹窗 =====
    function openModal(){$('mask').classList.add('show')}
    function closeModal(){
      $('mask').classList.remove('show');
      const foot=$('modalFoot');foot.innerHTML='<button class="btn-cancel" onclick="closeModal()">取消</button><button class="btn-primary" id="modalSave" onclick="saveModal()">保存</button>'
    }
    function showSaveFoot(){
      $('modalFoot').innerHTML='<button class="btn-cancel" onclick="closeModal()">取消</button><button class="btn-primary" onclick="saveModal()">保存</button>'
    }
    function openPwdModal(){
      modalCtx={type:'password',record:null};
      $('modalTitle').textContent='修改密码';
      $('modalBody').innerHTML=\`
        <label for="f_old">原密码</label><input id="f_old" type="password" placeholder="请输入当前密码" autocomplete="current-password" />
        <label for="f_new">新密码（至少 6 位）</label><input id="f_new" type="password" placeholder="请输入新密码" autocomplete="new-password" />
        <label for="f_confirm">确认新密码</label><input id="f_confirm" type="password" placeholder="请再次输入新密码" autocomplete="new-password" />\`;
      showSaveFoot();openModal()
    }
    async function saveModal(){
      const{type,record}=modalCtx;
      if(type==='password'){
        const o=val('f_old'),n=val('f_new'),c=val('f_confirm');
        if(!o){toast('请输入原密码','error');return}
        if(n.length<6){toast('新密码至少 6 位','error');return}
        if(n!==c){toast('两次输入的新密码不一致','error');return}
        const btn=$('modalSave');if(btn){btn.disabled=true;btn.textContent='保存中…'}
        const res=await api('/api/change-password',postJson({oldPassword:o,newPassword:n}));
        if(res?.ok){toast('密码修改成功','success');closeModal()}
        else toast(res?.msg||'修改失败','error')
        if(btn)btn.disabled=false,$('modalSave').textContent='保存'
        return
      }
      let payload;
      if(type==='user'){
        payload={username:val('f_username'),password:val('f_password'),email:val('f_email'),role:val('f_role'),status:val('f_status')};
        if(!payload.username){toast('请输入账号','error');return}
        if(record){payload.id=record.id;payload.createdAt=record.createdAt}
        await api('/api/users',postJson(payload));
        toast(record?'用户已更新':'用户已创建','success');closeModal();renderUsers($('userKw')?.value||'')
      }else{
        payload={name:val('f_name'),value:val('f_value'),description:val('f_description'),status:val('f_status')};
        if(!payload.name){toast('请输入名称','error');return}
        if(record){payload.id=record.id;payload.createdAt=record.createdAt}
        await api('/api/keys',postJson(payload));
        toast(record?'密钥已更新':'密钥已创建','success');closeModal();renderKeys($('keyKw')?.value||'')
      }
    }
    $('mask').addEventListener('click',e=>{if(e.target.id==='mask')closeModal()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
    renderDashboard();
  </script>
</body>
</html>`

/** favicon SVG（盾牌图标） */
export const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/>
      <stop offset="1" stop-color="#d946ef"/>
    </linearGradient>
  </defs>
  <path fill="url(#g)" d="M32 4l22 8v16c0 14-9.4 26.8-22 32C19.4 54.8 10 42 10 28V12z"/>
  <path fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M22 33l7 7 14-16"/>
</svg>`
