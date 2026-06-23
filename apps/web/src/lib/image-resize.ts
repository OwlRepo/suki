const VALID_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export async function resizeImageToDataUrl(
  file: File,
  maxEdge = 256,
  maxBytes = 80 * 1024,
) {
  if (!VALID_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use PNG, JPEG, or WebP image.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to resize image right now.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  for (const type of ["image/webp", "image/jpeg"] as const) {
    for (const quality of [0.92, 0.82, 0.72, 0.62, 0.52]) {
      const blob = await canvasToBlob(canvas, type, quality);
      if (!blob) continue;
      if (type === "image/webp" && blob.type !== "image/webp") continue;

      if (blob.size <= maxBytes) {
        return blobToDataUrl(blob);
      }
    }
  }

  throw new Error("Logo must be 80KB or smaller after resizing.");
}

async function loadImage(file: File) {
  const src = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to load image."));
      image.src = src;
    });
  } finally {
    URL.revokeObjectURL(src);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read resized image."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Unable to read resized image."));
    reader.readAsDataURL(blob);
  });
}
