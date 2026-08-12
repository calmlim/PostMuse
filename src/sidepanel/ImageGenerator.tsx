import {
  DownloadSimple,
  GearSix,
  ImageSquare,
  Sparkle,
  StopCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRequestId } from "../core/contracts/messages";
import { buildImagePrompt } from "../core/image/prompt-builder";
import type { ImageGenerationResult, ImageHistoryMetadata, ImageStyle } from "../core/image/types";
import type { SettingsSnapshot } from "../core/settings/types";
import type { Messages } from "../i18n";
import { requestProviderOriginPermission, sendExtensionRequest } from "./extension-client";

interface ImageGeneratorProps {
  copy: Messages;
  sourceText: string;
  snapshot?: SettingsSnapshot;
  onOpenSettings: () => void;
  onClose: () => void;
  onGenerated?: (metadata: ImageHistoryMetadata) => void;
}

const getFriendlyImageError = (error: unknown, copy: Messages): string => {
  if (!(error instanceof Error)) {
    return copy.imageErrorGeneric;
  }
  const localized: Partial<Record<string, string>> = {
    API_KEY_REQUIRED: copy.errorKeyRequired,
    MODEL_REQUIRED: copy.errorModelRequired,
    HOST_PERMISSION_REQUIRED: copy.errorPermissionRequired,
    AUTH_INVALID: copy.errorAuthInvalid,
    MODEL_FORBIDDEN: copy.errorModelForbidden,
    MODEL_NOT_FOUND: copy.errorModelNotFound,
    ENDPOINT_NOT_FOUND: copy.errorEndpointNotFound,
    PROVIDER_REQUEST_INVALID: copy.errorProviderRequestInvalid,
    RATE_LIMITED: copy.errorRateLimited,
    PROVIDER_UNAVAILABLE: copy.errorProviderUnavailable,
    TIMEOUT: copy.errorTimeout,
    NETWORK_ERROR: copy.errorNetwork,
    CONTENT_REJECTED: copy.errorContentRejected,
    OUTPUT_INVALID: copy.errorOutputInvalid,
    REQUEST_CANCELLED: copy.generationCancelled,
  };
  return localized[error.name] ?? error.message ?? copy.imageErrorGeneric;
};

export const imageResultToBlob = (result: ImageGenerationResult): Blob => {
  const binary = atob(result.base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: result.mimeType });
};

export function ImageGenerator({
  copy,
  sourceText,
  snapshot,
  onOpenSettings,
  onClose,
  onGenerated,
}: ImageGeneratorProps) {
  const [style, setStyle] = useState<ImageStyle>("editorial");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16">("1:1");
  const [size, setSize] = useState<"1K" | "2K">("1K");
  const [includeText, setIncludeText] = useState(false);
  const [prompt, setPrompt] = useState(() => buildImagePrompt(sourceText, "editorial", false));
  const [result, setResult] = useState<ImageGenerationResult>();
  const [objectUrl, setObjectUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [isGenerating, setIsGenerating] = useState(false);
  const activeRequestId = useRef<string | undefined>(undefined);

  const profile = useMemo(
    () =>
      snapshot?.settings.imageProviderProfiles.find(
        (item) => item.id === snapshot.settings.activeImageProviderProfileId,
      ),
    [snapshot],
  );
  const isConfigured = Boolean(profile?.model.trim() && snapshot?.activeImageSecretStatus?.hasKey);

  useEffect(() => {
    setPrompt(buildImagePrompt(sourceText, "editorial", false));
    setStyle("editorial");
    setIncludeText(false);
    setResult(undefined);
    setError(undefined);
  }, [sourceText]);

  useEffect(() => {
    if (!result || typeof URL.createObjectURL !== "function") {
      setObjectUrl(undefined);
      return;
    }
    try {
      const nextUrl = URL.createObjectURL(imageResultToBlob(result));
      setObjectUrl(nextUrl);
      return () => URL.revokeObjectURL(nextUrl);
    } catch {
      setObjectUrl(undefined);
      setError(copy.errorOutputInvalid);
    }
  }, [copy.errorOutputInvalid, result]);

  const updatePromptDirection = (nextStyle: ImageStyle, nextIncludeText: boolean) => {
    setStyle(nextStyle);
    setIncludeText(nextIncludeText);
    setPrompt(buildImagePrompt(sourceText, nextStyle, nextIncludeText));
    setResult(undefined);
    setError(undefined);
  };

  const generate = async () => {
    if (!profile || !isConfigured) {
      setError(copy.imageSetupRequired);
      return;
    }

    let permissionPromise: Promise<boolean>;
    try {
      permissionPromise = requestProviderOriginPermission(profile.baseUrl);
    } catch (permissionError) {
      setError(getFriendlyImageError(permissionError, copy));
      return;
    }

    const requestId = createRequestId();
    activeRequestId.current = requestId;
    setIsGenerating(true);
    setError(undefined);
    setResult(undefined);
    try {
      const allowed = await permissionPromise;
      if (!allowed) {
        throw Object.assign(new Error(copy.errorPermissionRequired), {
          name: "HOST_PERMISSION_REQUIRED",
        });
      }
      if (activeRequestId.current !== requestId) {
        return;
      }
      const generated = await sendExtensionRequest(
        {
          type: "image.generate",
          input: { sourceText, prompt: prompt.trim(), style, aspectRatio, size, includeText },
        },
        { requestId },
      );
      if (activeRequestId.current === requestId) {
        setResult(generated);
        onGenerated?.({
          type: "image",
          provider: generated.provider,
          model: generated.model,
          prompt: generated.prompt,
          aspectRatio: generated.aspectRatio,
          size: generated.size,
          mimeType: generated.mimeType,
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (generationError) {
      if (activeRequestId.current === requestId) {
        setError(getFriendlyImageError(generationError, copy));
      }
    } finally {
      if (activeRequestId.current === requestId) {
        activeRequestId.current = undefined;
        setIsGenerating(false);
      }
    }
  };

  const cancel = () => {
    const targetRequestId = activeRequestId.current;
    if (!targetRequestId) {
      return;
    }
    activeRequestId.current = undefined;
    setIsGenerating(false);
    setError(copy.generationCancelled);
    void sendExtensionRequest({ type: "image.cancel", targetRequestId }).catch(() => undefined);
  };

  const download = () => {
    if (!objectUrl || !result) {
      return;
    }
    const extension = result.mimeType === "image/jpeg" ? "jpg" : result.mimeType.split("/")[1];
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `postmuse-${Date.now()}.${extension}`;
    anchor.click();
  };

  return (
    <section className="image-generator" aria-labelledby="image-generator-title">
      <div className="image-generator-heading">
        <span className="image-generator-icon" aria-hidden="true">
          <ImageSquare size={19} weight="duotone" />
        </span>
        <div>
          <h3 id="image-generator-title">{copy.imageGeneratorTitle}</h3>
          <p>{copy.imageGeneratorBody}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label={copy.inlineClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="image-options">
        <label className="form-field">
          <span>{copy.imageStyleLabel}</span>
          <select
            value={style}
            onChange={(event) =>
              updatePromptDirection(event.target.value as ImageStyle, includeText)
            }
            disabled={isGenerating}
          >
            <option value="editorial">{copy.imageStyleEditorial}</option>
            <option value="illustration">{copy.imageStyleIllustration}</option>
            <option value="photographic">{copy.imageStylePhotographic}</option>
            <option value="minimal">{copy.imageStyleMinimal}</option>
            <option value="diagram">{copy.imageStyleDiagram}</option>
          </select>
        </label>
        <label className="form-field">
          <span>{copy.imageAspectRatioLabel}</span>
          <select
            value={aspectRatio}
            onChange={(event) => setAspectRatio(event.target.value as typeof aspectRatio)}
            disabled={isGenerating}
          >
            <option value="1:1">1:1</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
        </label>
        <label className="form-field">
          <span>{copy.imageSizeLabel}</span>
          <select
            value={size}
            onChange={(event) => setSize(event.target.value as typeof size)}
            disabled={isGenerating}
          >
            <option value="1K">1K</option>
            <option value="2K">2K</option>
          </select>
          {profile?.provider === "openai" && size === "2K" ? (
            <small>{copy.imageOpenAI2KLocalNotice}</small>
          ) : null}
        </label>
      </div>

      <label className="image-text-choice">
        <input
          type="checkbox"
          checked={includeText}
          onChange={(event) => updatePromptDirection(style, event.target.checked)}
          disabled={isGenerating}
        />
        <span>{copy.imageIncludeText}</span>
      </label>

      <label className="form-field image-prompt-field">
        <span>{copy.imagePromptLabel}</span>
        <textarea
          aria-label={copy.imagePromptLabel}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setResult(undefined);
            setError(undefined);
          }}
          rows={9}
          maxLength={20_000}
          disabled={isGenerating}
        />
        <small>{copy.imagePromptHint}</small>
      </label>

      {!isConfigured ? (
        <button type="button" className="setup-callout" onClick={onOpenSettings}>
          <GearSix size={18} weight="duotone" aria-hidden="true" />
          <span>
            <strong>{copy.imageSetupRequired}</strong>
            <small>{copy.imageOpenSettings}</small>
          </span>
        </button>
      ) : null}

      {error ? (
        <div className="feedback" data-kind="error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="image-generator-actions">
        {isGenerating ? (
          <button type="button" className="secondary-button" onClick={cancel}>
            <StopCircle size={17} weight="bold" aria-hidden="true" />
            {copy.cancelImageGeneration}
          </button>
        ) : null}
        <button
          type="button"
          className="primary-button"
          onClick={generate}
          disabled={isGenerating || !prompt.trim()}
        >
          <Sparkle size={17} weight="fill" aria-hidden="true" />
          {isGenerating ? copy.imageGenerating : copy.generateImage}
        </button>
      </div>
      {profile ? (
        <p className="provider-disclosure">
          {copy.imageProviderDisclosure
            .replace("{provider}", profile.displayName)
            .replace("{origin}", new URL(profile.baseUrl).origin)}
        </p>
      ) : null}

      {result && objectUrl ? (
        <figure className="image-preview">
          <img src={objectUrl} alt={copy.imageReady} />
          <figcaption>
            <span>
              {copy.imageReady} · {result.aspectRatio} · {result.size}
              {result.pixelWidth && result.pixelHeight
                ? ` · ${result.pixelWidth}×${result.pixelHeight}`
                : ""}
              {result.provider === "openai" && result.size === "2K"
                ? ` · ${copy.imageOpenAI2KLocalBadge}`
                : ""}
            </span>
            <button type="button" className="secondary-button" onClick={download}>
              <DownloadSimple size={17} weight="bold" aria-hidden="true" />
              {copy.downloadImage}
            </button>
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
