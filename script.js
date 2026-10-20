(() => {
  'use strict';
  const COLS = 10, ROWS = 20, ROUND_SECONDS = 300;
  const TYPES = [
    { cells: [[0,0],[0,1],[0,2],[0,3]], color: '#42c8ec' },
    { cells: [[0,1],[1,0],[1,1],[1,2]], color: '#aa7af4' },
    { cells: [[0,0],[0,1],[1,0],[1,1]], color: '#f5c451' },
    { cells: [[0,0],[1,0],[2,0],[2,1]], color: '#fa8d5a' },
    { cells: [[0,1],[1,1],[2,0],[2,1]], color: '#58d6ac' },
    { cells: [[0,1],[0,2],[1,0],[1,1]], color: '#f16c84' },
    { cells: [[0,0],[0,1],[1,1],[1,2]], color: '#f08bd0' }
  ];
  const boardEl = document.getElementById('board');
  const cellEls = [];
  const $ = id => document.getElementById(id);
  let grid, current, next, score = 0, best = 0, running = false, ended = false;
  let gravityTimer, clockTimer, lastDrop = 0, startedAt = 0;
  try { best = Number(localStorage.getItem('blockBloomBest')) || 0; } catch (_) {}
  $('best-score').textContent = best.toLocaleString('id-ID');

  for (let i = 0; i < COLS * ROWS; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell'; cell.setAttribute('role', 'gridcell');
    boardEl.appendChild(cell); cellEls.push(cell);
  }

  function randomPiece() {
    const item = TYPES[Math.floor(Math.random() * TYPES.length)];
    return { cells: item.cells.map(([r,c]) => [r,c]), color: item.color };
  }
  function startGame() {
    clearInterval(gravityTimer); clearInterval(clockTimer);
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    score = 0; ended = false; running = true;
    current = randomPiece(); next = randomPiece();
    startedAt = Date.now(); lastDrop = startedAt;
    $('start-overlay').hidden = true; $('game-over-modal').hidden = true;
    updateScore(); render(); updateTimer();
    gravityTimer = setInterval(tick, 45);
    clockTimer = setInterval(updateTimer, 200);
  }
  function positionValid(piece, row, col) {
    return piece.cells.every(([r,c]) => row+r >= 0 && row+r < ROWS && col+c >= 0 && col+c < COLS && !grid[row+r][col+c]);
  }
  function ghostRow() {
    let row = current.row;
    while (positionValid(current, row + 1, current.col)) row++;
    return row;
  }
  function render() {
    const display = grid.map(row => row.slice());
    if (current) {
      const shadow = ghostRow();
      current.cells.forEach(([r,c]) => { if (shadow+r >= 0) display[shadow+r][current.col+c] ||= { color: current.color, ghost: true }; });
      current.cells.forEach(([r,c]) => { if (current.row+r >= 0) display[current.row+r][current.col+c] = { color: current.color }; });
    }
    display.forEach((row, r) => row.forEach((value, c) => {
      const el = cellEls[r*COLS+c];
      el.classList.toggle('filled', !!value && !value.ghost);
      el.classList.toggle('ghost', !!value && !!value.ghost);
      if (value) el.style.setProperty('--block-color', value.color); else el.style.removeProperty('--block-color');
    }));
    const preview = $('next-piece'); preview.innerHTML = '';
    const minR = Math.min(...next.cells.map(p=>p[0])), minC = Math.min(...next.cells.map(p=>p[1]));
    next.cells.forEach(([r,c]) => {
      const block = document.createElement('i'); block.className = 'next-block';
      block.style.gridRow = r-minR+1; block.style.gridColumn = c-minC+1;
      block.style.setProperty('--block-color', next.color); preview.appendChild(block);
    });
  }
  function updateScore() {
    $('current-score').textContent = score.toLocaleString('id-ID');
    if (score > best) {
      best = score; $('best-score').textContent = best.toLocaleString('id-ID');
      try { localStorage.setItem('blockBloomBest', String(best)); } catch (_) {}
      $('score-message').textContent = 'Rekor baru! Teruskan!';
    } else $('score-message').textContent = score ? 'Bagus! Teruskan!' : 'Ayo mulai susun!';
  }
  function updateTimer() {
    const left = Math.max(0, ROUND_SECONDS - Math.floor((Date.now()-startedAt)/1000));
    const mins = Math.floor(left/60), secs = left%60;
    $('timer').textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    $('timer-progress').style.width = `${left/ROUND_SECONDS*100}%`;
    $('timer-card')?.classList.toggle('urgent', left <= 30);
    document.querySelector('.timer-card').classList.toggle('urgent', left <= 30);
    if (!left && running) finishGame('time');
  }
  function tick() {
    if (!running) return;
    const elapsed = Date.now()-startedAt;
    const interval = Math.max(105, 720 - Math.floor(elapsed/15000)*28);
    if (Date.now()-lastDrop >= interval) { lastDrop = Date.now(); stepDown(); }
  }
  function stepDown() {
    if (positionValid(current, current.row+1, current.col)) { current.row++; render(); }
    else lockPiece();
  }
  function lockPiece() {
    current.cells.forEach(([r,c]) => { if (current.row+r >= 0) grid[current.row+r][current.col+c] = current.color; });
    let cleared = 0;
    for (let r=ROWS-1; r>=0; r--) {
      if (grid[r].every(Boolean)) { grid.splice(r,1); grid.unshift(Array(COLS).fill(null)); cleared++; r++; }
    }
    score += cleared ? cleared*100 + Math.max(0,cleared-1)*50 : 0;
    if (!cleared) score += 10;
    updateScore();
    current = next; current.row = -Math.min(...current.cells.map(p=>p[0])); current.col = Math.floor((COLS-Math.max(...current.cells.map(p=>p[1]))-1)/2);
    next = randomPiece(); lastDrop = Date.now(); render();
    if (!positionValid(current,current.row,current.col)) finishGame('top');
  }
  function move(dx,dy=0) {
    if (!running) return;
    if (positionValid(current,current.row+dy,current.col+dx)) { current.col += dx; current.row += dy; render(); }
    else if (dy > 0) lockPiece();
  }
  function rotate() {
    if (!running) return;
    const rotated = current.cells.map(([r,c])=>[c,-r]);
    const minR = Math.min(...rotated.map(p=>p[0])), minC = Math.min(...rotated.map(p=>p[1]));
    const shape = rotated.map(([r,c])=>[r-minR,c-minC]);
    for (const kick of [0,-1,1,-2,2]) {
      const candidate = { ...current, cells: shape, col: current.col+kick };
      if (positionValid(candidate,candidate.row,candidate.col)) { current = candidate; render(); return; }
    }
  }
  function hardDrop() {
    if (!running) return;
    let distance = 0;
    while (positionValid(current,current.row+1,current.col)) { current.row++; distance++; }
    score += distance*2; lockPiece();
  }
  function finishGame(reason) {
    if (ended) return;
    ended = true; running = false; clearInterval(gravityTimer); clearInterval(clockTimer);
    $('modal-kicker').textContent = reason === 'time' ? 'WAKTU HABIS' : 'PERMAINAN SELESAI';
    $('modal-copy').textContent = reason === 'time' ? 'Waktu 5 menitmu sudah selesai. Main lagi?' : 'Blok mencapai puncak papan. Coba strategi baru!';
    $('final-score').textContent = score.toLocaleString('id-ID'); $('final-best').textContent = best.toLocaleString('id-ID');
    $('game-over-modal').hidden = false; $('play-again').focus();
  }
  $('start-button').addEventListener('click', startGame);
  $('restart').addEventListener('click', startGame);
  $('play-again').addEventListener('click', startGame);
  document.querySelectorAll('.mobile-controls button').forEach(button => button.addEventListener('click', () => {
    const actions = { left:()=>move(-1), right:()=>move(1), down:()=>move(0,1), rotate, drop:hardDrop };
    actions[button.dataset.action]();
  }));
  document.addEventListener('keydown', event => {
    const actions = { ArrowLeft:()=>move(-1), ArrowRight:()=>move(1), ArrowDown:()=>move(0,1), ArrowUp:rotate, ' ':hardDrop };
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
    if ((event.key === 'Enter' || event.key === ' ') && !running && !ended) { event.preventDefault(); startGame(); }
  });
  $('timer').textContent = '05:00';
  $('start-overlay').hidden = false;
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  current = null; next = randomPiece(); render();
})();
