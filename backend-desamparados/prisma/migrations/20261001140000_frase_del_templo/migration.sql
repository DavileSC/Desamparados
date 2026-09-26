-- La entrada de la parroquia describe el templo como se ve en su ilustración.
--
-- Solo se cambia esa frase, donde siga igual: el resto de la página, editada o
-- no en el CMS, se queda como está.

UPDATE `ContenidoPagina`
SET `datos` = REPLACE(`datos`, 'una estructura triangular sin columnas, con forma de concha y lucernas circulares. En él celebramos', 'paredes blancas, una cubierta verde que se abre en abanico y la torre de la cruz. En él celebramos')
WHERE `slug` = 'parroquia' AND `datos` LIKE '%una estructura triangular sin columnas, con forma de concha y lucernas circulares. En él celebramos%';
