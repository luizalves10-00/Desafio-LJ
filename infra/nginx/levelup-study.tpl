# ==============================================================================
# HestiaCP Nginx Template - HTTP Redirect (levelup-study.tpl)
# Domain: levelupstudy.com.br
# Force HTTPS 301 Permanent Redirect
# ==============================================================================

server {
    listen      %ip%:%web_port%;
    server_name %domain_idn% %alias_idn%;

    # Oculta versão do Nginx nos cabeçalhos
    server_tokens off;

    # Let's Encrypt ACME Challenge (Permitido em HTTP para renovação de certificados)
    location ~ /\.well-known/acme-challenge/ {
        root %docroot%;
        allow all;
    }

    # Redirecionamento permanente estrito para HTTPS
    location / {
        return 301 https://%domain_idn%$request_uri;
    }
}
