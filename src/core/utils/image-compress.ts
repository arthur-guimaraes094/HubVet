/**
 * Redimensiona e comprime imagens no navegador (ex: fotos de 10MB do iPhone)
 * para um JPEG leve (400x400, ~35KB) garantindo upload instantâneo e compatibilidade universal.
 */
export async function compressPetPhoto(
  file: File,
  maxDimension = 400,
  quality = 0.82
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('Falha ao ler imagem'));
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context indisponível'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error('Falha ao comprimir imagem'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Formato de imagem inválido'));
      img.src = result;
    };
    reader.onerror = () => reject(new Error('Erro ao abrir arquivo de imagem'));
    reader.readAsDataURL(file);
  });
}
