import type { Actor } from "../api/types";

interface Props {
  actors: Actor[];
  value: string;
  onChange: (actorId: string) => void;
}

/** Actor dropdown: determines who is recorded in the audit log. */
export function ActorSelect({ actors, value, onChange }: Props) {
  return (
    <label className="actor-select">
      Acting as
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {actors.map((actor) => (
          <option key={actor.id} value={actor.id}>
            {actor.name} ({actor.id})
          </option>
        ))}
      </select>
    </label>
  );
}
