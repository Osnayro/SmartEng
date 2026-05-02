
const SmartFlowCommands = (function() {
    // Prueba de carga: escribe en la barra de estado
    const statusEl = document.getElementById('statusMsg');
    if (statusEl) {
        statusEl.innerText = "Commands cargado OK";
        statusEl.style.color = "#00ff00";
    }

    function init(core, catalog, render, notifyFn) {
        if (statusEl) statusEl.innerText = "Commands.init ejecutado";
    }

    function executeCommand(cmd) { return false; }
    function executeBatch(txt) {}

    return { init, executeCommand, executeBatch };
})();
