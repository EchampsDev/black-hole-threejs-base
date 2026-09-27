# Black Hole Three.js · base original

Demo interactiva de un agujero negro en Three.js/WebGL. Este repositorio conserva la base descargada para comparar futuras mejoras y reutilizar sus técnicas en otros proyectos.

## Vista previa local

Es un sitio estático: `index.html`, `style.css` y `script.js`. Necesita conexión para cargar Three.js 0.163 desde jsDelivr y la fuente Inter desde Google Fonts. Inicia un servidor local en esta carpeta, por ejemplo:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. Arrastra para girar la cámara y usa la rueda o el gesto de pellizco para acercar. No abras `index.html` directamente como `file://` porque las importaciones ES pueden fallar.

## Publicar una vista previa en GitHub Pages

En **Settings → Pages**, elige **Deploy from a branch**, `main` y `/ (root)`. GitHub mostrará la URL cuando termine la publicación. El sitio es estático y no necesita compilación. La vista previa requiere acceso a los CDN indicados arriba.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `index.html` | Import map de Three.js y estructura de la página |
| `style.css` | Diseño de pantalla completa |
| `script.js` | Escena, estrellas, shaders, disco, controles y postprocesado |

## Procedencia y derechos

Código base descargado del proyecto [Black Hole Animation de CodeWithBhurtel](https://codewithbhurtel.com/projects/78). Una implementación idéntica se explica en [Coding Stella](https://codingstella.com/how-to-make-black-hole-animation-using-html-css-three-js/). Se conserva la atribución; **este repositorio no declara una licencia nueva sobre el código original**. Consulta las condiciones de los autores antes de redistribuirlo o incorporarlo a un producto.

## Notas para la siguiente iteración

- La lente gravitacional es una deformación de pantalla en `ShaderPass`, no un trazado físico de rayos.
- Revisar los bordes invertidos de `smoothstep` en el shader de lente y el centro de `normalize(toCenter)`.
- `clock.getElapsedTime()` seguido de `clock.getDelta()` reduce casi a cero el tiempo usado en las rotaciones.
- El mapeo de color del disco sitúa el blanco hacia el borde exterior; estudiar un gradiente caliente en la parte interior.
- Medir el rendimiento de 150 000 estrellas y los pases de postprocesado en teléfonos antes de elevar la calidad.

El archivo original del ZIP se ha conservado sin cambios en estos tres archivos. Un futuro desarrollo cinematográfico debería hacerse en otra rama.
