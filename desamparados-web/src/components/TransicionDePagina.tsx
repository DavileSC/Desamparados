import { motion } from 'framer-motion'
import { Box } from '@mui/material'

interface TransicionDePaginaProps {
  children: React.ReactNode
}

export default function TransicionDePagina({ children }: TransicionDePaginaProps) {
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      sx={{ minHeight: 'inherit' }}
    >
      {children}
    </Box>
  )
}
