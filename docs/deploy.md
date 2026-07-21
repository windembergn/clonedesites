# Deploy

Cada app tem um `Dockerfile` multi-stage e usa `output: "standalone"` no `next.config.mjs`. O `.dockerignore` exclui `node_modules` e `.next` (o build acontece dentro da imagem).

> Os detalhes da infraestrutura onde estes sites rodam hoje não estão neste repositório público. O que segue é o método genérico — funciona em qualquer host com Docker.

## Build e run

Em cada pasta do app:

```bash
docker build -t dr-christian:latest .

docker run -d --name dr-christian --restart unless-stopped \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  -p 3000:3000 \
  dr-christian:latest
```

Para os outros apps, troque o nome/imagem e mapeie outra porta no host (ex.: `-p 3001:3000`, `-p 3002:3000`). São três containers independentes — um por app.

O container sempre escuta na **porta 3000** internamente (`PORT=3000`, `HOSTNAME=0.0.0.0`); quem muda é o mapeamento no host.

## Sobre as flags de segurança

Não são decorativas — foram adotadas depois de uma invasão real (veja [`seguranca.md`](./seguranca.md)):

| Flag | Por quê |
|------|---------|
| `USER nextjs` (no Dockerfile) | O app roda como uid 1001, **não como root**. Na invasão, o minerador herdou root porque o container rodava como root. |
| `--cap-drop ALL` | Remove todas as capabilities do kernel. |
| `--security-opt no-new-privileges` | Impede escalada via binários setuid. |
| `--read-only` + `--tmpfs /tmp` | Filesystem imutável. O malware gravava payloads em `/tmp` e `/dev/shm`. O `--tmpfs` é necessário porque o `--read-only` sozinho quebra o Next. |

## Não exponha a porta direto na internet

Publicar `-p 3000:3000` numa VPS deixa o app **exposto no IP público**, onde scanners automatizados o encontram sozinhos — foi exatamente assim que estes sites foram invadidos.

Prefira colocar atrás de um reverse proxy (Traefik, Caddy, nginx) com domínio e TLS, e **não publicar a porta** — deixe o proxy alcançar o container pela rede interna do Docker.

## Redeploy

1. Rebuild da imagem (`docker build`)
2. `docker rm -f <nome>`
3. `docker run` de novo com as flags acima

Um detalhe do Dockerfile: ele faz `mkdir -p public` durante o build porque o app do Dr. Christian não tem pasta `public/`, e o output standalone exige que o `COPY` encontre o diretório.
