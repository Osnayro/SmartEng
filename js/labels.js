
// SmartFlowLabels - Diagnóstico mínimo
console.log("Iniciando SmartFlowLabels mínimo...");

const SmartFlowLabels = (function() {
    console.log("SmartFlowLabels IIFE ejecutado.");

    const statusEl = document.getElementById('statusMsg');
    if (statusEl) {
        statusEl.innerText = "Labels: módulo cargado";
        statusEl.style.color = "#00ff00";
    }

    function init(core) {
        console.log("Labels.init llamado con core:", core);
        if (statusEl) {
            statusEl.innerText = "Labels: init ejecutado";
        }
    }

    return { init };
})();

console.log("SmartFlowLabels definido:", SmartFlowLabels);
```

---

Paso 2: Recarga la página y observa

Después de guardar, recarga la aplicación (Ctrl+F5 o Cmd+Shift+R para forzar recarga sin caché).

· Si la barra de estado dice "Labels: módulo cargado", el problema está resuelto. Puedes volver a una versión completa pero asegurándote de que no tenga errores.
· Si la barra de estado no cambia, mira la consola. Deberías ver los mensajes "Iniciando SmartFlowLabels mínimo..." y "SmartFlowLabels definido: [object Object]". Si no ves esos mensajes, algo muy extraño ocurre con la carga del archivo.
· Si en la consola aparece "Iniciando SmartFlowLabels mínimo..." pero luego un error en rojo, cópiamelo para ver qué lo causa.

---

Paso 3: Si typeof SmartFlowLabels sigue siendo undefined

Ejecuta en la consola:

```javascript
console.log(window.SmartFlowLabels);
```

Si responde undefined, entonces el IIFE no se está ejecutando. Puede ser que el archivo tenga un carácter oculto (como un BOM) que rompe el código. En ese caso, crea un nuevo archivo labels.js desde cero en tu editor y pega el código limpio.

---

Paso 4: Si el archivo mínimo funciona, migra gradualmente

Una vez confirmado que el módulo mínimo sí define la variable, puedes volver a poner la versión completa v1.6. Pero para evitar el error de nuevo, añade una verificación adicional al inicio del archivo:

```javascript
window.SmartFlowLabels = window.SmartFlowLabels || {};
