import { useState } from 'react'
import { Box, Dialog, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

interface GaleriaDeFotosProps {
  images: { src: string; alt: string }[]
  columns?: number
}

export default function GaleriaDeFotos({ images, columns = 3 }: GaleriaDeFotosProps) {
  const [open, setOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleOpen = (index: number) => {
    setCurrentIndex(index)
    setOpen(true)
  }

  const handleClose = () => setOpen(false)

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 2,
        }}
      >
        {images.map((image, index) => (
          <Box
            key={index}
            component="button"
            type="button"
            onClick={() => handleOpen(index)}
            aria-label={`Ampliar imagen: ${image.alt}`}
            sx={{
              position: 'relative',
              aspectRatio: '4 / 3',
              borderRadius: '8px',
              overflow: 'hidden',
              cursor: 'pointer',
              p: 0,
              border: 'none',
              background: 'none',
              width: '100%',
              '&:hover img': { transform: 'scale(1.05)', opacity: 0.9 },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
            }}
          >
            <Box
              component="img"
              src={image.src}
              alt={image.alt}
              loading="lazy"
              decoding="async"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.5s ease, opacity 0.3s ease',
              }}
            />
          </Box>
        ))}
      </Box>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'rgba(7, 6, 8, 0.95)',
              boxShadow: 'none',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: { xs: '300px', md: '600px' },
            p: 2,
          }}
        >
          <IconButton
            onClick={handleClose}
            aria-label="Cerrar"
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'white',
              zIndex: 10,
            }}
          >
            <CloseIcon />
          </IconButton>

          <IconButton
            onClick={handlePrev}
            aria-label="Imagen anterior"
            sx={{
              position: 'absolute',
              left: 16,
              color: 'white',
              zIndex: 10,
            }}
          >
            <ChevronLeftIcon />
          </IconButton>

          <Box
            component="img"
            src={images[currentIndex]?.src}
            alt={images[currentIndex]?.alt}
            sx={{
              maxWidth: '100%',
              maxHeight: { xs: '70vh', md: '80vh' },
              objectFit: 'contain',
            }}
          />

          <IconButton
            onClick={handleNext}
            aria-label="Imagen siguiente"
            sx={{
              position: 'absolute',
              right: 16,
              color: 'white',
              zIndex: 10,
            }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Dialog>
    </>
  )
}
