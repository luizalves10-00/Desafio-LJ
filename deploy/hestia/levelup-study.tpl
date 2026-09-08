# LevelUp Study - HestiaCP Nginx proxy template (HTTP)
server {
	listen      %ip%:%proxy_port%;
	server_name %domain_idn% %alias_idn%;
	error_log   /var/log/%web_system%/domains/%domain%.error.log error;

	include %home%/%user%/conf/web/%domain%/nginx.forcessl.conf*;

	location ^~ /.well-known/acme-challenge/ {
		root %docroot%;
	}

	location ~ /\.(?!well-known/) {
		deny all;
		return 404;
	}

	location / {
		proxy_pass http://127.0.0.1:8017;
		proxy_http_version 1.1;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_read_timeout 90s;
		access_log /var/log/%web_system%/domains/%domain%.log combined;
		access_log /var/log/%web_system%/domains/%domain%.bytes bytes;
	}

	include %home%/%user%/conf/web/%domain%/nginx.conf_*;
}
