Geraldton — installed.

  geraldton-medium.woff2   Medium / 500
  geraldton-bold.woff2     Bold / 700
  geraldton-black.woff2    Black / 900

Converted from the OTF originals with fontTools. woff2 is a container format,
so these hold the same outlines, kerning pairs and OpenType features as the
desktop files -- nothing was redrawn or approximated. Full character set,
including the Cyrillic, since the files are small enough that subsetting was
not worth the risk of dropping a glyph.

The @font-face rules that load these live at the top of assets/css/styles.css.
If you ever add a weight, add a matching @font-face block there.

LICENCE: serving a font from a website needs a webfont licence, which foundries
sell separately from the desktop one. Make sure yours covers web use before the
site goes live.
