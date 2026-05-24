# [Epic-05] Document TLS termination strategy

**Labels**: `epic-05`, `good-first-issue`, `area-docs`
**Estimate**: 0.5 jam
**Depends on**: None

## Context

Original spec mensyaratkan TLS 1.3. Untuk MVP fresh grad, kita tidak handle TLS di Node — itu tugas reverse proxy / load balancer (nginx, Caddy, ALB). Bikin doc yang jelaskan ini.

## Acceptance Criteria

- [ ] File `docs/TLS.md` ada
- [ ] Jelaskan: TLS handled di L7 reverse proxy, bukan Node app
- [ ] Contoh nginx config snippet

## Implementation Hints

`docs/TLS.md`:

```markdown
# TLS Strategy

FlowForge backend Node.js **tidak** menerima TLS langsung. TLS diterminate di reverse proxy (nginx, Caddy, atau cloud load balancer) yang ditempatkan di depan API.

## Local development

Tanpa TLS. Akses langsung `http://localhost:3000`.

## Production deploy

Pakai nginx atau Caddy sebagai reverse proxy:

\`\`\`nginx
server {
    listen 443 ssl http2;
    server_name flowforge.example.com;

    ssl_certificate /etc/letsencrypt/live/flowforge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flowforge.example.com/privkey.pem;
    ssl_protocols TLSv1.3;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://flowforge-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://flowforge-api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Redirect HTTP -> HTTPS
server {
    listen 80;
    server_name flowforge.example.com;
    return 301 https://$host$request_uri;
}
\`\`\`

## Cloud deploy (AWS/GCP)

Gunakan Application Load Balancer (AWS) atau Cloud Load Balancing (GCP) yang otomatis handle TLS termination dengan ACM/Managed Certificate.
```

## Files Involved

- `docs/TLS.md`

## How to Verify

Doc dibaca, link di README ditambahkan.
