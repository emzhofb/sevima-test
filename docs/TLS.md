# TLS Strategy

FlowForge backend Node.js application **does not** handle TLS termination directly. TLS is terminated at a reverse proxy layer (nginx, Caddy, or cloud load balancer) positioned in front of the API.

## Local Development

For local development, TLS is not required. Access the API directly via `http://localhost:3000`.

## Production Deployment

In production, deploy a reverse proxy in front of the Node.js application to handle TLS termination. This follows the industry standard practice of separating concerns:

- **Reverse Proxy**: Handles TLS termination, certificate management, and HTTP/2
- **Node.js App**: Receives plain HTTP traffic from the proxy, focused on business logic

### Nginx Configuration Example

```nginx
server {
    listen 443 ssl http2;
    server_name flowforge.example.com;

    ssl_certificate /etc/letsencrypt/live/flowforge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flowforge.example.com/privkey.pem;
    ssl_protocols TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Redirect HTTP to HTTPS
    error_page 497 https://$host$request_uri;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name flowforge.example.com;
    return 301 https://$host$request_uri;
}
```

### Caddy Configuration Example

```caddy
flowforge.example.com {
    encode gzip

    reverse_proxy localhost:3000 {
        header_uri X-Forwarded-Proto https
        header_uri X-Real-IP {http.request.remote}
    }
}
```

### Cloud Load Balancer (AWS ALB/ELB)

If using AWS Application Load Balancer:

1. Configure an HTTPS listener on port 443
2. Upload or request a certificate from ACM
3. Configure the target group to route to the Node.js app on port 3000 (HTTP)
4. The ALB automatically terminates TLS and forwards plain HTTP to the backend

## Why Reverse Proxy?

- **Certificate Management**: Centralized certificate rotation and renewal
- **Performance**: Dedicated TLS optimization and hardware acceleration
- **Security**: Isolates TLS complexity from application code
- **Flexibility**: Easy to swap or upgrade the reverse proxy without changing the app
- **Horizontal Scaling**: Multiple app instances behind a single proxy with load balancing

## Environment Configuration

The Node.js application should be configured to run on:

- **Host**: `0.0.0.0` (all interfaces, but only accessible through reverse proxy)
- **Port**: `3000` (or configured via `PORT` environment variable)
- **Protocol**: `HTTP` only

The reverse proxy handles all HTTPS/TLS protocol requirements.
