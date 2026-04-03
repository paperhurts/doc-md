export interface VaultEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: VaultEntry[];
}

export interface GraphNode {
  id: string;
  label: string;
  links: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ParsedNote {
  path: string;
  name: string;
  frontmatter: Record<string, unknown>;
  links: string[];
  tags: string[];
}

export interface Backlink {
  path: string;
  name: string;
  contexts: string[];
}

export interface ForwardLink {
  target: string;
  resolved_path: string | null;
  exists: boolean;
}

export interface NoteName {
  name: string;
  path: string;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}
