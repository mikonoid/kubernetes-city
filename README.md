# kubernetes-city

Static Three.js starter for a browser-only Kubernetes visualizer that deploys to GitHub Pages.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages

This repository is configured as a GitHub Pages project site for:

`https://mikonoid.github.io/kubernetes-city/`

Important details:

- `vite.config.ts` uses `/kubernetes-city/` as the production base path.
- `.github/workflows/deploy.yml` publishes the `dist/` folder through GitHub Actions.
- In GitHub repository settings, set `Pages -> Source` to `GitHub Actions`.

## Current starter

- TypeScript + Vite
- Three.js scene
- Static layout ready for `github.io`
- No backend required
