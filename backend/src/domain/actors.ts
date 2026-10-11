/**
 * Hardcoded list of actors (internal users).
 * No auth: the actor is picked from a dropdown in the frontend and validated in the backend.
 */
export const ACTORS = [
  { id: "john.doe", name: "John Doe" },
  { id: "jane.smith", name: "Jane Smith" },
  { id: "budi.santoso", name: "Budi Santoso" },
  { id: "sari.wijaya", name: "Sari Wijaya" },
] as const;

export type ActorId = (typeof ACTORS)[number]["id"];

export function isActorId(value: unknown): value is ActorId {
  return typeof value === "string" && ACTORS.some((actor) => actor.id === value);
}
