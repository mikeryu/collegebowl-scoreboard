# Repository and Project setup example

Use this repository as a model for organizing your own capstone. Adapt the issues and estimates to your actual project; copying these scoreboard tasks would not plan your project.

## Where to look

| Requirement | Example |
| --- | --- |
| Project identity and run instructions | [README](../README.md) |
| License | [MIT license](../LICENSE) |
| Initial programming artifact | Existing Electron control/projection app and core reducer |
| Linked Project | [College Bowl Scoreboard — CS 195 Example](https://github.com/users/mikeryu/projects/4) |
| Sprint 1 Kanban | [Sprint 1 view](https://github.com/users/mikeryu/projects/4/views/1) |
| Complete planning fields | [All work view](https://github.com/users/mikeryu/projects/4/views/3) |
| Dated releases | [Repository milestones](https://github.com/mikeryu/collegebowl-scoreboard/milestones) |
| Actionable issue | [#10: question countdown invariant](https://github.com/mikeryu/collegebowl-scoreboard/issues/10) |
| Programming branch | Each issue's Development section contains a linked branch |
| Repeatable task structure | [New task form](https://github.com/mikeryu/collegebowl-scoreboard/issues/new?template=task.yml) |

## Sprint 1 plan

Goal: make preliminary-game operation and question timing consistent, and clarify moderator controls. The planning window is September 21–October 4, 2026; the supplied tentative course schedule places the Sprint 1 review on October 7. The October 4 cutoff and individual issue dates are proposed internal planning dates, not course deadlines.

| Issue | Work | Size | Hours | Dependency |
| --- | --- | --- | --- | --- |
| [#4](https://github.com/mikeryu/collegebowl-scoreboard/issues/4) | Preliminary mode without overall timer | M | 6 | Coordinate #10 |
| [#5](https://github.com/mikeryu/collegebowl-scoreboard/issues/5) | Distinct preliminary/final styling | S | 3 | #4 |
| [#6](https://github.com/mikeryu/collegebowl-scoreboard/issues/6) | Toss-up claim correction | M | 5 | None |
| [#8](https://github.com/mikeryu/collegebowl-scoreboard/issues/8) | Question-pair terminology | S | 2 | None |
| [#10](https://github.com/mikeryu/collegebowl-scoreboard/issues/10) | Continuous question countdown | M | 4 | Coordinate #4 |
| [#11](https://github.com/mikeryu/collegebowl-scoreboard/issues/11) | Remove pause controls/shortcut | S | 2 | #10 |

Total: **22 estimated focused hours**, including validation. These are initial estimates to discuss and revise, not time already spent. Dependencies explain why two Sprint 1 cards remain in Backlog while four are Ready. Nothing is marked In progress or Done merely to make the board look busy.

Later work is represented by #7 (Sprint 2, preliminary schedule import), #9 (Sprint 3, PNG slide decks), and #12 (Sprint 5, schedule service). #12 is intentionally marked XL and must be split and re-estimated before implementation. The later sprint assignments are a proposed project plan, not additional course requirements.

## What a complete issue looks like

Each existing issue now states an outcome, bounded scope, acceptance checklist, source starting points, dependencies, and a concrete next action. Programming issues also have linked branches. #10 owns the engine invariant; #11 owns the separate controller cleanup, so they are related tasks rather than duplicate tickets.

Use the Project fields as the live plan:

- **Status:** Backlog → Ready → In progress → In review → Done. Ready means sufficiently scoped and unblocked. Done means acceptance criteria were verified and the implementation merged.
- **Size:** XS, S, M, L, XL express relative scope and uncertainty. Split XL work before starting it.
- **Estimate (hours):** expected focused work, including tests and manual validation.
- **Priority:** P0 is an urgent blocker, P1 is core gameplay or release work, P2 is a planned improvement. There is no artificial P0 in this initial plan.
- **Next Action Date:** when to take the specific next step described in the issue.
- **Due Date:** intended task completion date, distinct from the release milestone.
- **Sprint:** the planned iteration; **Milestone:** the release this issue supports.
- **Start date:** the planned work start used by the roadmap.

The issue body contains an initial planning snapshot for easy reading outside the Project. Keep it synchronized when changing the live fields. A branch with no implementation commits is a prepared workspace, not evidence of progress.

## Release targets

| Milestone | Target date | Planned outcome |
| --- | --- | --- |
| Alpha | October 19, 2026 | Rules-aligned gameplay and preliminary schedule import |
| Beta | November 16, 2026 | PNG slide-deck workflow and operator usability validation |
| RC | December 9, 2026 | Distribution readiness and planned schedule-service integration |

Dates come from the release sessions in the instructor-supplied **CS 195 Fall 2026 Tentative Course Schedule**, Plan A. Video deadlines are separate. Canvas remains authoritative and the schedule is tentative; these GitHub dates do not invent submission times or guarantee releases are complete.

## Access and visibility

The repository owner, `@mikeryu`, already has administrative access to this repository and its Project. Students must separately grant the instructor access to their own repository and Project, then verify both. Linking a repository to a Project does not grant access to either resource.

## Using an AI agent

An agent can inspect existing resources, draft issue acceptance criteria, create linked branches with `gh issue develop`, and maintain fields with `gh project` or supported GitHub tools. It should reuse resources rather than duplicate them and read back the resulting state. Review the plan, estimates, dates, and changes yourself.

For the local CLI, use its normal authentication flow and authorize the `project` scope when needed. Connector authentication is separate. Keep tokens out of prompts and committed files. Lack of a Projects tool in a connector is a reason to use the CLI or browser, not to claim the board is complete.

## Boundary of this example

This repository deliberately has **no submodule registration in the course deliverables repository**. Students must complete that separate part of their assignment for their own projects. The historical `TODOS.md` and `plan.md` remain as development notes; the linked GitHub issues and Project are the active planning example.
