/**
 * OS-360 Viewer — Cloudflare Worker API
 * Bindings required:
 *   DB    → D1 database (os360-db)
 *   ASSETS → R2 bucket (os360-assets)
 */

const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:4173', 'https://os360-api.olivier0411.workers.dev'];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function error(msg, status = 400, origin = '') {
  return json({ error: msg }, status, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // ── GET /api/projects — list all projects ──────────────────────────────
    if (request.method === 'GET' && path === '/api/projects') {
      const { results } = await env.DB.prepare(
        'SELECT id, title, author, description, splash_url, updated_at FROM projects ORDER BY updated_at DESC'
      ).all();
      return json(results, 200, origin);
    }

    // ── GET /api/projects/:id — load one project ───────────────────────────
    const matchGet = path.match(/^\/api\/projects\/([^/]+)$/);
    if (request.method === 'GET' && matchGet) {
      const id = matchGet[1];
      const row = await env.DB.prepare(
        'SELECT * FROM projects WHERE id = ?'
      ).bind(id).first();
      if (!row) return error('Project not found', 404, origin);
      return json({ ...row, project_data: JSON.parse(row.project_data) }, 200, origin);
    }

    // ── PUT /api/projects/:id — create or update project ──────────────────
    const matchPut = path.match(/^\/api\/projects\/([^/]+)$/);
    if (request.method === 'PUT' && matchPut) {
      const id = matchPut[1];
      let body;
      try { body = await request.json(); } catch { return error('Invalid JSON', 400, origin); }

      const { title, author, description, splash_url, project_data } = body;
      if (!project_data) return error('project_data is required', 400, origin);

      const dataStr = typeof project_data === 'string' ? project_data : JSON.stringify(project_data);
      const now = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO projects (id, title, author, description, splash_url, project_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          author = excluded.author,
          description = excluded.description,
          splash_url = excluded.splash_url,
          project_data = excluded.project_data,
          updated_at = excluded.updated_at
      `).bind(
        id,
        title ?? 'Sans titre',
        author ?? null,
        description ?? null,
        splash_url ?? null,
        dataStr,
        now,
        now
      ).run();

      return json({ ok: true, id, updated_at: now }, 200, origin);
    }

    // ── DELETE /api/projects/:id ───────────────────────────────────────────
    const matchDel = path.match(/^\/api\/projects\/([^/]+)$/);
    if (request.method === 'DELETE' && matchDel) {
      const id = matchDel[1];

      // Remove all R2 assets uploaded for this project (projects/:id/...)
      try {
        const prefix = `projects/${id}/`;
        let cursor;
        do {
          const listed = await env.ASSETS.list({ prefix, cursor });
          if (listed.objects.length > 0) {
            await Promise.all(listed.objects.map((obj) => env.ASSETS.delete(obj.key)));
          }
          cursor = listed.truncated ? listed.cursor : undefined;
        } while (cursor);
      } catch (e) {
        console.error('R2 cleanup failed for', id, e);
      }

      await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
      return json({ ok: true }, 200, origin);
    }

    // ── GET /assets/:key — serve R2 assets with CORS headers ─────────────
    const matchAsset = path.match(/^\/assets\/(.+)$/);
    if (request.method === 'GET' && matchAsset) {
      const key = matchAsset[1].split('/').map(decodeURIComponent).join('/');

      try {
        const object = await env.ASSETS.get(key);
        
        if (!object) {
          return error('Asset not found', 404, origin);
        }

        const headers = new Headers(corsHeaders(origin));
        object.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('ETag', object.httpEtag);

        return new Response(object.body, { headers });
      } catch (e) {
        return error(`R2 access error: ${e.message}`, 500, origin);
      }
    }

    // ── POST /api/upload/:folder/:filename — upload asset to R2 ───────────
    const matchUpload = path.match(/^\/api\/upload\/([^/]+)\/(.+)$/);
    if (request.method === 'POST' && matchUpload) {
      const folder = matchUpload[1];   // e.g. "360-images", "splash-images"
      const filename = matchUpload[2]; // e.g. "proj_123_scene1.jpg"
      const key = `${folder}/${filename}`;

      const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
      const body = await request.arrayBuffer();

      await env.ASSETS.put(key, body, { httpMetadata: { contentType } });

      const encodedKey = key.split('/').map(encodeURIComponent).join('/');
      const publicUrl = `${url.origin}/assets/${encodedKey}`;
      return json({ ok: true, url: publicUrl }, 200, origin);
    }

    return error('Not found', 404, origin);
  },
};
