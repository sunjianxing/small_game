// 躲避方块大挑战 — Canvas 版本（炫彩科技风）
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: true });
  const W = canvas.width, H = canvas.height;

  // UI elements
  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('high');
  const overlay = document.getElementById('overlay');
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');

  // State
  let player = { x: W/2, y: H - 90, r: 20, velX: 0 };
  let obstacles = [], stars = [], particles = [];
  let spawnTimer = 0, starTimer = 0, spawnInterval = 0.9, timeAlive = 0;
  let score = 0, highscore = parseInt(localStorage.getItem('dodge_high') || '0', 10);
  let started = false, paused = false, gameOver = false, lastTs = null;
  let useMouse = false, mouseX = player.x;

  highEl.textContent = highscore;

  const PLAYER_SPEED = 7.5;

  function clamp(v,a,b){return Math.max(a, Math.min(b, v));}
  function rand(a,b){return a + Math.random()*(b-a);}

  // neon gradient background
  function drawGradient(){
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, '#081025');
    g.addColorStop(1, '#071130');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // subtle grid lines
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#9fe8e0';
    for(let i=0;i<W;i+=60) ctx.fillRect(i,0,1,H);
    ctx.restore();
  }

  function spawnObstacle(difficulty){
    const w = Math.floor(rand(30,120));
    const h = Math.floor(rand(18,40));
    const x = clamp(rand(w/2, W - w/2), w/2, W - w/2);
    const speed = rand(140, 250) * difficulty;
    obstacles.push({x, w, h, y: -h, speed, hue: Math.floor(rand(150,320))});
  }

  function spawnStar(){
    stars.push({x: rand(30, W-30), y: -30, speed: rand(120,180)});
  }

  function addParticles(x,y,color,count=18,spread=120){
    for(let i=0;i<count;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = rand(40, spread);
      particles.push({
        x, y,
        vx: Math.cos(ang)*sp,
        vy: Math.sin(ang)*sp,
        life: rand(0.3,0.9),
        maxLife: rand(0.4,1),
        size: rand(1.5,5),
        color
      });
    }
    if(particles.length>1200) particles.splice(0, particles.length-1200);
  }

  function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr){
    const nx = clamp(cx, rx, rx+rw);
    const ny = clamp(cy, ry, ry+rh);
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  // draw neon player
  function drawPlayer(){
    // glow
    ctx.save();
    const grad = ctx.createRadialGradient(player.x-6, player.y-8, 2, player.x, player.y, player.r*2.8);
    grad.addColorStop(0, 'rgba(0,255,234,0.9)');
    grad.addColorStop(0.3, 'rgba(122,0,255,0.6)');
    grad.addColorStop(1, 'rgba(8,12,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r*2.6, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // body
    ctx.fillStyle = '#f6fbff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI*2);
    ctx.fill();

    // rim
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,255,234,0.9)';
    ctx.stroke();
  }

  function drawObstacle(o){
    // neon rectangle with gradient
    const x = o.x - o.w/2, y = o.y;
    const grad = ctx.createLinearGradient(x, y, x + o.w, y + o.h);
    grad.addColorStop(0, `hsla(${o.hue},90%,55%,0.95)`);
    grad.addColorStop(1, `hsla(${(o.hue+60)%360},80%,45%,0.95)`);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, o.w, o.h, 6, true, false);
    // neon stroke
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.stroke();
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    if(r===undefined) r=6;
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    if(fill) ctx.fill();
    if(stroke) ctx.stroke();
  }

  function drawStar(s){
    ctx.save();
    ctx.fillStyle = 'rgba(255,215,80,0.98)';
    ctx.beginPath();
    const cx = s.x, cy = s.y;
    for(let i=0;i<5;i++){
      const ang = i*(2*Math.PI/5) - Math.PI/2;
      const ang2 = ang + Math.PI/5;
      ctx.lineTo(cx + Math.cos(ang)*8, cy + Math.sin(ang)*8);
      ctx.lineTo(cx + Math.cos(ang2)*4, cy + Math.sin(ang2)*4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(){
    for(let p of particles){
      const a = clamp(p.life/p.maxLife, 0,1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.2, p.size*a), 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function updateParticles(dt){
    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
      if(p.life <= 0) particles.splice(i,1);
    }
  }

  function showOverlay(title, subtitle){
    overlay.style.pointerEvents = 'auto';
    overlay.innerHTML = '<div style="text-align:center"><div style="font-size:34px;font-weight:700;margin-bottom:6px">'+title+'</div><div style="opacity:0.95">'+subtitle+'</div></div>';
  }

  function showPauseOverlay(isPaused){
    if(isPaused) {
      overlay.style.pointerEvents = 'auto';
      overlay.innerHTML = '<div style="text-align:center"><div style="font-size:32px;font-weight:700">PAUSED</div><div style="margin-top:8px">按 Space / P 继续</div></div>';
    } else {
      overlay.style.pointerEvents = 'none';
      overlay.innerHTML = '';
    }
  }

  function gameOverOverlay(){
    overlay.style.pointerEvents = 'auto';
    overlay.innerHTML = '<div style="text-align:center"><div style="font-size:34px;font-weight:700">GAME OVER</div><div style="margin-top:8px">得分：'+Math.floor(score)+' · 高分：'+highscore+'</div><div style="margin-top:10px">按 Enter 或 点击 开始 重玩</div></div>';
  }

  // main loop
  function step(ts){
    if(!lastTs) lastTs = ts;
    let dt = (ts - lastTs)/1000; lastTs = ts;
    if(dt > 0.05) dt = 0.05;

    if(!paused && started && !gameOver){
      timeAlive += dt;
      score += dt * 1.7;
      const difficulty = 1 + (timeAlive / 25);
      spawnInterval = Math.max(0.28, 0.9 - difficulty * 0.14);

      spawnTimer += dt;
      if(spawnTimer > spawnInterval){
        spawnTimer = 0;
        if(Math.random() < Math.min(0.35, difficulty*0.06)){
          const clusters = Math.floor(rand(2,4));
          const basex = rand(120, W-120);
          for(let i=0;i<clusters;i++){
            const w = Math.floor(rand(30,120));
            const h = Math.floor(rand(18,40));
            const x = clamp(basex + rand(-140,140), w/2, W-w/2);
            const speed = rand(140,250) * difficulty * rand(0.9,1.4);
            obstacles.push({x, w, h, y:-h, speed, hue: Math.floor(rand(150,320))});
          }
        } else {
          spawnObstacle(difficulty);
        }
      }

      starTimer += dt;
      if(starTimer > 3.0){ starTimer = 0; if(Math.random() < 0.6) spawnStar(); }

      // player movement
      if(useMouse){
        const desired = (mouseX - player.x) * 10;
        player.velX += (desired - player.velX) * Math.min(1, dt * 12);
      } else {
        player.velX *= (1 - Math.min(1, dt * 10));
      }
      const maxSpeed = PLAYER_SPEED * 60;
      player.velX = clamp(player.velX, -maxSpeed, maxSpeed);
      player.x += player.velX * dt;
      player.x = clamp(player.x, player.r, W - player.r);

      // update obstacles
      for(let i=obstacles.length-1;i>=0;i--){
        const o = obstacles[i];
        o.y += o.speed * dt;
        if(o.y > H + 50){ obstacles.splice(i,1); score += 0.6; }
        else if(rectCircleCollide(o.x - o.w/2, o.y, o.w, o.h, player.x, player.y, player.r)){
          addParticles(player.x, player.y, 'rgba(255,80,60,0.95)', 40, 220);
          gameOver = true; started = true;
          if(Math.floor(score) > highscore){ highscore = Math.floor(score); localStorage.setItem('dodge_high', highscore); highEl.textContent = highscore; }
          gameOverOverlay();
        }
      }

      // update stars
      for(let i=stars.length-1;i>=0;i--){
        const s = stars[i];
        s.y += s.speed * dt;
        const dx = s.x - player.x, dy = s.y - player.y;
        if(s.y > H + 20) stars.splice(i,1);
        else if(dx*dx + dy*dy <= (player.r + 8)*(player.r + 8)){
          score += 7;
          addParticles(s.x, s.y, 'rgba(255,220,80,0.95)', 24, 160);
          stars.splice(i,1);
        }
      }

      updateParticles(dt);
    }

    // draw everything
    drawGradient();
    // stars
    for(let s of stars) drawStar(s);
    // obstacles
    for(let o of obstacles) drawObstacle(o);
    // player
    drawPlayer();
    // particles
    drawParticles();

    scoreEl.textContent = Math.floor(score);

    if(!started && !gameOver){
      showOverlay('躲避方块大挑战','Avoid blocks · Collect stars · Press Enter / 点击 开始');
    }

    if(!gameOver) requestAnimationFrame(step);
  }

  // input
  window.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowLeft' || e.key === 'a') player.velX = -PLAYER_SPEED * 60;
    if(e.key === 'ArrowRight' || e.key === 'd') player.velX = PLAYER_SPEED * 60;
    if(e.key === ' ' || e.key.toLowerCase() === 'p'){ if(started && !gameOver){ paused = !paused; showPauseOverlay(paused); } }
    if(e.key === 'Enter'){ if(!started || gameOver){ startGame(); } else if(gameOver){ startGame(); } }
  });
  window.addEventListener('keyup', (e)=>{
    if(e.key === 'ArrowLeft' || e.key === 'a') player.velX = 0;
    if(e.key === 'ArrowRight' || e.key === 'd') player.velX = 0;
  });

  canvas.addEventListener('mousedown', (e)=>{
    useMouse = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
  });
  canvas.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
  });
  window.addEventListener('mouseup', ()=> useMouse = false);

  btnStart.addEventListener('click', ()=> startGame());
  btnPause.addEventListener('click', ()=> { if(!started) return; paused = !paused; showPauseOverlay(paused); });

  function reset(){
    player.x = W/2; player.velX = 0;
    obstacles = []; stars = []; particles = [];
    spawnTimer = 0; starTimer = 0; spawnInterval = 0.9; timeAlive = 0;
    score = 0; gameOver = false; paused = false; started = false; lastTs = null;
    overlay.innerHTML = '';
    overlay.style.pointerEvents = 'none';
  }

  function startGame(){
    reset();
    started = true; paused = false; gameOver = false;
    overlay.style.pointerEvents = 'none'; overlay.innerHTML = '';
    lastTs = null;
    requestAnimationFrame(step);
  }

  // idle bob
  let idle = 0;
  setInterval(()=>{ if(!started){ idle += 0.04; player.x += Math.sin(idle)*0.6; } }, 30);

  // initial overlay
  showOverlay('躲避方块大挑战','Avoid blocks · Collect stars · Press Enter / 点击 开始');

})();
