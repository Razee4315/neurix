# Notes for coding agents

Neurix is a Tauri 2 app: a React + TypeScript front end in `src/`, a Rust
back end in `src-tauri/`. Background: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Checks

Run these before every commit; CI runs the same ones.

```sh
npm run lint        # biome
npm test            # vitest
npm run typecheck   # tsc
cd src-tauri && cargo test && cargo clippy   # needs CMake + clang (llama.cpp)
```

## State logic

Every flow that moves through states is an explicit state machine, listed
with its diagram in [STATE_MACHINES.md](STATE_MACHINES.md).

Where it lives:

| Flow | Pure machine | Wired up in |
|------|--------------|-------------|
| Model in memory | `src-tauri/src/model_slot.rs`, `src/context/modelMachine.ts` | `model_cmds.rs`, `chat_cmds.rs`, `AppContext.tsx` |
| Downloads | `src/context/downloadMachine.ts` | `DownloadContext.tsx` |
| Chat turn + queue | `src/pages/chat/turn.ts` | `ChatPage.tsx` |
| Test reply | `src/utils/useTestRun.ts` | character and friend editors |
| Confirm dialog, download hand-off, sidebar recents | `dialogState.ts`, `downloadHandoff.ts`, `recents.ts` | their components |

Rules:

1. **No new boolean-flag state.** If two or more variables describe one
   thing (`isLoading` + `error` + `data`), make it a tagged union with a
   `kind` field (Rust: an enum) so impossible combinations cannot be
   written.
2. **Transitions go through the reducer.** Change a machine's state only by
   dispatching its actions. Never patch a field or keep a parallel flag
   beside it.
3. **Machines are pure.** The reducer lives in its own `.ts` file with no
   React, IPC or timers, and has a `.test.ts` beside it. Components and
   providers perform the side effects the state calls for.
4. **Tag async work.** Anything that can finish late (a native event, a
   promise, a timer) carries an id (`attempt`, `runId`, `ticket`). The
   reducer ignores results whose id is no longer current.
5. **Every state has an exit.** Cover loading, error, cancel, retry and
   timeout where they apply. Network calls get timeouts.
6. **A no-op returns the same object.** Then callers can tell "ignored" from
   "changed", and React skips the render.
7. **Shared truth stays shared.** Whether a model is loading is
   `useAppContext().modelStatus`; download state is `useDownloads()`. Never
   mirror either in a component.
8. **Name things the same way.** States are lowercase kinds (`idle`,
   `loading`, `ready`); actions are `SCREAMING_SNAKE_CASE` (`LOAD_STARTED`,
   `RUN_ENDED`).

New flow: write the union and the reducer first, test it (one block for the
behaviour you keep, one for the bugs it prevents), then wire it up. Add it
to STATE_MACHINES.md in the same commit.
