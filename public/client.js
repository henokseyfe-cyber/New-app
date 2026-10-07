const $ = (id) => document.getElementById(id);
const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
let state = null, selected = null;
const NAMES = { r: 'Red', b: 'Black' };

ws.onopen = () => {
  const room = new URLSearchParams(location.search).get('room');
  if (room) join(room);
};
ws.onclose = () => ($('status').textContent = 'Disconnected from server.');
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'joined') {
    $('lobby').style.display = 'none';
    history.replaceState(null, '', '?room=' + msg.room);
    $('info').innerHTML = `Room <b>${msg.room}</b> — you are <b>${NAMES[msg.color]}</b>. Share this link: <code>${location.href}</code>`;
  } else if (msg.type === 'state') {
    state = msg;
    if (state.game.mustContinue) selected = state.game.mustContinue;
    render();
  } else if (msg.type === 'error') {
    alert(msg.message);
  }
};

function join(room) { ws.send(JSON.stringify({ type: 'join', room })); }
$('joinBtn').onclick = () => join($('roomInput').value.trim());
$('restartBtn').onclick = () => ws.send(JSON.stringify({ type: 'restart' }));

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
          ws.send(JSON.stringify({ type: 'move', from: t.from, to: t.to }));
          selected = null;
        };
      }
      board.appendChild(sq);
    }

  let s;
  if (game.winner) s = game.winner === you ? '🎉 You win!' : 'You lose.';
  else if (!opponentConnected) s = 'Waiting for opponent…';
  else if (game.turn === you) s = game.mustContinue ? 'Continue jumping!' : 'Your turn';
  else s = "Opponent's turn";
  $('status').textContent = s;
  $('restartBtn').style.display = game.winner ? '' : 'none';
}
