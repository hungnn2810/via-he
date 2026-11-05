// Vỉa Hè Online server: HTTP (login, street list) + Colyseus realtime rooms.
//   npm start            listens on port 2567 (override with the PORT env var)
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import path from 'node:path';
import { StreetRoom } from './rooms/StreetRoom.js';
import { timingSafeEqual } from 'node:crypto';
import {
  allProfiles, analyticsSummary, voteWinner, ensureNpcStreets, flushNow, getProfile, linkAccount, linkedPlayer, listReports, login, markDirty,
  npcStreetList, randomStreets, recoverAccount, signToken, track, verifyToken,
} from './profile.js';
import { rolloverSeason, seasonIndex } from './world.js';
import { meeting, startManualEvent } from './events.js';
import { verifySocialToken } from './social.js';
import { leaderboard } from './season.js';

const PORT = Number(process.env.PORT) || 2567;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

ensureNpcStreets();
meeting.winner = voteWinner;
setInterval(() => rolloverSeason(), 3_600_000).unref();

// Admin routes stay disabled until ADMIN_TOKEN is set
function isAdmin(header: unknown) {
  if (!ADMIN_TOKEN || typeof header !== 'string') return false;
  const a = Buffer.from(header), b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

const server = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    app.use(express.json({ limit: '16kb' }));

    // Guest login with a device id (generated and stored by the client). Returns the token used to join streets.
    app.post('/api/login', (req, res) => {
      const deviceId = String(req.body?.deviceId || '').slice(0, 64);
      const name = String(req.body?.name || '').trim().slice(0, 24);
      if (deviceId.length < 8) return res.status(400).json({ error: 'Thiếu mã thiết bị' });
      const profile = login(deviceId, name);
      if (profile.banned) return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
      res.json({ token: signToken(profile.id), id: profile.id, name: profile.name });
    });

    // Streets reachable by bus: streets with players first, plus a few random empty ones
    app.get('/api/streets', async (req, res) => {
      const id = verifyToken(req.query.token);
      if (!id) return res.status(401).json({ error: 'Đăng nhập lại' });
      const rooms = await matchMaker.query({ name: 'street' });
      const open = rooms
        .filter((r) => r.metadata?.ownerId && r.metadata.ownerId !== id)
        .map((r) => ({ ...r.metadata, isOpen: true }))
        .sort((a, b) => b.playerCount - a.playerCount)
        .slice(0, 20);
      const listed = new Set(open.map((s) => s.ownerId));
      const empty = randomStreets(id, 10)
        .filter((s) => !listed.has(s.id))
        .map((s) => ({ ownerId: s.id, ownerName: s.name, ownerLevel: s.level, district: 0, playerCount: 0, stallCount: 0, isOpen: false }));
      const npc = npcStreetList().filter((s) => !listed.has(s.ownerId));
      const me = getProfile(id);
      const friendsFirst = [...open, ...npc, ...empty.filter((s) => !s.ownerId.startsWith('npc-'))]
        .map((s) => ({ ...s, isFriend: !!me?.friends.includes(s.ownerId) }))
        .sort((a, b) => Number(b.isFriend) - Number(a.isFriend));
      res.json(friendsFirst);
    });

    // Your own activity log (also part of the profile sent in the room; this is a quick read before joining a street)
    app.get('/api/log', (req, res) => {
      const id = verifyToken(req.query.token);
      const profile = id && getProfile(id);
      if (!profile) return res.status(401).json({ error: 'Đăng nhập lại' });
      res.json(profile.log);
    });

    // This season's most famous streets
    app.get('/api/leaderboard', (req, res) => {
      res.json({ season: seasonIndex(), ...leaderboard(req.query.board) });
    });

    // Move an account to this device with its recovery code
    app.post('/api/recover', (req, res) => {
      const deviceId = String(req.body?.deviceId || '').slice(0, 64);
      if (deviceId.length < 8) return res.status(400).json({ error: 'Thiếu mã thiết bị' });
      const profile = recoverAccount(String(req.body?.code || ''), deviceId);
      if (!profile) return res.status(404).json({ error: 'Mã khôi phục không đúng' });
      res.json({ token: signToken(profile.id), id: profile.id, name: profile.name });
    });

    // Link Zalo, Google or Facebook to this account, or sign in with an account linked earlier
    app.post('/api/link', async (req, res) => {
      const id = verifyToken(req.body?.token);
      if (!id) return res.status(401).json({ error: 'Đăng nhập lại' });
      const userId = await verifySocialToken(String(req.body?.provider), String(req.body?.providerToken));
      if (!userId) return res.status(400).json({ error: 'Không xác minh được tài khoản' });
      linkAccount(String(req.body.provider), userId, id);
      res.json({ ok: true });
    });
    app.post('/api/login/social', async (req, res) => {
      const userId = await verifySocialToken(String(req.body?.provider), String(req.body?.providerToken));
      const playerId = userId && linkedPlayer(String(req.body.provider), userId);
      const profile = playerId ? getProfile(playerId) : null;
      if (!profile) return res.status(404).json({ error: 'Tài khoản chưa được liên kết' });
      res.json({ token: signToken(profile.id), id: profile.id, name: profile.name });
    });

    app.get('/admin', (_req, res) => res.sendFile(path.resolve('public/admin.html')));
    app.get('/admin/reports', (req, res) => {
      if (!isAdmin(req.headers['x-admin-token'])) return res.status(403).end();
      res.json(listReports());
    });
    app.get('/admin/stats', (req, res) => {
      if (!isAdmin(req.headers['x-admin-token'])) return res.status(403).end();
      res.json(analyticsSummary());
    });
    app.post('/admin/ban', (req, res) => {
      if (!isAdmin(req.headers['x-admin-token'])) return res.status(403).end();
      const profile = getProfile(String(req.body?.playerId));
      if (!profile) return res.status(404).end();
      profile.banned = req.body?.banned !== false;
      markDirty(profile);
      track(profile.id, 'ban');
      res.json({ id: profile.id, banned: profile.banned });
    });
    app.post('/admin/event', (req, res) => {
      if (!isAdmin(req.headers['x-admin-token'])) return res.status(403).end();
      const { id, name, rules, seconds } = req.body ?? {};
      if (!id || !name || !Number.isFinite(seconds)) return res.status(400).json({ error: 'id, name and seconds are required' });
      startManualEvent({ id: String(id), name: String(name), rules: rules ?? {} }, seconds);
      res.json({ ok: true });
    });

    app.get('/', (_req, res) => res.send('Vỉa Hè Online server is running'));
  },
});

// One room per district: joinOrCreate('street', { ownerId, district }) joins that exact street
server.define('street', StreetRoom).filterBy(['ownerId', 'district']);

server.listen(PORT).then(() => console.log(`Vỉa Hè Online: ws://localhost:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => { flushNow(); });
}
process.on('exit', flushNow);
