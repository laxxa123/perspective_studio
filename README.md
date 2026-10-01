# CREATIVE

*Ideas to creation.* A private, single-user, offline Android app made of
modules. **PERSPECTIVE** — set a horizon and vanishing points, construct exact
perspective objects, sketch over them — is the first; **CUBE** — a studio for
six-face cube / net spatial-reasoning questions with a question bank — is the
second.

- App: [docs/CREATIVE.md](docs/CREATIVE.md)
- PERSPECTIVE requirements: [docs/modules/perspective/REQUIREMENTS.md](docs/modules/perspective/REQUIREMENTS.md)
- CUBE requirements: [docs/modules/cube/REQUIREMENTS.md](docs/modules/cube/REQUIREMENTS.md)
- Decisions: [docs/decisions/](docs/decisions/)
- Changes: [docs/CHANGELOG.md](docs/CHANGELOG.md)

```sh
npm install
npm run dev        # http://localhost:5173
npm run lint && npm run typecheck && npm test
npm run build
```

Every push to `main` publishes a signed APK as a GitHub Release; Obtainium
installs it on the phone.
