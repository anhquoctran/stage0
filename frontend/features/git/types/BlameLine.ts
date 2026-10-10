export interface BlameLine {
  line_no: number;
  orig_line_no: number;
  commit_id: string;
  content: string;
}
