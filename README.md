# PERSPECTIVE_STUDIO

A 2D perspective drawing skill app: set a horizon and three vanishing points,
construct mathematically exact perspective objects (cubes first), and later
sketch over them. Private, single user, offline.

- Requirements: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
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
