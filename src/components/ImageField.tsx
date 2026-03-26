import { ImagePlus, Eye, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ImageKind, ImageSelection } from "../lib/types";
import { createImageSelection, DEFAULT_CROP_SETTINGS, renderCroppedImage } from "../lib/utils";

type ImageFieldProps = {
  title: string;
  imageKind: ImageKind;
  value: ImageSelection | null;
  onChange: (value: ImageSelection | null) => void;
  onPreview: (selection: ImageSelection, imageKind: ImageKind, title: string) => void;
};

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/bmp,image/gif";

export function ImageField({ title, imageKind, value, onChange, onPreview }: ImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fineTune, setFineTune] = useState(true);
  const rotationMin = fineTune ? -18 : -180;
  const rotationMax = fineTune ? 18 : 180;
  const rotationStep = fineTune ? "0.1" : "1";
  const layoutClassName =
    imageKind === "portrait" ? "image-card__body image-card__body--portrait" : "image-card__body";
  const previewClassName =
    imageKind === "portrait" ? "image-preview image-preview--portrait" : "image-preview image-preview--landscape";

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }

    let ignore = false;
    let objectUrl: string | null = null;

    renderCroppedImage(value.file, imageKind, value.crop)
      .then((result) => {
        if (ignore) {
          return;
        }
        objectUrl = URL.createObjectURL(result.blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!ignore) {
          setPreviewUrl(null);
        }
      });

    return () => {
      ignore = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageKind, value]);

  function setFile(file: File | null) {
    if (!file) {
      return;
    }
    onChange(createImageSelection(file));
  }

  function updateCrop(
    key:
      | "zoom"
      | "offsetX"
      | "offsetY"
      | "rotation"
      | "paddingLeft"
      | "paddingRight"
      | "paddingTop"
      | "paddingBottom",
    rawValue: number,
  ) {
    if (!value) {
      return;
    }
    onChange({
      ...value,
      crop: {
        ...value.crop,
        [key]: rawValue,
      },
    });
  }

  function resetCrop() {
    if (!value) {
      return;
    }
    onChange({
      ...value,
      crop: { ...DEFAULT_CROP_SETTINGS },
    });
  }

  return (
    <section className="image-card">
      <div className="image-card__header">
        <div>
          <p className="eyebrow">{imageKind === "landscape" ? "16:9 export" : "9:16 export"}</p>
          <h3>{title}</h3>
        </div>
        <ImagePlus size={20} />
      </div>

      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />

      <div className={layoutClassName}>
        <div className={previewClassName}>
          {value ? (
            <img className="image-thumb" src={previewUrl ?? value.sourceUrl} alt={title} />
          ) : (
            <div className="image-thumb image-thumb--empty" />
          )}
        </div>

        <div className="image-card__controls">
          <button
            className="drop-zone"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              setFile(event.dataTransfer.files[0] ?? null);
            }}
          >
            <Upload size={20} />
            <strong>{value ? value.file.name : "Dra en bild hit eller välj fil"}</strong>
            <span>{value ? "Byt bild om du vill ersätta den valda filen." : "PNG, JPG, WEBP, BMP eller GIF."}</span>
          </button>

          <div className="image-card__actions">
            <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
              Välj bild
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!value}
              onClick={() => value && onPreview(value, imageKind, title)}
            >
              <Eye size={16} />
              Preview
            </button>
            <button className="ghost-button" type="button" disabled={!value} onClick={() => onChange(null)}>
              Rensa
            </button>
            <button className="ghost-button" type="button" disabled={!value} onClick={resetCrop}>
              Återställ
            </button>
          </div>

          <div className="crop-controls">
            <label className="crop-toggle">
              <input
                type="checkbox"
                checked={fineTune}
                disabled={!value}
                onChange={(event) => setFineTune(event.target.checked)}
              />
              <span>Finjustering 10x</span>
            </label>
            <label className="crop-control">
              <span>Zoom</span>
              <input
                type="range"
                min="0.25"
                max="3"
                step={fineTune ? "0.001" : "0.01"}
                value={value?.crop.zoom ?? DEFAULT_CROP_SETTINGS.zoom}
                disabled={!value}
                onChange={(event) => updateCrop("zoom", Number(event.target.value))}
              />
            </label>
            <label className="crop-control">
              <span>X-led</span>
              <input
                type="range"
                min="-1"
                max="1"
                step={fineTune ? "0.001" : "0.01"}
                value={value?.crop.offsetX ?? 0}
                disabled={!value}
                onChange={(event) => updateCrop("offsetX", Number(event.target.value))}
              />
            </label>
            <label className="crop-control">
              <span>Y-led</span>
              <input
                type="range"
                min="-1"
                max="1"
                step={fineTune ? "0.001" : "0.01"}
                value={value?.crop.offsetY ?? 0}
                disabled={!value}
                onChange={(event) => updateCrop("offsetY", Number(event.target.value))}
              />
            </label>
            <label className="crop-control">
              <span>Rotation</span>
              <input
                type="range"
                min={String(rotationMin)}
                max={String(rotationMax)}
                step={rotationStep}
                value={value?.crop.rotation ?? 0}
                disabled={!value}
                onChange={(event) => updateCrop("rotation", Number(event.target.value))}
              />
            </label>
            {imageKind === "landscape" ? (
              <>
                <label className="crop-control">
                  <span>Svart padding vänster</span>
                  <input
                    type="range"
                    min="0"
                    max="0.35"
                    step={fineTune ? "0.001" : "0.01"}
                    value={value?.crop.paddingLeft ?? 0}
                    disabled={!value}
                    onChange={(event) => updateCrop("paddingLeft", Number(event.target.value))}
                  />
                </label>
                <label className="crop-control">
                  <span>Svart padding höger</span>
                  <input
                    type="range"
                    min="0"
                    max="0.35"
                    step={fineTune ? "0.001" : "0.01"}
                    value={value?.crop.paddingRight ?? 0}
                    disabled={!value}
                    onChange={(event) => updateCrop("paddingRight", Number(event.target.value))}
                  />
                </label>
              </>
            ) : null}
            {imageKind === "portrait" ? (
              <>
                <label className="crop-control">
                  <span>Svart padding uppe</span>
                  <input
                    type="range"
                    min="0"
                    max="0.35"
                    step={fineTune ? "0.001" : "0.01"}
                    value={value?.crop.paddingTop ?? 0}
                    disabled={!value}
                    onChange={(event) => updateCrop("paddingTop", Number(event.target.value))}
                  />
                </label>
                <label className="crop-control">
                  <span>Svart padding nere</span>
                  <input
                    type="range"
                    min="0"
                    max="0.35"
                    step={fineTune ? "0.001" : "0.01"}
                    value={value?.crop.paddingBottom ?? 0}
                    disabled={!value}
                    onChange={(event) => updateCrop("paddingBottom", Number(event.target.value))}
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
