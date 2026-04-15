export const loadImageFromDataUrl = (dataUrl) => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = dataUrl;
});

export const cropImageToBlob = async ({
  dataUrl,
  zoom = 1,
  outputWidth = 512,
  outputHeight = 512,
  mimeType = 'image/jpeg',
  quality = 0.92,
}) => {
  if (!dataUrl) return null;

  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scale = Math.max(1, Number(zoom) || 1);
  const targetAspect = outputWidth / outputHeight;
  const imageAspect = image.width / image.height;

  let sourceWidth;
  let sourceHeight;
  if (imageAspect > targetAspect) {
    sourceHeight = image.height / scale;
    sourceWidth = sourceHeight * targetAspect;
  } else {
    sourceWidth = image.width / scale;
    sourceHeight = sourceWidth / targetAspect;
  }

  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
};