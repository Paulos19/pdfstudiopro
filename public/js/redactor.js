/* ==========================================================================
   Redactor Module - Permanent Redaction of Sensitive Data with C++ Byte Purge
   ========================================================================== */

class Redactor {
    constructor() {
        this.pendingRedactions = [];
        this.redactionBar = document.getElementById('redactionBar');

        this.initEvents();
    }

    initEvents() {
        document.getElementById('btnCancelRedaction').addEventListener('click', () => this.cancelPending());
        document.getElementById('btnApplyRedaction').addEventListener('click', () => this.applyPermanentRedaction());
    }

    markBlockForRedaction(block, pageIndex) {
        this.pendingRedactions.push({
            pageIndex: pageIndex,
            x: block.x - 2,
            y: block.y - 2,
            width: block.width + 4,
            height: block.height + 4,
            overlayText: '[CONFIDENCIAL / REDIGIDO]'
        });

        // Visually mark the element
        const el = document.querySelector(`.text-box-item[data-id="${block.id}"]`);
        if (el) el.classList.add('redaction-mark');

        this.redactionBar.style.display = 'flex';
        window.App.showToast(`Área marcada para censura permanente. Clique em "Aplicar Redação".`, 'info');
    }

    cancelPending() {
        this.pendingRedactions = [];
        this.redactionBar.style.display = 'none';
        document.querySelectorAll('.text-box-item.redaction-mark').forEach(el => el.classList.remove('redaction-mark'));
    }

    async applyPermanentRedaction() {
        if (this.pendingRedactions.length === 0 || !window.App.currentDocId) return;

        window.App.showToast('Aplicando expurgo definitivo de dados via C++...', 'info');

        try {
            for (const red of this.pendingRedactions) {
                const resp = await fetch(`/api/document/${window.App.currentDocId}/redact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(red)
                });
                const result = await resp.json();
                if (!result.success) throw new Error(result.error);
            }

            window.App.showToast('Redação permanente concluída! Dados excluídos do PDF.', 'success');
            this.cancelPending();
            window.App.reloadCurrentDocument();
        } catch (err) {
            window.App.showToast(`Erro na redação: ${err.message}`, 'error');
        }
    }
}

window.Redactor = new Redactor();
