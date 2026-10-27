import { toBlob } from "html-to-image";

function resolveBackgroundColor(node: HTMLElement) {
  const fromNode = getComputedStyle(node).backgroundColor;
  if (
    fromNode &&
    fromNode !== "rgba(0, 0, 0, 0)" &&
    fromNode !== "transparent"
  ) {
    return fromNode;
  }
  const fromBody = getComputedStyle(document.body).backgroundColor;
  if (
    fromBody &&
    fromBody !== "rgba(0, 0, 0, 0)" &&
    fromBody !== "transparent"
  ) {
    return fromBody;
  }
  return "#ffffff";
}

function withAvatarFallbacksOnly<T>(node: HTMLElement, run: () => Promise<T>) {
  const images = Array.from(node.querySelectorAll("img"));
  const fallbacks = Array.from(
    node.querySelectorAll<HTMLElement>('[data-slot="avatar-fallback"]'),
  );

  const previousImageDisplay = images.map((img) => img.style.display);
  const previousFallbackDisplay = fallbacks.map((el) => el.style.display);

  images.forEach((img) => {
    img.style.display = "none";
  });
  fallbacks.forEach((el) => {
    el.style.display = "flex";
  });

  return run().finally(() => {
    images.forEach((img, index) => {
      img.style.display = previousImageDisplay[index] ?? "";
    });
    fallbacks.forEach((el, index) => {
      el.style.display = previousFallbackDisplay[index] ?? "";
    });
  });
}

async function captureElementBlob(node: HTMLElement) {
  const options = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: resolveBackgroundColor(node),
  };

  try {
    return await toBlob(node, options);
  } catch {
    // ESPN (and other) logos often lack CORS headers; fall back to initials.
    return withAvatarFallbacksOnly(node, () => toBlob(node, options));
  }
}

function assertClipboardImageSupport() {
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard?.write ||
    typeof ClipboardItem === "undefined"
  ) {
    throw new Error(
      "Copy as image isn’t supported in this browser. Try Chrome, Safari, or Edge on HTTPS.",
    );
  }
}

/**
 * Capture `node` as a PNG and write it to the system clipboard.
 *
 * Passes a Promise into ClipboardItem first so Safari/iOS can keep the
 * user-gesture context while html-to-image runs; falls back to a resolved
 * Blob for browsers that reject Promise values.
 */
export async function copyElementAsPng(node: HTMLElement) {
  assertClipboardImageSupport();

  const blobPromise = captureElementBlob(node).then((blob) => {
    if (!blob) {
      throw new Error("Failed to capture image.");
    }
    return blob;
  });

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blobPromise }),
    ]);
    return;
  } catch (error) {
    // Chrome / some desktop browsers want a resolved Blob, not a Promise.
    const blob = await blobPromise;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch {
      throw error instanceof Error
        ? error
        : new Error("Couldn’t copy image to the clipboard.");
    }
  }
}
