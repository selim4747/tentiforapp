// Supabase taklidi (yalnızca testler için): giriş işlemleri (GoTrue) burada taklit edilir,
// REST ve RPC istekleri ise gerçek PostgreSQL'e çevrilir — RLS kuralları ve fonksiyonlar gerçektir.
// Bağlantı: PGHOST, PGPORT, PGUSER, PGPASSWORD ortam değişkenleri.
const crypto = require('crypto');
const { Pool } = require('pg');
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const ID = /^[a-z_][a-z0-9_]*$/;

function yeniSahte(dbAdi) {
  const pool = new Pool({ database: dbAdi, max: 4 });
  const setDonenler = {};
  const bel = { users: {}, tokens: {}, log: [] };
  const jwt = u => b64u({alg:'HS256',typ:'JWT'}) + '.' + b64u({sub:u.id, email:u.email, role:'authenticated', exp: Math.floor(Date.now()/1000)+3600}) + '.imza';
  const kj = u => ({ id:u.id, aud:'authenticated', role:'authenticated', email:u.email, email_confirmed_at: u.onay ? new Date().toISOString() : null,
    user_metadata: u.meta, app_metadata:{provider:'email'}, identities:[{id:u.id, provider:'email'}], created_at:u.olusturma });
  const oturum = u => { const t = jwt(u); bel.tokens[t] = u.id; return { access_token:t, token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, refresh_token:'r'+crypto.randomUUID(), user:kj(u) }; };
  const bul = e => Object.values(bel.users).find(u => u.email === e);

  async function sorgu(uid, sql, params) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query("select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true)", [uid ? 'authenticated' : 'anon', uid || '']);
      const r = await c.query(sql, params);
      await c.query('commit');
      return r;
    } catch (e) { await c.query('rollback').catch(()=>{}); throw e; } finally { c.release(); }
  }
  async function kokSorgu(sql, params) { return pool.query(sql, params); }

  async function isle(route) {
    const r = route.request(); const url = new URL(r.url()); const yol = url.pathname; const yontem = r.method();
    let govde = {}; try { govde = r.postDataJSON() || {}; } catch (_) {}
    const h = r.headers();
    const uid = bel.tokens[(h['authorization']||'').replace('Bearer ','')] || null;
    const ortak = {'access-control-allow-origin':'*','access-control-expose-headers':'content-range'};
    const cevap = (st, b, ek) => route.fulfill({ status: st, contentType:'application/json', headers: Object.assign({}, ortak, ek||{}), body: b === undefined ? '' : JSON.stringify(b) });
    const pgHata = e => cevap(e.code === '42501' ? 403 : e.code === '23505' ? 409 : 400, { code: e.code, message: e.message, details: e.detail || null, hint: null });
    bel.log.push(yontem + ' ' + yol + url.search);
    if (yontem === 'OPTIONS') return route.fulfill({status:200, headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});

    // ---------------- auth ----------------
    if (yol === '/auth/v1/signup') {
      if (bul(govde.email)) return cevap(200, Object.assign(kj(bul(govde.email)), {identities:[]}));
      const u = { id: crypto.randomUUID(), email: govde.email, sifre: govde.password, onay:false, meta: govde.data||{}, olusturma:new Date().toISOString() };
      try { await kokSorgu('insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)', [u.id, u.email, u.meta]); }
      catch (e) { return cevap(500, {code:500, error_code:'unexpected_failure', msg:'Database error saving new user'}); }
      bel.users[u.id] = u; return cevap(200, kj(u));
    }
    if (yol === '/auth/v1/token') {
      const g = url.searchParams.get('grant_type');
      if (g === 'password') { const u = bul(govde.email);
        if (!u || u.sifre !== govde.password) return cevap(400, {code:400, error_code:'invalid_credentials', msg:'Invalid login credentials'});
        if (!u.onay) return cevap(400, {code:400, error_code:'email_not_confirmed', msg:'Email not confirmed'});
        return cevap(200, oturum(u)); }
      if (g === 'pkce') { const u = bul(govde.auth_code); if (!u) return cevap(400, {msg:'invalid flow state'}); u.onay = true; return cevap(200, oturum(u)); }
      return cevap(400, {msg:'Invalid Refresh Token'});
    }
    if (yol === '/auth/v1/user' && yontem === 'GET') return uid ? cevap(200, kj(bel.users[uid])) : cevap(401, {msg:'unauthorized'});
    if (yol === '/auth/v1/user' && yontem === 'PUT') { if (!uid) return cevap(401,{}); if (govde.password) bel.users[uid].sifre = govde.password; return cevap(200, kj(bel.users[uid])); }
    if (yol === '/auth/v1/logout') { return route.fulfill({status:204, headers:ortak}); }
    if (yol === '/auth/v1/recover') return cevap(200, {});

    // ---------------- rpc ----------------
    let m = yol.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (m) {
      const fn = m[1]; const adlar = Object.keys(govde).filter(k => ID.test(k));
      const argSql = adlar.map((k, i) => k + ' => $' + (i + 1)).join(', ');
      const vals = adlar.map(k => (govde[k] !== null && typeof govde[k] === 'object') ? JSON.stringify(govde[k]) : govde[k]);
      try {
        if (!(fn in setDonenler)) {
          const r = await kokSorgu("select bool_or(proretset) s from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace", [fn]);
          setDonenler[fn] = !!(r.rows[0] && r.rows[0].s);
        }
        const setDonen = setDonenler[fn];
        const q = await sorgu(uid, setDonen ? `select * from public.${fn}(${argSql})` : `select public.${fn}(${argSql}) as s`, vals);
        return cevap(200, setDonen ? q.rows : (q.rows[0] ? q.rows[0].s : null));
      } catch (e) { return pgHata(e); }
    }

    // ---------------- tablolar ve görünümler ----------------
    m = yol.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (m) {
      const rel = m[1]; const where = []; const vals = []; let order = []; let limit = null; let select = '*';
      for (const [k, v] of url.searchParams) {
        if (k === 'select') { select = v.split(',').map(s => s.trim()).filter(s => ID.test(s)).join(', ') || '*'; continue; }
        if (k === 'order') { order = v.split(',').map(o => { const [c, d] = o.split('.'); return ID.test(c) ? c + (d === 'desc' ? ' desc' : ' asc') : null; }).filter(Boolean); continue; }
        if (k === 'limit') { limit = parseInt(v, 10); continue; }
        if (k === 'on_conflict' || k === 'columns') continue;
        const [op, ...rest] = v.split('.'); const deg = rest.join('.');
        const ops = { eq: '=', gt: '>', gte: '>=', lt: '<', lte: '<=' };
        if (ID.test(k) && ops[op]) { vals.push(deg); where.push(`${k} ${ops[op]} $${vals.length}`); }
        else if (ID.test(k) && op === 'in') {
          const liste = (deg.replace(/^\(|\)$/g, '').match(/"(?:[^"\\]|\\.)*"|[^,]+/g) || []).map(x => x.replace(/^"|"$/g, ''));
          vals.push(liste); where.push(`${k} = any($${vals.length})`);
        }
        else if (ID.test(k) && op === 'is') { where.push(`${k} is ${deg === 'null' ? 'null' : deg === 'true' ? 'true' : 'false'}`); }
        else if (ID.test(k) && (op === 'ilike' || op === 'like')) { vals.push(deg.replace(/\*/g, '%')); where.push(`${k} ${op} $${vals.length}`); }
      }
      const w = where.length ? ' where ' + where.join(' and ') : '';
      try {
        if (yontem === 'GET' || yontem === 'HEAD') {
          const sayim = (h['prefer'] || '').includes('count=exact');
          const q = await sorgu(uid, `select ${select} from public.${rel}${w}${order.length ? ' order by ' + order.join(', ') : ''}${limit ? ' limit ' + limit : ''}`, vals);
          const ek = {};
          if (sayim) { const c = await sorgu(uid, `select count(*)::int n from public.${rel}${w}`, vals); ek['content-range'] = '*/' + c.rows[0].n; }
          if (yontem === 'HEAD') return route.fulfill({ status: 200, headers: Object.assign({}, ortak, ek) });
          if ((h['accept'] || '').includes('vnd.pgrst.object')) {
            if (q.rows.length !== 1) return cevap(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains ' + q.rows.length + ' rows' });
            return cevap(200, q.rows[0], ek);
          }
          return cevap(200, q.rows, ek);
        }
        if (yontem === 'PATCH') {
          const kolon = Object.keys(govde).filter(k => ID.test(k));
          const v2 = vals.concat(kolon.map(k => (govde[k] !== null && typeof govde[k] === 'object') ? JSON.stringify(govde[k]) : govde[k]));
          await sorgu(uid, `update public.${rel} set ${kolon.map((k, i) => `${k} = $${vals.length + i + 1}`).join(', ')}${w}`, v2);
          return route.fulfill({ status: 204, headers: ortak });
        }
        if (yontem === 'POST') {
          const satirlar = Array.isArray(govde) ? govde : [govde];
          for (const s of satirlar) {
            const kolon = Object.keys(s).filter(k => ID.test(k));
            const v2 = kolon.map(k => (s[k] !== null && typeof s[k] === 'object') ? JSON.stringify(s[k]) : s[k]);
            const upsert = (h['prefer'] || '').includes('merge-duplicates');
            await sorgu(uid, `insert into public.${rel} (${kolon.join(', ')}) values (${kolon.map((_, i) => '$' + (i + 1)).join(', ')})` +
              (upsert ? ` on conflict (id) do update set ${kolon.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(', ')}` : ''), v2);
          }
          return route.fulfill({ status: 201, headers: ortak });
        }
      } catch (e) { return pgHata(e); }
    }
    return cevap(404, { message: 'mock: bilinmeyen ' + yontem + ' ' + yol });
  }
  return { bel, isle, pool, kokSorgu };
}
module.exports = { yeniSahte };
