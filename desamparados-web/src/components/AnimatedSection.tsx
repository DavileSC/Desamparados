import { motion } from 'framer-motion'
import { Box, type BoxProps } from '@mui/material'

interface AnimatedSectionProps extends BoxProps {
  children: React.ReactNode
  delay?: number
}

export default function AnimatedSection({
  children,
  delay = 0,
  sx,
  ...props
}: AnimatedSectionProps) {
  return (
    <Box
      component={motion.section}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      sx={sx}
      {...props}
    >
      {children}
    </Box>
  )
}
