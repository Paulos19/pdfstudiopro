/* ==========================================================================
   Page Manager Module - Multi-Page Thumbnails, Extraction & Deletion
   ========================================================================== */

class PageManager {
    constructor() {
        this.thumbnailsList = document.getElementById('thumbnailsList');
        this.pageCountLabel = document.getElementById('pageCountLabel');
        this.activePageIndex = 0;
        this.selectedPages = new Set(); // Set of 0-based page indices
        this.totalPages = 1;

        // Modal Elements
        this.modal = document.getElementById('pageExtractorModal');
        this.modalGrid = document.getElementById('modalPagesGrid');
        this.modalRangeInput = document.getElementById('inputPageRange');

        this.initEvents();
    }

    initEvents() {
        // Rotate page
        const btnRotate = document.getElementById('btnRotatePageRight');
        if (btnRotate) btnRotate.addEventListener('click', () => this.rotateCurrentPage(90));

        // Quick page actions in sidebar
        const btnSelectAll = document.getElementById('btnSelectAllThumbnails');
        if (btnSelectAll) btnSelectAll.addEventListener('click', () => this.toggleSelectAll());

        const btnDeleteSelected = document.getElementById('btnDeleteSelectedPages');
        if (btnDeleteSelected) btnDeleteSelected.addEventListener('click', () => this.deleteSelectedPages());

        const btnExportSelected = document.getElementById('btnExportSelectedPages');
        if (btnExportSelected) btnExportSelected.addEventListener('click', () => this.exportSelectedPages());

        const btnOpenOrganizer = document.getElementById('btnOpenPageOrganizer');
        if (btnOpenOrganizer) btnOpenOrganizer.addEventListener('click', () => this.openModal());

        // Modal Controls
        const btnCloseModal = document.getElementById('btnClosePageExtractorModal');
        if (btnCloseModal) btnCloseModal.addEventListener('click', () => this.closeModal());
        const btnCancelModal = document.getElementById('btnCancelPageExtractor');
        if (btnCancelModal) btnCancelModal.addEventListener('click', () => this.closeModal());

        const btnModalDelete = document.getElementById('btnModalDeletePages');
        if (btnModalDelete) btnModalDelete.addEventListener('click', () => this.deleteSelectedPages());

        const btnModalExport = document.getElementById('btnModalExportPages');
        if (btnModalExport) btnModalExport.addEventListener('click', () => this.exportSelectedPages());

        const btnModalSelectAll = document.getElementById('btnModalSelectAll');
        if (btnModalSelectAll) btnModalSelectAll.addEventListener('click', () => this.toggleSelectAll());

        // Range input (e.g. 1-3, 5)
        if (this.modalRangeInput) {
            this.modalRangeInput.addEventListener('input', (e) => {
                this.parseRangeString(e.target.value);
            });
        }
    }

    async renderThumbnails(pdfDoc) {
        if (!this.thumbnailsList) return;
        this.thumbnailsList.innerHTML = '';
        this.selectedPages.clear();
        this.totalPages = pdfDoc.numPages;

        if (this.pageCountLabel) {
            this.pageCountLabel.textContent = `${this.totalPages} Página${this.totalPages > 1 ? 's' : ''}`;
        }

        this.updateActionButtonsState();

        for (let i = 1; i <= this.totalPages; i++) {
            const pageIndex = i - 1;
            const card = document.createElement('div');
            card.className = `thumb-card ${pageIndex === 0 ? 'active' : ''}`;
            card.id = `thumbCard_${pageIndex}`;
            card.dataset.pageIndex = pageIndex;

            // Checkbox for selection
            const checkWrapper = document.createElement('div');
            checkWrapper.className = 'thumb-checkbox-wrapper';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'thumb-checkbox';
            checkbox.id = `pageCheck_${pageIndex}`;
            checkbox.title = `Selecionar Página ${i}`;
            checkWrapper.appendChild(checkbox);

            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePageSelection(pageIndex, checkbox.checked);
            });

            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'thumb-canvas-wrapper';
            const canvas = document.createElement('canvas');
            canvasWrapper.appendChild(canvas);

            const label = document.createElement('span');
            label.className = 'thumb-label';
            label.textContent = `Página ${i}`;

            card.appendChild(checkWrapper);
            card.appendChild(canvasWrapper);
            card.appendChild(label);

            card.addEventListener('click', () => {
                document.querySelectorAll('.thumb-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.activePageIndex = pageIndex;
                if (window.PdfViewer) {
                    window.PdfViewer.currentPageIndex = pageIndex;
                    window.PdfViewer.scrollToPage(pageIndex);
                }
            });

            this.thumbnailsList.appendChild(card);

            // Render mini thumbnail
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.22 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
        }
    }

    togglePageSelection(pageIndex, isSelected) {
        if (isSelected) {
            this.selectedPages.add(pageIndex);
        } else {
            this.selectedPages.delete(pageIndex);
        }

        // Sync thumbnail card class
        const card = document.getElementById(`thumbCard_${pageIndex}`);
        if (card) {
            if (isSelected) card.classList.add('selected');
            else card.classList.remove('selected');
        }

        // Sync modal card if open
        const modalCheck = document.getElementById(`modalPageCheck_${pageIndex}`);
        if (modalCheck) modalCheck.checked = isSelected;
        const modalThumb = document.getElementById(`modalPageThumb_${pageIndex}`);
        if (modalThumb) {
            if (isSelected) modalThumb.classList.add('selected');
            else modalThumb.classList.remove('selected');
        }

        this.updateActionButtonsState();
        this.updateRangeInputDisplay();
    }

    toggleSelectAll() {
        const allSelected = this.selectedPages.size === this.totalPages;
        for (let i = 0; i < this.totalPages; i++) {
            this.togglePageSelection(i, !allSelected);
            const check = document.getElementById(`pageCheck_${i}`);
            if (check) check.checked = !allSelected;
        }
    }

    parseRangeString(str) {
        if (!str.trim()) return;
        const parts = str.split(',').map(s => s.trim()).filter(Boolean);
        const newSelection = new Set();

        parts.forEach(part => {
            if (part.includes('-')) {
                const [startStr, endStr] = part.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                if (!isNaN(start) && !isNaN(end)) {
                    for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
                        if (p >= 1 && p <= this.totalPages) newSelection.add(p - 1);
                    }
                }
            } else {
                const p = parseInt(part, 10);
                if (!isNaN(p) && p >= 1 && p <= this.totalPages) newSelection.add(p - 1);
            }
        });

        for (let i = 0; i < this.totalPages; i++) {
            const isSel = newSelection.has(i);
            this.togglePageSelection(i, isSel);
            const check = document.getElementById(`pageCheck_${i}`);
            if (check) check.checked = isSel;
        }
    }

    updateRangeInputDisplay() {
        if (!this.modalRangeInput) return;
        if (this.selectedPages.size === 0) {
            this.modalRangeInput.placeholder = 'Ex: 1-3, 5, 8';
            return;
        }
        const sorted = Array.from(this.selectedPages).map(i => i + 1).sort((a, b) => a - b);
        this.modalRangeInput.value = sorted.join(', ');
    }

    updateActionButtonsState() {
        const count = this.selectedPages.size;
        const btnDelete = document.getElementById('btnDeleteSelectedPages');
        const btnExport = document.getElementById('btnExportSelectedPages');
        const countBadge = document.getElementById('selectedPagesCountBadge');

        if (btnDelete) btnDelete.disabled = count === 0;
        if (btnExport) btnExport.disabled = count === 0;
        if (countBadge) countBadge.textContent = `${count} selecionada(s)`;

        const modalDelete = document.getElementById('btnModalDeletePages');
        const modalExport = document.getElementById('btnModalExportPages');
        if (modalDelete) modalDelete.disabled = count === 0;
        if (modalExport) modalExport.disabled = count === 0;
    }

    async deleteSelectedPages() {
        if (!window.App.currentDocId || this.selectedPages.size === 0) return;

        if (this.selectedPages.size === this.totalPages) {
            window.App.showToast('Não é possível excluir todas as páginas do documento.', 'error');
            return;
        }

        const count = this.selectedPages.size;
        const confirmMsg = `Deseja realmente remover ${count} página(s) selecionada(s)? Esta ação criará um novo PDF com as páginas restantes.`;
        if (!confirm(confirmMsg)) return;

        window.App.showToast(`Removendo ${count} página(s)...`, 'info');

        try {
            const resp = await fetch(`/api/document/${window.App.currentDocId}/extract-pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pages: Array.from(this.selectedPages),
                    mode: 'delete'
                })
            });

            const data = await resp.json();
            if (data.success) {
                window.App.currentDocId = data.docId;
                window.App.currentDocName = data.docInfo.originalName;
                const docTitleEl = document.getElementById('currentDocName');
                if (docTitleEl) docTitleEl.textContent = window.App.currentDocName;

                this.closeModal();
                await window.App.reloadCurrentDocument();
                window.App.showToast(data.message || 'Páginas removidas com sucesso!', 'success');
            } else {
                window.App.showToast(data.error || 'Erro ao remover páginas.', 'error');
            }
        } catch (err) {
            window.App.showToast(`Erro na requisição: ${err.message}`, 'error');
        }
    }

    async exportSelectedPages() {
        if (!window.App.currentDocId || this.selectedPages.size === 0) return;

        const count = this.selectedPages.size;
        window.App.showToast(`Extraindo ${count} página(s) selecionada(s)...`, 'info');

        try {
            const resp = await fetch(`/api/document/${window.App.currentDocId}/extract-pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pages: Array.from(this.selectedPages),
                    mode: 'keep'
                })
            });

            const data = await resp.json();
            if (data.success) {
                window.App.showToast(data.message || 'Páginas extraídas com sucesso!', 'success');

                // Offer immediate download
                const downloadImmediately = confirm(`PDF com as ${count} página(s) exportadas gerado com sucesso!\n\nDeseja baixar o novo arquivo agora?`);
                if (downloadImmediately) {
                    window.location.href = data.downloadUrl;
                }

                // Or open in editor
                const openInStudio = confirm(`Deseja abrir o PDF extraído no editor agora?`);
                if (openInStudio) {
                    window.App.currentDocId = data.docId;
                    window.App.currentDocName = data.docInfo.originalName;
                    const docTitleEl = document.getElementById('currentDocName');
                    if (docTitleEl) docTitleEl.textContent = window.App.currentDocName;
                    this.closeModal();
                    await window.App.reloadCurrentDocument();
                }
            } else {
                window.App.showToast(data.error || 'Erro ao exportar páginas.', 'error');
            }
        } catch (err) {
            window.App.showToast(`Erro na requisição: ${err.message}`, 'error');
        }
    }

    async openModal() {
        if (!this.modal) return;
        this.modal.style.display = 'flex';
        this.renderModalGrid();
    }

    closeModal() {
        if (this.modal) this.modal.style.display = 'none';
    }

    async renderModalGrid() {
        if (!this.modalGrid || !window.PdfViewer?.pdfDoc) return;
        this.modalGrid.innerHTML = '';
        const pdfDoc = window.PdfViewer.pdfDoc;

        for (let i = 1; i <= this.totalPages; i++) {
            const pageIndex = i - 1;
            const isSel = this.selectedPages.has(pageIndex);

            const card = document.createElement('div');
            card.className = `modal-page-thumb ${isSel ? 'selected' : ''}`;
            card.id = `modalPageThumb_${pageIndex}`;

            card.innerHTML = `
                <div class="thumb-header">
                    <label class="modal-thumb-check-label">
                        <input type="checkbox" id="modalPageCheck_${pageIndex}" ${isSel ? 'checked' : ''}>
                        <span>Pág. ${i}</span>
                    </label>
                </div>
                <div class="modal-thumb-canvas-box">
                    <canvas id="modalCanvas_${pageIndex}"></canvas>
                </div>
            `;

            const check = card.querySelector(`#modalPageCheck_${pageIndex}`);
            check?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePageSelection(pageIndex, check.checked);
            });

            card.addEventListener('click', () => {
                const newCheck = !this.selectedPages.has(pageIndex);
                if (check) check.checked = newCheck;
                this.togglePageSelection(pageIndex, newCheck);
            });

            this.modalGrid.appendChild(card);

            // Render thumbnail
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = card.querySelector(`#modalCanvas_${pageIndex}`);
            if (canvas) {
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;
            }
        }

        this.updateActionButtonsState();
        this.updateRangeInputDisplay();
    }

    async rotateCurrentPage(angle) {
        if (!window.App.currentDocId) return;

        window.App.showToast(`Rotacionando página ${this.activePageIndex + 1} em ${angle}°...`, 'info');

        try {
            const resp = await fetch(`/api/document/${window.App.currentDocId}/rotate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageIndex: this.activePageIndex,
                    angle: angle
                })
            });

            const result = await resp.json();
            if (result.success) {
                window.App.showToast('Página rotacionada com sucesso!', 'success');
                window.App.reloadCurrentDocument();
            } else {
                window.App.showToast(result.error || 'Erro ao rotacionar página.', 'error');
            }
        } catch (err) {
            window.App.showToast(`Erro de conexão: ${err.message}`, 'error');
        }
    }
}

window.PageManager = new PageManager();
