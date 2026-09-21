# Working on College Bowl Scoreboard

The [Project](https://github.com/users/mikeryu/projects/4) and [issues](https://github.com/mikeryu/collegebowl-scoreboard/issues) hold the active plan. See [the CS 195 example guide](docs/PROJECT-EXAMPLE.md) for field meanings and the initial sprint plan.

1. Read the issue's scope, acceptance criteria, and dependencies. Clarify unknown behavior before implementing it.
2. Use the branch linked in the issue's Development section. All nine initial backlog issues have prepared branches. Fetch the branch and update it from `origin/main` before starting work; coordinate overlapping changes. For a new programming issue, `gh issue develop <number> --repo mikeryu/collegebowl-scoreboard --base main --name <branch-name>` creates a linked branch.
3. Move the Project card to In progress when work actually starts. Keep the estimate, next action, and due date current.
4. Implement the bounded change. Add meaningful regression tests for changed behavior and perform the issue's manual checks.
5. Run the repository checks:

   ```bash
   bun run lint
   bun run typecheck
   bun run test
   bun run build
   git diff --check
   ```

6. Inspect the diff, commit, and push the issue branch. Open a PR with `Closes #<number>`, the behavior change, verification results, and relevant UI screenshots. Move the card to In review.
7. Mark Done after review, merge, and verification of the acceptance criteria. Do not mark a feature complete just because its branch exists.

Issue forms record task content; they do not automatically populate Project fields. Add new issues to the Project and populate Status, Sprint, Size, Estimate (hours), Priority, Next Action Date, Due Date, and Milestone.

For gameplay changes, keep `packages/core/src/state.ts` and the Electron runtime in `apps/main/src/main.cjs` consistent. Verify the operator and projection windows together. Do not commit credentials, generated dependencies, or unrelated changes.

AI assistance is welcome for planning and implementation. Inspect what it creates, verify actual GitHub field values, and report tests accurately. The license grants its stated rights; students should separately follow their course's collaboration policy.
