# ==============================================================================
# LevelUp Study - Template Nginx Proxy HestiaCP (HTTP)
# Arquivo: /usr/local/hestia/data/templates/web/nginx/levelup-study.tpl
# ==============================================================================
server {
	listen      %ip%:%proxy_port%;
	server_name %domain_idn% %alias_idn%;
	error_log   /var/log/%web_system%/domains/%domain%.error.log error;

	# Redirecionamento HTTPS forçado configurável pelo HestiaCP
	include %home%/%user%/conf/web/%domain%/nginx.forcessl.conf*;

	# Validação Let's Encrypt (ACME)
	location ^~ /.well-known/acme-challenge/ {
		root %docroot%;
		default_type "text/plain";
		allow all;
	}

	# Regra 1: Bloqueia qualquer arquivo ou pasta oculta (.env, .git, etc.)
	location ~ /\.(?!well-known/) {
		deny all;
		access_log off;
		log_not_found off;
		return 404;
	}

	# Regra 2: Bloqueia extensões sensíveis
	location ~* \.(env|env\..*|py|pyc|pyo|db|sqlite|sqlite3|sh|bash|sql|log|yml|yaml|ini|conf|bak)$ {
		deny all;
		access_log off;
		log_not_found off;
		return 404;
	}

	# Regra 3: Bloqueia pastas internas
	location ~* /(back_end|\.git|\.venv|venv|migrations|tests)/ {
		deny all;
		access_log off;
		log_not_found off;
		return 404;
	}

	# Proxy Reverso
	location / {
		proxy_pass http://127.0.0.1:8017;
		proxy_http_version 1.1;

		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header X-Forwarded-Host $host;
		proxy_set_header X-Forwarded-Port $server_port;

		proxy_connect_timeout 60s;
		proxy_send_timeout 90s;
		proxy_read_timeout 90s;

		access_log /var/log/%web_system%/domains/%domain%.log combined;
		access_log /var/log/%web_system%/domains/%domain%.bytes bytes;
	}

	include %home%/%user%/conf/web/%domain%/nginx.conf_*;
}
