// TEMP stub -- TreeNode type only; file/S3 helpers added in Phase-4 Task 3/4

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  children?: TreeNode[];
}
