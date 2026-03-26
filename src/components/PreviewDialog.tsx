import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { CropPreviewState } from "../lib/types";
import { renderCroppedImage } from "../lib/utils";

type PreviewDialogProps = {
  preview: CropPreviewState;
  onClose: () => void;
};

export function PreviewDialog({ preview, onClose }: PreviewDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [details, setDetails] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!preview) {
      return;
    }

    let ignore = false;
    let objectUrl: string | null = null;

    renderCroppedImage(preview.selection.file, preview.imageKind, preview.selection.crop)
      .then((result) => {
        if (ignore) {
          return;
        }
        objectUrl = URL.createObjectURL(result.blob);
        setImageUrl(objectUrl);
        setDetails(`Visar samma center crop som exporten använder (${result.crop.width}x${result.crop.height}).`);
        setError("");
      })
      .catch((nextError) => {
        if (ignore) {
          return;
        }
        setError(nextError instanceof Error ? nextError.message : "Preview misslyckades.");
      });

    return () => {
      ignore = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [preview]);

  useEffect(() => {
    if (!preview) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, preview]);

  if (!preview) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="dialog__header">
          <div>
            <p className="eyebrow">Preview</p>
            <h3>{preview.title}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Stäng">
            <X size={18} />
          </button>
        </div>

        {error ? <p className="status status--error">{error}</p> : null}
        {!error && !imageUrl ? <p className="status">Renderar preview...</p> : null}
        {imageUrl ? <img className="preview-image" src={imageUrl} alt={preview.title} /> : null}
        {details ? <p className="dialog__meta">{details}</p> : null}
      </div>
    </div>
  );
}
