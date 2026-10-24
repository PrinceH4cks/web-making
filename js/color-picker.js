/* ==========================================================================
   Master Web IDE Ultra - Inline Color Picker & Swatches Engine
   ========================================================================== */

const ColorPickerEngine = (function () {
    let colorInput = null;
    let activeRange = null;
    let scanTimeout = null;

    // Matches #fff, #ffffff, #ffffff88, rgb(...), rgba(...)
    const HEX_REGEX = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

    function init() {
        createHiddenColorInput();

        // Listen for editor changes to refresh swatches
        if (typeof EditorController !== 'undefined') {
            const cm = EditorController.getCM();
            if (cm) {
                cm.on('change', debounceScan);
                cm.on('viewportChange', debounceScan);
                setTimeout(scanDocument, 300);
            }
        }
    }

    function createHiddenColorInput() {
        if (colorInput) return;
        colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = '__ide_color_picker_input';
        colorInput.style.cssText = 'position:fixed; opacity:0; pointer-events:none; width:1px; height:1px; z-index:-1;';
        document.body.appendChild(colorInput);

        colorInput.addEventListener('input', (e) => {
            if (!activeRange) return;
            const cm = EditorController.getCM();
            if (!cm) return;

            const newColor = e.target.value;
            cm.replaceRange(newColor, activeRange.from, activeRange.to);
            activeRange.to = {
                line: activeRange.from.line,
                ch: activeRange.from.ch + newColor.length
            };
        });
    }

    function debounceScan() {
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(scanDocument, 350);
    }

    function scanDocument() {
        const cm = EditorController.getCM();
        if (!cm) return;

        // Clean up previous swatch markers
        if (cm._colorMarkers && Array.isArray(cm._colorMarkers)) {
            cm._colorMarkers.forEach(m => m.clear());
        }
        cm._colorMarkers = [];

        const doc = cm.getDoc();
        const lineCount = Math.min(doc.lineCount(), 1500); // scan first 1500 lines for speed

        for (let i = 0; i < lineCount; i++) {
            const lineText = doc.getLine(i);
            if (!lineText) continue;

            let match;
            HEX_REGEX.lastIndex = 0;
            while ((match = HEX_REGEX.exec(lineText)) !== null) {
                const hex = match[0];
                const from = { line: i, ch: match.index };
                const to = { line: i, ch: match.index + hex.length };

                const swatch = document.createElement('span');
                swatch.className = 'cm-color-swatch';
                swatch.style.backgroundColor = hex;
                swatch.title = `Color: ${hex} (Tap to change)`;

                swatch.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openPicker(hex, from, to);
                });

                const marker = cm.setBookmark(from, {
                    widget: swatch,
                    insertLeft: true
                });

                cm._colorMarkers.push(marker);
            }
        }
    }

    function openPicker(hex, from, to) {
        if (!colorInput) createHiddenColorInput();
        activeRange = { from: { ...from }, to: { ...to } };

        // Normalize 3-char hex to 6-char hex for input[type=color]
        let standardHex = hex;
        if (hex.length === 4) {
            standardHex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
        }

        colorInput.value = standardHex.slice(0, 7);
        colorInput.click();
    }

    return {
        init,
        scan: scanDocument
    };
})();
