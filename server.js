const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { newGame, legalMoves, applyMove } = require('./public/game');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = path.join(PUBLIC, url === '/' ? 'index.html' : url);
  if (!file.startsWith(PUBLIC)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end('Not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' }).end(data);
  });
});

// rooms: id -> { game, players: {r: ws|null, b: ws|null} }
const rooms = new Map();

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room) {
  for (const color of ['r', 'b']) {
    const ws = room.players[color];
    send(ws, {
      type: 'state',
      you: color,
      game: room.game,
      moves: room.game.turn === color ? legalMoves(room.game) : [],
      opponentConnected: !!room.players[color === 'r' ? 'b' : 'r'],
    });
  }
}

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      let id = String(msg.room || '').toUpperCase().slice(0, 12);
      if (!id) id = crypto.randomBytes(3).toString('hex').toUpperCase();
      let room = rooms.get(id);
      if (!room) rooms.set(id, (room = { game: newGame(), players: { r: null, b: null } }));
      const color = !room.players.r ? 'r' : !room.players.b ? 'b' : null;
      if (!color) return send(ws, { type: 'error', message: 'Room is full' });
      room.players[color] = ws;
      ws.room = id;
      ws.color = color;
      send(ws, { type: 'joined', room: id, color });
      broadcast(room);
    } else if (msg.type === 'move') {
      const room = rooms.get(ws.room);
      if (!room || room.game.turn !== ws.color) return send(ws, { type: 'error', message: 'Not your turn' });
      const err = applyMove(room.game, msg.from, msg.to);
      if (err) return send(ws, { type: 'error', message: err });
      broadcast(room);
    } else if (msg.type === 'restart') {
      const room = rooms.get(ws.room);
      if (room && room.game.winner) { room.game = newGame(); broadcast(room); }
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.room);
    if (!room) return;
    room.players[ws.color] = null;
    if (!room.players.r && !room.players.b) rooms.delete(ws.room);
    else broadcast(room);
  });
});

server.listen(PORT, () => console.log(`Checkers running on http://localhost:${PORT}`));
