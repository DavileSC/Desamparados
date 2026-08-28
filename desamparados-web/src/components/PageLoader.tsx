import { Box, CircularProgress } from '@mui/material'

export default function PageLoader() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
      }}
    >
      <CircularProgress color="primary" />
    </Box>
  )
}
