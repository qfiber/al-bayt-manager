FROM postgres:16-alpine

RUN apk add --no-cache openssl && \
    openssl req -new -x509 -days 3650 -nodes -text \
    -out /var/lib/postgresql/server.crt \
    -keyout /var/lib/postgresql/server.key \
    -subj "/CN=postgres" && \
    chmod 600 /var/lib/postgresql/server.key && \
    chown postgres:postgres /var/lib/postgresql/server.crt /var/lib/postgresql/server.key
