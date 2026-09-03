/* ==========================================================================
   Signature Studio Module - Digital Signatures, Cursive Names and Approval Stamps
   ========================================================================== */

class SignatureStudio {
    constructor() {
        this.modal = document.getElementById('signatureModal');
        this.canvas = document.getElementById('sigCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.hasDrawn = false;
        this.activeTab = 'draw';
        this.penColor = '#1E3A8A';
        this.isPlacingSignature = false;
        this.pendingSignatureData = null;

        this.initEvents();
        this.setupCanvas();
    }

    initEvents() {
        // Modal close buttons
        const btnClose = document.getElementById('btnCloseSigModal');
        if (btnClose) btnClose.addEventListener('click', () => this.closeModal());
        const btnCancel = document.getElementById('btnCancelSigModal');
        if (btnCancel) btnCancel.addEventListener('click', () => this.closeModal());

        // Clear canvas
        const btnClear = document.getElementById('btnClearSig');
        if (btnClear) btnClear.addEventListener('click', () => this.clearCanvas());

        // Direct apply (Footer)
        const btnApply = document.getElementById('btnApplySignature');
        if (btnApply) btnApply.addEventListener('click', () => this.applyAtFooter());

        // Place on document via click
        const btnPlace = document.getElementById('btnPlaceSignatureOnDoc');
        if (btnPlace) btnPlace.addEventListener('click', () => this.startMousePlacement());

        // Tab Switching
        document.querySelectorAll('.sig-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sig-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.sig-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                this.activeTab = btn.dataset.tab;
                const targetContent = document.getElementById(`tabSig${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`);
                if (targetContent) targetContent.classList.add('active');
            });
        });

        // Typing input live preview
        const sigTextInput = document.getElementById('sigTextInput');
        const sigTypePreview = document.getElementById('sigTypePreview');
        if (sigTextInput && sigTypePreview) {
            sigTextInput.addEventListener('input', (e) => {
                sigTypePreview.textContent = e.target.value.trim() || 'Gabriel Medeiros';
            });
        }

        // Stamp card selection click
        document.querySelectorAll('.stamp-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.stamp-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const radio = card.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
            });
        });

        // Pen color selection buttons
        document.querySelectorAll('.btn-color-pick').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-color-pick').forEach(b => {
                    b.classList.remove('active');
                    b.style.border = '1px solid rgba(255,255,255,0.2)';
                });
                btn.classList.add('active');
                btn.style.border = '2px solid white';
                this.penColor = btn.dataset.color || '#1E3A8A';
                this.ctx.strokeStyle = this.penColor;
            });
        });
    }

    setupCanvas() {
        const c = this.canvas;
        const ctx = this.ctx;
        ctx.strokeStyle = this.penColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const getPos = (e) => {
            const rect = c.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (c.width / rect.width),
                y: (clientY - rect.top) * (c.height / rect.height)
            };
        };

        const startDraw = (e) => {
            e.preventDefault();
            this.isDrawing = true;
            this.hasDrawn = true;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const moveDraw = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            const pos = getPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        };

        const stopDraw = () => {
            this.isDrawing = false;
        };

        // Mouse events
        c.addEventListener('mousedown', startDraw);
        c.addEventListener('mousemove', moveDraw);
        window.addEventListener('mouseup', stopDraw);

        // Touch events for touchscreens/tablets
        c.addEventListener('touchstart', startDraw, { passive: false });
        c.addEventListener('touchmove', moveDraw, { passive: false });
        c.addEventListener('touchend', stopDraw);
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasDrawn = false;
    }

    openModal() {
        this.modal.style.display = 'flex';
        this.isPlacingSignature = false;
        this.pendingSignatureData = null;
        if (!this.hasDrawn) this.clearCanvas();
    }

    closeModal() {
        this.modal.style.display = 'none';
        if (!this.isPlacingSignature && window.App.currentTool === 'signature') {
            window.App.setTool('select');
        }
    }

    /**
     * Extracts signature image or text/stamp data based on active tab
     */
    getSignatureData() {
        if (this.activeTab === 'draw') {
            // Drawn signature on canvas
            const dataUrl = this.canvas.toDataURL('image/png');
            return {
                type: 'signature',
                imageBase64: dataUrl,
                text: 'Assinatura Manuscrita',
                width: 220,
                height: 65
            };
        } else if (this.activeTab === 'type') {
            // Render cursive typed name onto an offscreen canvas for crisp embedding
            const name = (document.getElementById('sigTextInput')?.value || 'Gabriel Medeiros').trim();
            const offCanvas = document.createElement('canvas');
            offCanvas.width = 460;
            offCanvas.height = 120;
            const offCtx = offCanvas.getContext('2d');
            
            // Clean transparent background with high quality font rendering
            offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
            offCtx.fillStyle = '#1E3A8A';
            offCtx.font = '54px "Caveat", "Dancing Script", cursive, sans-serif';
            offCtx.textAlign = 'center';
            offCtx.textBaseline = 'middle';
            offCtx.fillText(name, offCanvas.width / 2, offCanvas.height / 2);

            const dataUrl = offCanvas.toDataURL('image/png');
            return {
                type: 'signature',
                imageBase64: dataUrl,
                text: name,
                width: 180,
                height: 46
            };
        } else if (this.activeTab === 'stamp') {
            const stampRadio = document.querySelector('input[name="stampType"]:checked');
            const stamp = stampRadio ? stampRadio.value : 'APPROVED';
            let label = 'APROVADO';
            if (stamp === 'CONFIDENTIAL') label = 'CONFIDENCIAL';
            if (stamp === 'AUTHENTICATED') label = 'CÓPIA AUTENTICADA';

            return {
                type: 'stamp',
                stampType: stamp,
                text: label,
                width: 210,
                height: 55
            };
        }
    }

    /**
     * Apply signature directly at the footer of the currently active page
     */
    async applyAtFooter() {
        if (!window.App.currentDocId) {
            window.App.showToast('Nenhum documento aberto.', 'error');
            return;
        }

        const sigData = this.getSignatureData();
        const pageIdx = (window.PdfViewer && window.PdfViewer.currentPageIndex !== undefined) 
                        ? window.PdfViewer.currentPageIndex 
                        : 0;

        await this.sendSignaturePayload({
            ...sigData,
            pageIndex: pageIdx,
            x: 60,
            y: 720
        });

        this.closeModal();
    }

    /**
     * Initiates mouse placement mode: user clicks on the document to drop the signature/stamp
     */
    startMousePlacement() {
        if (!window.App.currentDocId) {
            window.App.showToast('Nenhum documento aberto.', 'error');
            return;
        }

        this.pendingSignatureData = this.getSignatureData();
        this.isPlacingSignature = true;
        this.closeModal();

        // Switch tool visually
        window.App.setTool('signature-place');
        window.App.showToast('Clique no ponto do PDF onde deseja fixar a assinatura/selo.', 'info');
    }

    /**
     * Called by pdf_viewer when user clicks on any page in placement mode
     */
    async handlePageClick(pageIndex, clickX, clickY) {
        if (!this.isPlacingSignature || !this.pendingSignatureData) return;

        const w = this.pendingSignatureData.width || 220;
        const h = this.pendingSignatureData.height || 60;
        const targetX = Math.max(15, clickX - (w / 2));
        const targetY = Math.max(15, clickY - (h / 2));

        window.App.showToast('Gravando assinatura na posição selecionada...', 'info');

        await this.sendSignaturePayload({
            ...this.pendingSignatureData,
            pageIndex: pageIndex !== undefined ? pageIndex : 0,
            x: Math.round(targetX),
            y: Math.round(targetY)
        });

        this.isPlacingSignature = false;
        this.pendingSignatureData = null;
        window.App.setTool('select');
    }

    async sendSignaturePayload(payload) {
        try {
            window.App.showToast('Gravando assinatura oficial no PDF...', 'info');

            const resp = await fetch(`/api/document/${window.App.currentDocId}/annotate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await resp.json();
            if (result.success) {
                window.App.showToast('Assinatura / Selo gravado com sucesso no PDF!', 'success');
                await window.App.reloadCurrentDocument();
            } else {
                window.App.showToast(result.error || 'Erro ao gravar assinatura.', 'error');
            }
        } catch (err) {
            window.App.showToast(`Erro na requisição: ${err.message}`, 'error');
        }
    }
}

window.SignatureStudio = new SignatureStudio();
