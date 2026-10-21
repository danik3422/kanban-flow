# Contributing to KanbanHub

Thanks for wanting to help. Small fixes and big ideas are both welcome.

## Before you start

- **Bugs:** [open an issue](https://github.com/danik3422/kanban-flow/issues/new/choose)
  with the steps to see it, what you expected and what happened. A screenshot helps a lot.
- **New features:** open an issue first and describe the idea, so we can agree on it
  before you spend time on code.
- **Security problems:** please don't open a public issue. See [SECURITY.md](SECURITY.md).

## Set up

Follow [Work on the code](README.md#work-on-the-code) in the README. In short:
Node.js 24, `npm install` in the root, `backend/` and `frontend/`, copy the two
`.env.example` files, then `npm run dev`.

## Making a change

1. Fork the repository and create a branch from `main`, for example `fix/card-dates`.
2. Keep the change focused on one thing.
3. Match the code around you: tabs, single quotes, no semicolons, plain names.
4. Any text people see goes into all three language files in
   `frontend/src/i18n/locales/` (English, Ukrainian, Russian).
5. Use the shared components and tokens from `frontend/src/ui/` so the design stays
   consistent in light and dark themes and on phones.
6. Add or update tests when you change behaviour.

## Before you open a pull request

```sh
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix backend test
npm --prefix frontend run build
```

All four should pass. In the pull request, explain what changed and why, and add
screenshots for anything visible.

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
