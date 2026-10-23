import type { GitGraphCommit } from '../types/GitGraphCommit';
import type { GraphRowLayout } from '../types/GraphRowLayout';

export function buildGitGraphLayout(commits: GitGraphCommit[]) {
  const rows: GraphRowLayout[] = [];
  let activeLanes: Array<string | null> = [];
  let laneCount = 1;

  for (const commit of commits) {
    let lane = activeLanes.indexOf(commit.hash);
    const hasIncomingEdge = lane >= 0;
    if (!hasIncomingEdge) {
      lane = activeLanes.indexOf(null);
      if (lane < 0) lane = activeLanes.length;
      activeLanes[lane] = commit.hash;
    }

    const lanesBeforeCommit = activeLanes.slice();
    const lanesAfterCommit = activeLanes.slice();
    lanesAfterCommit[lane] = null;

    const parentLanes = commit.parents.map((parent, parentIndex) => {
      const existingLane = lanesAfterCommit.indexOf(parent);
      if (existingLane >= 0) return existingLane;

      if (parentIndex === 0) {
        lanesAfterCommit[lane] = parent;
        return lane;
      }

      let newLane = lanesAfterCommit.findIndex((value, index) => index > lane && value === null);
      if (newLane < 0) newLane = lanesAfterCommit.indexOf(null);
      if (newLane < 0) newLane = lanesAfterCommit.length;
      lanesAfterCommit[newLane] = parent;
      return newLane;
    });

    rows.push({
      lane,
      hasIncomingEdge,
      throughLanes: lanesBeforeCommit.flatMap((hash, index) =>
        hash !== null && index !== lane ? [index] : []
      ),
      parentLanes,
    });
    laneCount = Math.max(laneCount, lanesBeforeCommit.length, lanesAfterCommit.length, lane + 1);
    activeLanes = lanesAfterCommit;
  }

  return { rows, laneCount };
}
