const $ = (id) => document.getElementById(id);
let ws = null, local = null, state = null, selected = null;
const NAMES = { r: 'Red', b: 'Black' };
const isWeb = location.protocol.startsWith('http');

// --- Online mode ---
function connect(host, room) {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + host);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room }));
  ws.onerror = () => alert('Could not connect to ' + host);
  ws.onclose = () => ($('status').textContent = 'Disconnected from server.');
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'joined') {
      $('lobby').style.display = 'none';
      if (isWeb) history.replaceState(null, '', '?room=' + msg.room);
      $('info').innerHTML = `Room <b>${msg.room}</b> — you are <b>${NAMES[msg.color]}</b>. Give your friend the room code.`;
    } else if (msg.type === 'state') {
      state = msg;
      if (state.game.mustContinue) selected = state.game.mustContinue;
      render();
    } else if (msg.type === 'error') alert(msg.message);
  };
}

// --- Offline pass & play mode (same rules engine, runs on device) ---
function localUpdate() {
  state = { you: local.turn, game: local, moves: legalMoves(local), opponentConnected: true, local: true };
  if (local.mustContinue) selected = local.mustContinue;
  render();
}
function startLocal() {
  local = newGame();
  $('lobby').style.display = 'none';
  $('info').textContent = 'Pass & Play — hand the phone over after each turn.';
  localUpdate();
}

function sendMove(from, to) {
  if (local) { applyMove(local, from, to); localUpdate(); }
  else ws.send(JSON.stringify({ type: 'move', from, to }));
}

$('serverInput').value = localStorage.getItem('server') || (isWeb ? location.host : '');
$('localBtn').onclick = startLocal;
$('joinBtn').onclick = () => {
  const host = $('serverInput').value.trim().replace(/^\w+:\/\//, '').replace(/\/$/, '');
  if (!host) return alert('Enter the server address');
  localStorage.setItem('server', host);
  connect(host, $('roomInput').value.trim());
};
$('restartBtn').onclick = () => (local ? startLocal() : ws.send(JSON.stringify({ type: 'restart' })));
const urlRoom = new URLSearchParams(location.search).get('room');
if (isWeb && urlRoom) connect(location.host, urlRoom);

const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

function render() {
  const { game, you, moves, opponentConnected } = state;
  const flip = you === 'b'; // each player sees own pieces at the bottom
  const board = $('board');
  board.innerHTML = '';
  const targets = selected ? moves.filter((m) => eq(m.from, selected)) : [];

  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const r = flip ? 7 - i : i, c = flip ? 7 - j : j;
      const sq = document.createElement('div');
      sq.className = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
      const p = game.board[r][c];
      if (p) {
        const el = document.createElement('div');
        el.className = 'piece ' + p.color;
        if (p.king) el.textContent = '♛';
        if (moves.some((m) => eq(m.from, [r, c]))) {
          el.classList.add('movable');
          el.onclick = () => { if (!game.mustContinue) { selected = [r, c]; render(); } };
        }
        if (eq(selected, [r, c])) el.classList.add('selected');
        sq.appendChild(el);
      }
      const t = targets.find((m) => eq(m.to, [r, c]));
      if (t) {
        sq.classList.add('target');
        sq.onclick = () => {
          selected = null;
          sendMove(t.from, t.to);
        };
      }
      board.appendChild(sq);
    }

  let s;
  if (state.local) s = game.winner ? `${NAMES[game.winner]} wins!` : `${NAMES[game.turn]}'s turn` + (game.mustContinue ? ' — keep jumping!' : '');
  else if (game.winner) s = game.winner === you ? '🎉 You win!' : 'You lose.';
  else if (!opponentConnected) s = 'Waiting for opponent…';
  else if (game.turn === you) s = game.mustContinue ? 'Continue jumping!' : 'Your turn';
  else s = "Opponent's turn";
  $('status').textContent = s;
  $('restartBtn').style.display = game.winner ? '' : 'none';
}
