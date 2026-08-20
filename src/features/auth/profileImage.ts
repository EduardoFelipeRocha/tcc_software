import type { ProfileAvatar } from './types'

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxInputBytes = 5 * 1024 * 1024
const maxStoredBytes = 128 * 1024

function decodedBytes(dataUrl: string) {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.ceil((payload.length * 3) / 4)
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível abrir esta imagem.'))
    }
    image.src = url
  })
}

export async function prepareProfileImage(file: File): Promise<ProfileAvatar> {
  if (!acceptedTypes.has(file.type)) {
    throw new Error('Escolha uma imagem JPEG, PNG ou WebP.')
  }
  if (file.size > maxInputBytes) {
    throw new Error('A imagem original deve ter no máximo 5 MB.')
  }

  const image = await loadImage(file)
  if (
    image.naturalWidth < 1 ||
    image.naturalHeight < 1 ||
    image.naturalWidth * image.naturalHeight > 40_000_000
  ) {
    throw new Error('Escolha uma imagem válida com até 40 megapixels.')
  }
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2)
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2)

  for (const targetSize of [320, 256, 192]) {
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Seu navegador não conseguiu processar a imagem.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.fillStyle = '#f4f6f2'
    context.fillRect(0, 0, targetSize, targetSize)
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      targetSize,
      targetSize,
    )

    for (const quality of [0.84, 0.72, 0.6]) {
      const dataUrl = canvas.toDataURL('image/webp', quality)
      if (dataUrl.startsWith('data:image/webp') && decodedBytes(dataUrl) <= maxStoredBytes) {
        return { type: 'upload', dataUrl }
      }
      const jpegDataUrl = canvas.toDataURL('image/jpeg', quality)
      if (decodedBytes(jpegDataUrl) <= maxStoredBytes) {
        return { type: 'upload', dataUrl: jpegDataUrl }
      }
    }
  }

  throw new Error('Não foi possível reduzir a foto para o limite de 128 KB.')
}
