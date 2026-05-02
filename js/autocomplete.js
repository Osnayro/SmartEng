
// SmartFlowAutocomplete v6.1 - Corregido
const SmartFlowAutocomplete = (function() {
    let _core = null;
    let _catalog = null;
    let _commands = null;
    let _textarea = null;
    let _suggestionBox = null;
    let _currentSuggestions = [];
    let _selectedIndex = -1;

    const keywords = [
        'create', 'crear', 'crea',
        'edit', 'editar',
        'delete', 'eliminar', 'borrar',
        'connect', 'conectar',
        'route', 'ruta',
        'list', 'listar',
        'info', 'informacion',
        'help', 'ayuda',
        'undo', 'deshacer',
        'redo', 'rehacer',
        'nodes', 'nodos',
        '+', '%', '~', '>', '-', '?', '??', '???',
        '.', '.t', '.f', '.s',
        '!', '<<', '>>'
    ];

    const parameters = [
        'diam', 'diametro', 'diameter',
        'altura', 'height',
        'largo', 'length',
        'material',
        'spec', 'especificacion',
        'ancho', 'width',
        'entradas', 'entries',
        'spacing', 'espaciado',
        'salida', 'output'
    ];

    function getContextualSuggestions(text) {
        const parts = text.trim().split(/\s+/);
        if (parts.length === 0) return [];
        const lastPart = (parts[parts.length - 1] || '').toLowerCase();
        let suggestions = [];

        if (parts.length === 1) {
            suggestions = keywords.filter(k => k.startsWith(lastPart));
            return suggestions.slice(0, 10);
        }

        const first = parts[0].toLowerCase();

        // Después de crear, sugerir tipos de equipo
        if ((first === 'create' || first === 'crear' || first === '+' || first === 'crea') && parts.length <= 3) {
            if (parts.length === 2) {
                const types = _catalog ? _catalog.listEquipmentTypes() : [];
                suggestions = types.filter(t => t.toLowerCase().startsWith(lastPart));
                suggestions.push('line', 'linea', 'manifold');
                return suggestions.slice(0, 10);
            }
        }

        // Después de editar/eliminar, sugerir tags existentes
        if ((first === 'edit' || first === 'editar' || first === '~' ||
             first === 'delete' || first === 'eliminar' || first === '-') && parts.length === 2) {
            const db = _core ? _core.getDb() : { equipos: [], lines: [] };
            const allTags = [...db.equipos.map(e => e.tag), ...db.lines.map(l => l.tag)];
            suggestions = allTags.filter(t => t.toLowerCase().startsWith(lastPart));
            return suggestions.slice(0, 10);
        }

        // En comandos de conexión (contienen ->), sugerir tags o puertos
        const arrowIndex = parts.indexOf('->');
        if (arrowIndex > 0) {
            // Si estamos después de la flecha
            if (parts.length > arrowIndex + 1) {
                const rightSide = parts[arrowIndex + 1];
                // Si ya tiene un punto, sugerir puertos
                const dotIdx = rightSide.indexOf('.');
                if (dotIdx > 0) {
                    const tagPart = rightSide.substring(0, dotIdx);
                    const db = _core ? _core.getDb() : { equipos: [], lines: [] };
                    const obj = db.equipos.find(e => e.tag === tagPart) || db.lines.find(l => l.tag === tagPart);
                    if (obj && obj.puertos) {
                        suggestions = obj.puertos.map(p => p.id).filter(id => id.toLowerCase().startsWith(lastPart));
                    }
                } else {
                    // Sugerir tags de equipos/líneas existentes
                    const db = _core ? _core.getDb() : { equipos: [], lines: [] };
                    const allTags = [...db.equipos.map(e => e.tag), ...db.lines.map(l => l.tag)];
                    suggestions = allTags.filter(t => t.toLowerCase().startsWith(lastPart));
                }
                return suggestions.slice(0, 10);
            }
        }

        // Si ninguna regla aplica, sugerir parámetros
        suggestions = parameters.filter(p => p.startsWith(lastPart));
        if (suggestions.length === 0) {
            suggestions = keywords.filter(k => k.startsWith(lastPart));
        }
        return suggestions.slice(0, 10);
    }

    function createSuggestionBox() {
        const box = document.createElement('div');
        box.id = 'autocomplete-box';
        Object.assign(box.style, {
            position: 'absolute',
            background: '#1e1e2e',
            border: '1px solid #7c3aed',
            borderRadius: '8px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: '10000',
            display: 'none',
            fontFamily: 'Courier New, monospace',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        });
        document.body.appendChild(box);
        return box;
    }

    function showSuggestions(suggestions) {
        if (!_suggestionBox) _suggestionBox = createSuggestionBox();
        _currentSuggestions = suggestions;
        _selectedIndex = -1;

        // No mostrar si no hay sugerencias o el textarea no está visible
        if (suggestions.length === 0 || !_textarea || !_textarea.offsetParent) {
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
            el.addEventListener('click', (e) => {
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
            el.style.backgroundColor = idx === _selectedIndex ? '#7c3aed' : 'transparent';
            el.style.color = idx === _selectedIndex ? 'white' : '#e0e6ed';
        });
    }

    function acceptSuggestion(suggestion) {
        if (!_textarea) return;
        const text = _textarea.value;
        const cursorPos = _textarea.selectionStart;
        const textBefore = text.substring(0, cursorPos);
        const lastSpace = textBefore.lastIndexOf(' ');
        const newText = text.substring(0, lastSpace + 1) + suggestion + ' ' + text.substring(cursorPos);
        _textarea.value = newText;
        _textarea.focus();
        const newCursor = (lastSpace + 1) + suggestion.length + 1;
        _textarea.setSelectionRange(newCursor, newCursor);
        hideSuggestions();
    }

    function hideSuggestions() {
        if (_suggestionBox) _suggestionBox.style.display = 'none';
        _currentSuggestions = [];
        _selectedIndex = -1;
    }

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

        console.log("Autocomplete v6.1 corregido listo");
    }

    return { init, hideSuggestions };
})();
