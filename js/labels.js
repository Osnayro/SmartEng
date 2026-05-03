
// SmartFlowLabels - Mínimo funcional
console.log("Iniciando SmartFlowLabels mínimo...");

const SmartFlowLabels = (function() {
    console.log("IIFE ejecutado");

    var statusEl = document.getElementById('statusMsg');
    if (statusEl) {
        statusEl.innerText = "Labels: módulo cargado";
        statusEl.style.color = "#00ff00";
    }

    function init(core) {
        console.log("Labels.init llamado");
        if (statusEl) {
            statusEl.innerText = "Labels: init ejecutado";
        }
    }

    return {
        init: init
    };
})();

console.log("SmartFlowLabels definido: " + typeof SmartFlowLabels);
