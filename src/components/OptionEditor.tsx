import { useState } from "react";
import { PencilLine, Plus, Trash2 } from "lucide-react";

type OptionEditorProps = {
  title: string;
  values: string[];
  onChange: (values: string[]) => void;
};

export function OptionEditor({ title, values, onChange }: OptionEditorProps) {
  const [draft, setDraft] = useState("");
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  function addItem() {
    const next = draft.trim();
    if (!next || values.includes(next)) {
      return;
    }
    onChange([...values, next].sort((a, b) => a.localeCompare(b, "sv")));
    setDraft("");
  }

  function updateItem() {
    const next = draft.trim();
    if (!selectedValue || !next) {
      return;
    }
    const withoutSelected = values.filter((value) => value !== selectedValue);
    if (withoutSelected.includes(next)) {
      return;
    }
    onChange([...withoutSelected, next].sort((a, b) => a.localeCompare(b, "sv")));
    setSelectedValue(next);
    setDraft(next);
  }

  function removeItem() {
    if (!selectedValue) {
      return;
    }
    onChange(values.filter((value) => value !== selectedValue));
    setSelectedValue(null);
    setDraft("");
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Inställningar</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="option-editor">
        <div className="option-list">
          {values.map((value) => (
            <button
              key={value}
              className={value === selectedValue ? "option-chip option-chip--selected" : "option-chip"}
              type="button"
              onClick={() => {
                setSelectedValue(value);
                setDraft(value);
              }}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="option-actions">
          <label className="field">
            <span>Värde</span>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Nytt ${title.toLowerCase()}`} />
          </label>

          <div className="button-row button-row--start">
            <button className="secondary-button" type="button" onClick={addItem}>
              <Plus size={16} />
              Lägg till
            </button>
            <button className="secondary-button" type="button" onClick={updateItem}>
              <PencilLine size={16} />
              Uppdatera vald
            </button>
            <button className="ghost-button" type="button" onClick={removeItem}>
              <Trash2 size={16} />
              Ta bort vald
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
