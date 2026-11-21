# Sokoban Solver — Room by Room, Push-Optimal

[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/rendelsu/sokoban-solver-01-run-20261121-entry/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/rendelsu/sokoban-solver-01-run-20261121-entry/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

A push-optimal Sokoban solver for the [sokoban-solver-01-run-20261121](https://make.fun/bounty/sokoban-solver-01-run-20261121) bounty on [make.fun](https://make.fun/r/rkkz4bh8).

## How it works

A generated level is a hallway with independent rooms off it. A box pushed
through a door lands in the hallway, where it reaches no goal, so no box
ever leaves its room — the level's optimum is the sum of its rooms' optima.

`main.ts` therefore splits each level into rooms (cutting the hallway's dead
squares out of the floor) and solves each room on its own with a
breadth-first search over pushes, so the first solved state met is
push-optimal. The search is pruned by two deadlocks that can never be
undone: a box on a square no pull from a goal can reach, and a box frozen
inside a 2 x 2 block of walls and boxes. The player's walk between pushes is
the shortest path around the boxes. No clock, no randomness: the same input
always gives the same moves.

## Running it

```sh
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Reads `/input/<id>/level.txt` (XSB) and writes `/output/<id>/solution.txt`
(moves in LURD) for every instance in the set.

## License

MIT — see [LICENSE](LICENSE).
