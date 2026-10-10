export interface GraphRowLayout {
    lane: number;
    hasIncomingEdge: boolean;
    throughLanes: number[];
    parentLanes: number[];
}
