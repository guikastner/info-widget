# info-widget

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Deploy para MinIO (apenas compilados)

Requer o MinIO Client (`mc`) instalado e disponível no `PATH`.

1. Defina as variáveis de ambiente (exemplos abaixo):

```env
$env:MINIO_URL = "http://localhost:9000"
$env:MINIO_ACCESS_KEY = "SEU_ACCESS_KEY"
$env:MINIO_SECRET_KEY = "SEU_SECRET_KEY"
$env:MINIO_BUCKET = "seu-bucket"
# Opcional
$env:MINIO_PREFIX = "widgets/info"      # subpasta no bucket
$env:MINIO_ALIAS = "minio"               # nome do alias no mc
$env:MINIO_REMOVE_EXTRA = "1"            # remove arquivos que não existem mais em dist/
```

2. Rode o deploy (build + sync do `dist/`):

```sh
npm run builddeploy
```

O script em `scripts/deploy-minio.js` (Node) chama o `mc mirror --overwrite` para sincronizar apenas os artefatos compilados do diretório `dist/` para o destino `minio/bucket/prefix`.

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
