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

        // Visual Light Table / Page Organizer State
        this.modalItems = []; // Array of { id, originalIndex, rotation, isBlank }
        this.thumbnailDataCache = new Map(); // pageIndex -> dataUrl
        this.draggedItemId = null;

        // Modal Elements
        this.modal = document.getElementById('pageExtractorModal');
        this.modalGrid = document.getElementById('modalPagesGrid');
        this.modalRangeInput = document.getElementById('inputPageRange');

        this.initEvents();
    }

    initEvents() {
        // Rotate page in sidebar/viewer
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

        // Modal Header & Footer Controls
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

        // Light Table Action Toolbar Controls
        const btnRotateAll = document.getElementById('btnModalRotateAll');
        if (btnRotateAll) btnRotateAll.addEventListener('click', () => this.rotateAllModalPages(90));

        const btnAddBlank = document.getElementById('btnModalAddBlankPage');
        if (btnAddBlank) btnAddBlank.addEventListener('click', () => this.addBlankPage());

        const btnResetOrder = document.getElementById('btnModalResetOrder');
        if (btnResetOrder) btnResetOrder.addEventListener('click', () => this.resetModalOrder());

        const btnApplyOrder = document.getElementById('btnModalApplyOrder');
        if (btnApplyOrder) btnApplyOrder.addEventListener('click', () => this.applyNewOrder());

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
            this.thumbnailDataCache.set(pageIndex, canvas.toDataURL());
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
        if (!window.PdfViewer?.pdfDoc) {
            window.App?.showToast('Abra um documento primeiro para organizar páginas.', 'warning');
            return;
        }
        this.initModalItems();
        this.modal.style.display = 'flex';
        await this.renderModalGrid();
    }

    closeModal() {
        if (this.modal) this.modal.style.display = 'none';
    }

    initModalItems() {
        this.modalItems = [];
        for (let i = 0; i < this.totalPages; i++) {
            this.modalItems.push({
                id: `item_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                originalIndex: i,
                rotation: 0,
                isBlank: false
            });
        }
    }

    async renderModalGrid() {
        if (!this.modalGrid) return;
        this.modalGrid.innerHTML = '';
        const pdfDoc = window.PdfViewer?.pdfDoc;
        if (!pdfDoc) return;

        // Ensure thumbnails are cached for all original pages
        for (let i = 0; i < this.totalPages; i++) {
            if (!this.thumbnailDataCache.has(i)) {
                try {
                    const page = await pdfDoc.getPage(i + 1);
                    const viewport = page.getViewport({ scale: 0.28 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    this.thumbnailDataCache.set(i, canvas.toDataURL());
                } catch (e) {
                    console.warn(`Error caching thumb for page ${i}:`, e);
                }
            }
        }

        this.modalItems.forEach((item, index) => {
            const card = this.createModalCard(item, index);
            this.modalGrid.appendChild(card);
        });

        this.updateActionButtonsState();
        this.updateRangeInputDisplay();
    }

    createModalCard(item, index) {
        const isSel = !item.isBlank && this.selectedPages.has(item.originalIndex);
        const card = document.createElement('div');
        card.className = `modal-page-thumb ${isSel ? 'selected' : ''} ${item.isBlank ? 'is-blank' : ''}`;
        card.id = `modalPageThumb_${item.id}`;
        card.dataset.id = item.id;
        card.dataset.index = index;
        card.draggable = true;

        const titleText = item.isBlank ? 'Em Branco' : `Pág. ${item.originalIndex + 1}`;
        const rotationBadge = item.rotation > 0 ? `<span class="badge-rotation-deg">+${item.rotation}°</span>` : '';

        card.innerHTML = `
            <div class="thumb-header">
                <label class="modal-thumb-check-label" title="${item.isBlank ? 'Página em branco' : 'Selecionar ' + titleText}">
                    ${!item.isBlank ? `<input type="checkbox" class="modal-page-checkbox" data-orig-index="${item.originalIndex}" ${isSel ? 'checked' : ''}>` : '<i class="fa-regular fa-file" style="color: var(--text-muted);"></i>'}
                    <span>${titleText}</span>
                </label>
                <div class="modal-thumb-badges">
                    <span class="badge-order-num">#${index + 1}</span>
                    ${rotationBadge}
                </div>
            </div>
            <div class="modal-thumb-canvas-box">
                ${item.isBlank 
                    ? `<div class="blank-page-placeholder" style="transform: rotate(${item.rotation}deg);">
                         <i class="fa-regular fa-file"></i>
                         <span>Página em Branco</span>
                       </div>`
                    : `<img src="${this.thumbnailDataCache.get(item.originalIndex) || ''}" alt="${titleText}" style="transform: rotate(${item.rotation}deg);" />`
                }
            </div>
            <div class="modal-thumb-footer-actions">
                <span class="drag-grip-handle" title="Arraste para reposicionar esta página"><i class="fa-solid fa-grip-vertical"></i></span>
                <div class="thumb-mini-btn-group">
                    <button type="button" class="thumb-mini-btn btn-rotate" title="Girar 90° horário">
                        <i class="fa-solid fa-rotate-right"></i>
                    </button>
                    <button type="button" class="thumb-mini-btn btn-duplicate" title="Duplicar página">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button type="button" class="thumb-mini-btn btn-delete" title="Remover página da ordem">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;

        // Prevent inputs and buttons from initiating drag
        card.querySelectorAll('button, input').forEach(el => {
            el.addEventListener('mousedown', (e) => e.stopPropagation());
        });

        // Checkbox event
        const checkbox = card.querySelector('.modal-page-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.togglePageSelection(item.originalIndex, checkbox.checked);
            });
        }

        // Card click toggles selection if not blank
        card.addEventListener('click', (e) => {
            if (e.target.closest('.thumb-mini-btn') || e.target.closest('.modal-page-checkbox')) return;
            if (!item.isBlank) {
                const newSel = !this.selectedPages.has(item.originalIndex);
                if (checkbox) checkbox.checked = newSel;
                this.togglePageSelection(item.originalIndex, newSel);
            }
        });

        // Card mini-button events
        const btnRotate = card.querySelector('.btn-rotate');
        if (btnRotate) {
            btnRotate.addEventListener('click', (e) => {
                e.stopPropagation();
                this.rotateModalItem(item, card);
            });
        }

        const btnDuplicate = card.querySelector('.btn-duplicate');
        if (btnDuplicate) {
            btnDuplicate.addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateModalItem(item);
            });
        }

        const btnDelete = card.querySelector('.btn-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteModalItem(item);
            });
        }

        // Drag and Drop Events
        card.addEventListener('dragstart', (e) => {
            this.draggedItemId = item.id;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.id);
        });

        card.addEventListener('dragend', () => {
            this.draggedItemId = null;
            this.modalGrid.querySelectorAll('.modal-page-thumb').forEach(c => {
                c.classList.remove('dragging', 'drag-over');
            });
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (this.draggedItemId && this.draggedItemId !== item.id) {
                card.classList.add('drag-over');
            }
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            const srcId = e.dataTransfer.getData('text/plain') || this.draggedItemId;
            if (!srcId || srcId === item.id) return;

            const srcIdx = this.modalItems.findIndex(x => x.id === srcId);
            const targetIdx = this.modalItems.findIndex(x => x.id === item.id);
            if (srcIdx !== -1 && targetIdx !== -1) {
                const [moved] = this.modalItems.splice(srcIdx, 1);
                this.modalItems.splice(targetIdx, 0, moved);
                this.renderModalGrid();
            }
        });

        return card;
    }

    rotateModalItem(item, card) {
        item.rotation = (item.rotation + 90) % 360;
        const mediaEl = card.querySelector('.modal-thumb-canvas-box img, .modal-thumb-canvas-box .blank-page-placeholder');
        if (mediaEl) {
            mediaEl.style.transform = `rotate(${item.rotation}deg)`;
        }
        const badgesContainer = card.querySelector('.modal-thumb-badges');
        let rotBadge = card.querySelector('.badge-rotation-deg');
        if (item.rotation > 0) {
            if (!rotBadge) {
                rotBadge = document.createElement('span');
                rotBadge.className = 'badge-rotation-deg';
                badgesContainer?.appendChild(rotBadge);
            }
            rotBadge.textContent = `+${item.rotation}°`;
        } else if (rotBadge) {
            rotBadge.remove();
        }
    }

    duplicateModalItem(item) {
        const curIdx = this.modalItems.findIndex(x => x.id === item.id);
        if (curIdx === -1) return;
        const clone = {
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            originalIndex: item.originalIndex,
            rotation: item.rotation,
            isBlank: item.isBlank
        };
        this.modalItems.splice(curIdx + 1, 0, clone);
        this.renderModalGrid();
        window.App?.showToast('Página duplicada com sucesso na mesa de luz.', 'info');
    }

    deleteModalItem(item) {
        if (this.modalItems.length <= 1) {
            window.App?.showToast('O documento precisa ter pelo menos 1 página.', 'warning');
            return;
        }
        const curIdx = this.modalItems.findIndex(x => x.id === item.id);
        if (curIdx === -1) return;
        this.modalItems.splice(curIdx, 1);
        this.renderModalGrid();
    }

    rotateAllModalPages(angle = 90) {
        if (!this.modalItems || this.modalItems.length === 0) return;
        this.modalItems.forEach(it => {
            it.rotation = (it.rotation + angle) % 360;
        });
        this.renderModalGrid();
        window.App?.showToast(`Todas as páginas giradas em +${angle}°.`, 'info');
    }

    addBlankPage() {
        if (!this.modalItems) this.modalItems = [];
        const blank = {
            id: `blank_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            originalIndex: -1,
            rotation: 0,
            isBlank: true
        };
        this.modalItems.push(blank);
        this.renderModalGrid();
        window.App?.showToast('Página em branco adicionada.', 'info');
        if (this.modalGrid) {
            setTimeout(() => { this.modalGrid.scrollTop = this.modalGrid.scrollHeight; }, 50);
        }
    }

    resetModalOrder() {
        this.initModalItems();
        this.renderModalGrid();
        window.App?.showToast('Ordem e orientações originais restauradas.', 'info');
    }

    async applyNewOrder() {
        if (!window.App?.currentDocId || !this.modalItems || this.modalItems.length === 0) {
            window.App?.showToast('Nenhuma alteração para aplicar.', 'warning');
            return;
        }

        const btn = document.getElementById('btnModalApplyOrder');
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...';
        }

        try {
            window.App?.showToast('Reorganizando páginas e aplicando orientações...', 'info');

            const payloadItems = this.modalItems.map(it => ({
                originalIndex: it.isBlank ? -1 : it.originalIndex,
                pageIndex: it.isBlank ? -1 : it.originalIndex,
                rotation: it.rotation || 0,
                isBlank: Boolean(it.isBlank)
            }));

            const resp = await fetch(`/api/document/${window.App.currentDocId}/reorder-pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: payloadItems })
            });

            const data = await resp.json();
            if (data.success) {
                this.closeModal();
                this.thumbnailDataCache.clear();
                await window.App.reloadCurrentDocument();
                window.App?.showToast(data.message || 'Nova ordem de páginas aplicada com sucesso!', 'success');
            } else {
                window.App?.showToast(data.error || 'Erro ao aplicar nova ordem.', 'error');
            }
        } catch (err) {
            window.App?.showToast(`Erro na requisição: ${err.message}`, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
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
