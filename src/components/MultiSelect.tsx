import { useEffect, useRef, useState } from "react";

type MultiSelectProps = {
  placeholder: string;
  options: readonly string[];
  values: string[];
  onChange: (next: string[]) => void;
};

export function MultiSelect({ placeholder, options, values, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggle = (option: string) => {
    if (values.includes(option)) {
      onChange(values.filter((value) => value !== option));
    } else {
      onChange([...values, option]);
    }
  };

  const summary = values.length === 0 ? placeholder : values.join(", ");

  return (
    <div className={open ? "multi-select multi-select--open" : "multi-select"} ref={containerRef}>
      <button
        type="button"
        className="multi-select__trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={values.length === 0 ? "multi-select__summary multi-select__summary--placeholder" : "multi-select__summary"}>
          {summary}
        </span>
        <span className="multi-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="multi-select__panel" role="listbox">
          {options.map((option) => {
            const checked = values.includes(option);
            return (
              <label key={option} className={checked ? "multi-select__option multi-select__option--selected" : "multi-select__option"}>
                <input type="checkbox" checked={checked} onChange={() => toggle(option)} />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
