# VersaEdit

Rich Text Editor for Web Applications — **work in progress (v0.1, not published yet)**.

## Development

```bash
npm install
npm run dev        # playground at http://localhost:5180
npm run build      # library build (dist/)
npm run lint
npm run typecheck
npm test           # unit tests (Vitest) + browser tests (Playwright)
```

Browser tests use `playground/harness.html`. Locally they run in the installed
Microsoft Edge; in CI, in Playwright's Chromium. Reference results live in
`tests/e2e/__snapshots__/` — after an intentional behavior change, run
`npm run test:e2e -- --update-snapshots` and review the diff.

Full documentation (English and Portuguese) comes with v0.1.

## License

[MIT](LICENSE)
