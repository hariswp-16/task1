import { useState, type FormEvent } from "react";

interface Props {
  disabled: boolean;
  onSubmit: (input: { title: string; description: string }) => Promise<void>;
}

export function TaskForm({ disabled, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onSubmit({ title, description });
    setTitle("");
    setDescription("");
  }

  return (
    <form className="card task-form" onSubmit={handleSubmit}>
      <h2>Create task</h2>
      <label>
        Title <span className="required">*</span>
        <input
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Prepare Invoice"
          required
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          maxLength={1000}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <button type="submit" disabled={disabled || !title.trim()}>
        Add task
      </button>
    </form>
  );
}
