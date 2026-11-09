/** La rejilla de las noticias, la de verdad y la de su esqueleto: las dos miden igual y no salta al llegar. */
export const rejillaDeNoticias = (columnas = 3) => ({
  listStyle: 'none', m: 0, p: 0, display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: `repeat(${columnas}, 1fr)` },
  gap: { xs: 3, md: 3.25 },
}) as const
