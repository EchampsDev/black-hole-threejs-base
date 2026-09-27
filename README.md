# Black Hole · Cinematic Lab

Demo interactiva de un agujero negro en Three.js/WebGL. `main` conserva los archivos originales; `cinematic-v2` contiene una versión experimental con controles cinematográficos. El resultado es una visualización artística inspirada en la física, no una simulación relativista precisa.

## Presets y controles

- **Estética:** Observatorio (cálida y sobria), Horizonte (ámbar intenso), Espacio profundo (sombras frías), Noir (oscura y contenida).
- **Calidad:** Auto, Baja, Media, Alta y Ultra. Ajusta la resolución interna, estrellas dibujadas y bloom sin cambiar la estética. Auto elige inicialmente según dispositivo; Ultra se selecciona manualmente.
- **Ajustes finos:** curvatura de luz, resplandor y exposición; cámara orbital lenta y pausa de animación.
- Los ajustes se guardan localmente en el navegador y pueden restablecerse. La cámara se detiene 12 segundos al manipular la escena.

En dispositivos sin WebGL se muestra un mensaje en lugar de una pantalla vacía.

## Vista previa local

Es un sitio estático: `index.html`, `style.css` y `script.js`. Necesita conexión para cargar Three.js 0.163 desde jsDelivr y la fuente Inter desde Google Fonts. Inicia un servidor local en esta carpeta, por ejemplo:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000`. Arrastra para girar la cámara y usa la rueda o el gesto de pellizco para acercar. No abras `index.html` directamente como `file://` porque las importaciones ES pueden fallar.

## Publicar una vista previa en GitHub Pages

En **Settings → Pages**, elige **Deploy from a branch**, `cinematic-v2` y `/ (root)` para mostrar esta versión, sin alterar la rama `main`. El sitio es estático y no necesita compilación. La vista previa requiere acceso a los CDN indicados arriba.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `index.html` | Import map de Three.js y estructura de la página |
| `style.css` | Diseño de pantalla completa |
| `script.js` | Escena, shaders, controles y postprocesado |
| `presets.js` | Paletas cinematográficas y presupuestos de rendimiento |

## Procedencia y derechos

Código base descargado del proyecto [Black Hole Animation de CodeWithBhurtel](https://codewithbhurtel.com/projects/78). Una implementación idéntica se explica en [Coding Stella](https://codingstella.com/how-to-make-black-hole-animation-using-html-css-three-js/). Se conserva la atribución; **este repositorio no declara una licencia nueva sobre el código original**. Consulta las condiciones de los autores antes de redistribuirlo o incorporarlo a un producto.

## Mejoras de esta rama

- La lente sigue siendo una deformación de pantalla en `ShaderPass`, no un trazado físico de rayos; se limita su alcance y se evita el comportamiento indefinido en el centro.
- El disco ahora es más caliente cerca del borde interior, con una asimetría de brillo inspirada en el efecto Doppler y un anillo de fotones artístico separado del horizonte negro.
- Un único `clock.getDelta()` anima los elementos sin el delta casi nulo de la base original.
- La paleta estelar evita el aspecto de confeti multicolor; calidad Baja desactiva bloom para ahorrar GPU.

La futura fase física podría sustituir la lente de pantalla por una aproximación de rayos más convincente y curvar explícitamente la cara posterior del disco.
