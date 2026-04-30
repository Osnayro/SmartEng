// ============================================================
// MÓDULO: SMARTFLOW AUTOCOMPLETE v6.0 (Sugerencias de comandos)
// Archivo: js/autocomplete.js
// ============================================================

const SmartFlowAutocomplete = (function() {
    
    // Dependencias inyectadas
    let _core = null;
    let _catalog = null;
    let _commands = null;
    
    // Elementos del DOM
    let _textarea = null;
    let _suggestionBox = null;
    let _currentSuggestions = [];
    let _selectedIndex = -1;
    
    // -------------------- 1. DICCIONARIO DE SINTAXIS --------------------
    const keywords = [
        'create', 'crear', 'crea',
        'edit', 'editar',
        'delete', 'eliminar', 'borrar',
        'connect', 'conectar',
        'route', 'ruta',
        'list', 'listar',
        'audit', 'auditar',
        'bom', 'mto',
        'help', 'ayuda',
        'undo', 'deshacer',
        'redo', 'rehacer',
        'info', 'tap', 'split'
    ];
    
    const parameters = [
        'at', 'diam', 'diametro', 'height', 'altura', 'largo',
        'material', 'spec', 'diameter', 'entries', 'entradas',
        'spacing', 'espaciado', 'output', 'salida',
        'from', 'desde', 'to', 'a', 'hasta',
        'set', 'establecer', 'move', 'mover',
        'add', 'añadir', 'remove', 'quitar',
        'waypoint', 'punto', 'component', 'componente',
        'position', 'posicion', 'pos', 'dir', 'direccion'
    ];
    
    // -------------------- 2. OBTENCIÓN DE SUGERENCIAS --------------------
    function getContextualSuggestions(text) {
        const parts = text.trim().split(/\s+/);
        if (parts.length === 0) return [];
        
        const lastPart = parts[parts.length - 1].toLowerCase();
        const prevPart = parts.length > 1 ? parts[parts.length - 2].toLowerCase() : '';
        
        let suggestions = [];
        
        // Primera palabra: solo comandos principales
        if (parts.length === 1) {
            suggestions = keywords.filter(k => k.startsWith(lastPart));
        }
        // Segunda palabra: depende del comando
        else if (parts.length === 2) {
            const cmd = parts[0].toLowerCase();
            if (cmd === 'create' || cmd === 'crear' || cmd === 'crea') {
                const types = _catalog ? _catalog.listEquipmentTypes() : [];
                suggestions = types.filter(t => t.startsWith(lastPart));
                suggestions.push('line', 'manifold');
            } else if (cmd === 'edit' || cmd === 'editar') {
                suggestions = ['equipment', 'equipo', 'line', 'línea'].filter(s => s.startsWith(lastPart));
            } else if (cmd === 'delete' || cmd === 'eliminar' || cmd === 'borrar') {
                suggestions = ['equipment', 'equipo', 'line', 'línea'].filter(s => s.startsWith(lastPart));
            } else if (cmd === 'connect' || cmd === 'conectar' || cmd === 'route' || cmd === 'ruta') {
                const db = _core ? _core.getDb() : null;
                const equipos = db?.equipos || [];
                const lines = db?.lines || [];
                const tags = [...equipos.map(e => e.tag), ...lines.map(l => l.tag)];
                suggestions = tags.filter(t => t.toLowerCase().startsWith(lastPart));
            } else if (cmd === 'list' || cmd === 'listar') {
                suggestions = ['components', 'componentes', 'equipment', 'equipos', 'specs', 'especificaciones'].filter(s => s.startsWith(lastPart));
            }
        }
        // Tercera palabra en adelante: parámetros o tags
        else {
            const cmd = parts[0].toLowerCase();
            
            // Tags de equipos/líneas para edit/delete
            if (cmd === 'edit' || cmd === 'editar' || cmd === 'delete' || cmd === 'eliminar') {
                const type = parts[1].toLowerCase();
                if (type === 'equipment' || type === 'equipo' || type === 'line' || type === 'línea') {
                    const db = _core ? _core.getDb() : null;
                    let tags = [];
                    if (type === 'equipment' || type === 'equipo') {
                        tags = db?.equipos?.map(e => e.tag) || [];
                    } else {
                        tags = db?.lines?.map(l => l.tag) || [];
                    }
                    suggestions = tags.filter(t => t.toLowerCase().startsWith(lastPart));
                }
            } else if (cmd === 'connect' || cmd === 'conectar' || cmd === 'route' || cmd === 'ruta') {
                // Puertos de equipos/líneas
                const db = _core ? _core.getDb() : null;
                const objTag = parts[1];
                const obj = db?.equipos?.find(e => e.tag === objTag) || db?.lines?.find(l => l.tag === objTag);
                if (obj && obj.puertos) {
                    suggestions = obj.puertos.map(p => p.id).filter(id => id.toLowerCase().startsWith(lastPart));
                }
            }
            
            // Parámetros genéricos
            if (suggestions.length === 0) {
                suggestions = parameters.filter(p => p.startsWith(lastPart));
            }
        }
        
        return suggestions.slice(0, 10);
    }
    
    // -------------------- 3. INTERFAZ VISUAL --------------------
    function createSuggestionBox() {
        const box = document.createElement('div');
        box.id = 'autocomplete-box';
        box.style.cssText = `
            position: absolute;
            background: #1e1e2e;
            border: 1px solid #7c3aed;
            border-radius: 8px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 10000;
            display: none;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(box);
        return box;
    }
    
    function showSuggestions(suggestions) {
        if (!_suggestionBox) _suggestionBox = createSuggestionBox();
        _currentSuggestions = suggestions;
        _selectedIndex = -1;
        if (suggestions.length === 0) {
            _suggestionBox.style.display = 'none';
            return;
        }
        let html = '';
        suggestions.forEach((s, idx) => {
            html += `<div class="autocomplete-item" data-index="${idx}" style="padding:8px 12px;cursor:pointer;color:#e0e6ed;border-bottom:1px solid #2a2a4a;">${s}</div>`;
        });
        _suggestionBox.innerHTML = html;
        
        const rect = _textarea.getBoundingClientRect();
        _suggestionBox.style.left = rect.left + 'px';
        _suggestionBox.style.top = (rect.bottom + 5) + 'px';
        _suggestionBox.style.width = rect.width + 'px';
        _suggestionBox.style.display = 'block';
        
        _suggestionBox.querySelectorAll('.autocomplete-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.index);
                acceptSuggestion(_currentSuggestions[idx]);
            });
            el.addEventListener('mouseenter', () => {
                _selectedIndex = parseInt(el.dataset.index);
                updateSelection();
            });
        });
    }
    
    function updateSelection() {
        const items = _suggestionBox?.querySelectorAll('.autocomplete-item');
        if (!items) return;
        items.forEach((el, idx) => {
            if (idx === _selectedIndex) {
                el.style.backgroundColor = '#7c3aed';
                el.style.color = 'white';
            } else {
                el.style.backgroundColor = 'transparent';
                el.style.color = '#e0e6ed';
            }
        });
    }
    
    function acceptSuggestion(suggestion) {
        if (!_textarea) return;
        const text = _textarea.value;
        const lastSpace = text.lastIndexOf(' ');
        const newText = text.substring(0, lastSpace + 1) + suggestion + ' ';
        _textarea.value = newText;
        _textarea.focus();
        hideSuggestions();
    }
    
    function hideSuggestions() {
        if (_suggestionBox) _suggestionBox.style.display = 'none';
        _currentSuggestions = [];
        _selectedIndex = -1;
    }
    
    // -------------------- 4. MANEJO DE EVENTOS --------------------
    function onInput(e) {
        const suggestions = getContextualSuggestions(_textarea.value);
        showSuggestions(suggestions);
    }
    
    function onKeyDown(e) {
        if (_currentSuggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            _selectedIndex = Math.min(_selectedIndex + 1, _currentSuggestions.length - 1);
            updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            _selectedIndex = Math.max(_selectedIndex - 1, 0);
            updateSelection();
        } else if (e.key === 'Tab' || e.key === 'Enter') {
            if (_selectedIndex >= 0) {
                e.preventDefault();
                acceptSuggestion(_currentSuggestions[_selectedIndex]);
            } else if (e.key === 'Tab' && _currentSuggestions.length === 1) {
                e.preventDefault();
                acceptSuggestion(_currentSuggestions[0]);
            }
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    }
    
    function onBlur() {
        setTimeout(hideSuggestions, 200);
    }
    
    // -------------------- 5. INICIALIZACIÓN --------------------
    function init(textareaElement, coreInstance, catalogInstance, commandsInstance) {
        _textarea = textareaElement;
        _core = coreInstance;
        _catalog = catalogInstance;
        _commands = commandsInstance;
        
        _textarea.addEventListener('input', onInput);
        _textarea.addEventListener('keydown', onKeyDown);
        _textarea.addEventListener('blur', onBlur);
        _textarea.setAttribute('aria-autocomplete', 'list');
        _textarea.setAttribute('aria-expanded', 'false');
    }
    
    return { init, hideSuggestions };
})();
