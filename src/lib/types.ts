export type Kind = "task" | "event";
export type Status = "open" | "done" | "canceled";
export type Priority = "baixa" | "media" | "alta";

export interface Activity {
  id: string;
  kind: Kind;
  title: string;
  contextId: string | null;
  clientId: string | null;
  /** Civil date "YYYY-MM-DD". Tasks: optional deadline. Events: required. */
  date: string | null;
  /** Task: optional time. Event: start time. "HH:mm" */
  time: string | null;
  /** Event end time. "HH:mm" */
  endTime: string | null;
  description: string;
  priority: Priority;
  repeatWeekly: boolean;
  status: Status;
  /** Set once the next weekly occurrence has been created, so it is never duplicated. */
  nextCreated: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface Context {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface Client {
  id: string;
  name: string;
  color: string;
  notes: string;
  createdAt: number;
}

export interface Backup {
  app: "showliana";
  version: 1;
  exportedAt: string;
  activities: Activity[];
  contexts: Context[];
  clients: Client[];
}

/** Swatches shared by contexts and clients. Chosen to sit on warm paper. */
export const SWATCHES = [
  { name: "Lilás", value: "#8B78C4" },
  { name: "Ameixa", value: "#9A5B86" },
  { name: "Sálvia", value: "#5E8A72" },
  { name: "Mar", value: "#4F7D9C" },
  { name: "Mel", value: "#B8893A" },
  { name: "Tijolo", value: "#B5603F" },
  { name: "Grafite", value: "#56514C" },
  { name: "Rosa", value: "#C46A7E" },
];

export const DEFAULT_CONTEXTS: Context[] = [
  { id: "ctx-bardam", name: "Bardam", color: "#8B78C4", order: 0 },
  { id: "ctx-marca", name: "Projetos de marca", color: "#B5603F", order: 1 },
  { id: "ctx-portfolio", name: "Portfólio", color: "#4F7D9C", order: 2 },
  { id: "ctx-pessoal", name: "Pessoal", color: "#5E8A72", order: 3 },
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};
