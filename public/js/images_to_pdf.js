/* ==========================================================================
   Images to PDF Studio Module - PDF Studio Pro
   ========================================================================== */

class ImagesToPdfStudio {
    constructor() {
        this.images = [];
        this.currentDocId = null;
        this.pdfDoc = null;

        this.initElements();
        this.initEvents();
    }

    initElements() {
        this.dropzone = document.getElementById('imgToPdfDropzone');
        this.fileInput = document.getElementById('imgToPdfFileInput');
        this.btnSelectFiles = document.getElementById('btnImgSelectFiles');
        this.imagesGrid = document.getElementById('imagesToPdfGrid');
        this.imagesEmptyState = document.getElementById('imagesEmptyState');
        this.imagesCountBadge = document.getElementById('imagesCountBadge');

        // Form controls
        this.selectPageSize = document.getElementById('imgOptPageSize');
        this.selectMargin = document.getElementById('imgOptMargin');
        this.inputDocName = document.getElementById('imgOptDocName');

        // Action Buttons
        this.btnCompile = document.getElementById('btnCompileImagesToPdf');
        this.btnClear = document.getElementById('btnClearImagesList');
        this.btnOpenInStudio = document.getElementById('btnOpenImagesInStudio');
        this.btnDownload = document.getElementById('btnDownloadImagesPdf');

        // Result Container
        this.resultCard = document.getElementById('imgToPdfResultCard');
        this.previewCanvas = document.getElementById('imgToPdfPreviewCanvas');
        this.resultDetails = document.getElementById('imgToPdfResultDetails');
    }

    initEvents() {
        // File selection
        if (this.btnSelectFiles && this.fileInput) {
            this.btnSelectFiles.addEventListener('click', () => {
                this.fileInput.value = '';
                this.fileInput.click();
            });

            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFiles(Array.from(e.target.files));
                }
            });
        }

        // Drag and drop on dropzone
        if (this.dropzone) {
            ['dragenter', 'dragover'].forEach(name => {
                this.dropzone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropzone.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(name => {
                this.dropzone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.dropzone.classList.remove('dragover');
                });
            });

            this.dropzone.addEventListener('drop', (e) => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
                    if (validFiles.length > 0) {
                        this.handleFiles(validFiles);
                    } else {
                        window.App.showToast('Por favor, arraste apenas arquivos de imagem (PNG, JPG, WebP).', 'error');
                    }
                }
            });
        }

        // Clear button
        if (this.btnClear) {
            this.btnClear.addEventListener('click', () => {
                this.images = [];
                this.renderGrid();
                if (this.resultCard) this.resultCard.style.display = 'none';
                const btnHDown = document.getElementById('btnHeaderDownloadImagesPdf');
                const btnHOpen = document.getElementById('btnHeaderOpenImagesStudio');
                if (btnHDown) btnHDown.style.display = 'none';
                if (btnHOpen) btnHOpen.style.display = 'none';
                window.App.showToast('Lista de imagens limpa.', 'info');
            });
        }

        // Compile button
        if (this.btnCompile) {
            this.btnCompile.addEventListener('click', () => this.compileToPdf());
        }

        // Download button (Card)
        if (this.btnDownload) {
            this.btnDownload.addEventListener('click', () => {
                if (this.currentDocId) {
                    window.location.href = `/api/document/${this.currentDocId}/download`;
                }
            });
        }

        // Open in Studio button (Card)
        if (this.btnOpenInStudio) {
            this.btnOpenInStudio.addEventListener('click', () => this.openCurrentInStudio());
        }

        // Success Modal Elements
        this.successModal = document.getElementById('imgToPdfSuccessModal');
        this.modalDownloadBtn = document.getElementById('btnModalDownloadPdf');
        this.modalOpenInEditorBtn = document.getElementById('btnModalOpenInEditor');
        this.modalCloseBtn = document.getElementById('btnCloseImgSuccessModal');
        this.modalDetails = document.getElementById('imgSuccessModalDetails');
        this.modalCanvas = document.getElementById('imgSuccessModalCanvas');

        // Header Action Buttons (Always visible at top of screen)
        const btnHDown = document.getElementById('btnHeaderDownloadImagesPdf');
        if (btnHDown) {
            btnHDown.addEventListener('click', () => {
                if (this.currentDocId) {
                    window.location.href = `/api/document/${this.currentDocId}/download`;
                }
            });
        }

        const btnHOpen = document.getElementById('btnHeaderOpenImagesStudio');
        if (btnHOpen) {
            btnHOpen.addEventListener('click', () => this.openCurrentInStudio());
        }

        // Success Modal Events
        if (this.modalCloseBtn) {
            this.modalCloseBtn.addEventListener('click', () => {
                if (this.successModal) this.successModal.style.display = 'none';
            });
        }

        if (this.modalDownloadBtn) {
            this.modalDownloadBtn.addEventListener('click', () => {
                if (this.currentDocId) {
                    window.location.href = `/api/document/${this.currentDocId}/download`;
                }
            });
        }

        if (this.modalOpenInEditorBtn) {
            this.modalOpenInEditorBtn.addEventListener('click', () => {
                if (this.successModal) this.successModal.style.display = 'none';
                this.openCurrentInStudio();
            });
        }
    }

    openCurrentInStudio() {
        if (this.currentDocId) {
            window.App.currentDocId = this.currentDocId;
            window.App.currentDocName = this.inputDocName ? (this.inputDocName.value.trim() || 'Imagens_Compiladas.pdf') : 'Imagens_Compiladas.pdf';
            const docTitleEl = document.getElementById('currentDocName');
            if (docTitleEl) docTitleEl.textContent = window.App.currentDocName;

            window.App.navigateTo('studio');
            window.App.reloadCurrentDocument();
            window.App.showToast('PDF de imagens aberto no Editor para assinatura e anotações!', 'success');
        }
    }

    async handleFiles(files) {
        window.App.showToast(`Carregando ${files.length} imagem(ns)...`, 'info');

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            const dataUrl = await this.readFileAsDataUrl(file);
            const dims = await this.getImageDimensions(dataUrl);

            this.images.push({
                id: 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                name: file.name,
                size: (file.size / 1024).toFixed(1) + ' KB',
                width: dims.width,
                height: dims.height,
                dataUrl: dataUrl
            });
        }

        this.renderGrid();
        window.App.showToast(`${this.images.length} imagem(ns) na fila de conversão.`, 'success');
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    getImageDimensions(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ width: 800, height: 600 });
            img.src = dataUrl;
        });
    }

    renderGrid() {
        if (!this.imagesGrid) return;
        this.imagesGrid.innerHTML = '';

        if (this.imagesCountBadge) {
            this.imagesCountBadge.textContent = `${this.images.length} Imagem(ns)`;
        }

        if (this.images.length === 0) {
            if (this.imagesEmptyState) this.imagesEmptyState.style.display = 'flex';
            if (this.btnCompile) this.btnCompile.disabled = true;
            return;
        }

        if (this.imagesEmptyState) this.imagesEmptyState.style.display = 'none';
        if (this.btnCompile) this.btnCompile.disabled = false;

        this.images.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'img-grid-card';
            card.innerHTML = `
                <div class="img-card-thumb" style="background-image: url('${item.dataUrl}');">
                    <span class="img-card-order">Pág. ${index + 1}</span>
                </div>
                <div class="img-card-info">
                    <div class="img-card-name" title="${item.name}">${item.name}</div>
                    <div class="img-card-meta">${item.width}x${item.height} px • ${item.size}</div>
                </div>
                <div class="img-card-actions">
                    <button class="mini-btn btn-move-left" title="Mover para antes" ${index === 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <button class="mini-btn btn-move-right" title="Mover para depois" ${index === this.images.length - 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                    <button class="mini-btn btn-remove-img" title="Remover imagem" style="color: var(--accent-red);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            card.querySelector('.btn-move-left')?.addEventListener('click', () => this.moveImage(index, -1));
            card.querySelector('.btn-move-right')?.addEventListener('click', () => this.moveImage(index, 1));
            card.querySelector('.btn-remove-img')?.addEventListener('click', () => this.removeImage(index));

            this.imagesGrid.appendChild(card);
        });
    }

    moveImage(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.images.length) return;
        const temp = this.images[index];
        this.images[index] = this.images[newIndex];
        this.images[newIndex] = temp;
        this.renderGrid();
    }

    removeImage(index) {
        this.images.splice(index, 1);
        this.renderGrid();
    }

    async compileToPdf() {
        if (this.images.length === 0) {
            window.App.showToast('Adicione ao menos uma imagem para converter.', 'error');
            return;
        }

        const pageSize = this.selectPageSize ? this.selectPageSize.value : 'A4';
        const margin = this.selectMargin ? parseInt(this.selectMargin.value) : 20;
        const docName = this.inputDocName ? (this.inputDocName.value.trim() || 'Imagens_Compiladas') : 'Imagens_Compiladas';

        window.App.showToast('Compilando imagens em PDF de alta qualidade...', 'info');
        if (this.btnCompile) {
            this.btnCompile.disabled = true;
            this.btnCompile.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando PDF...';
        }

        try {
            const resp = await fetch('/api/images-to-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    images: this.images.map(img => ({
                        dataUrl: img.dataUrl,
                        name: img.name
                    })),
                    pageSize,
                    margin,
                    docName
                })
            });

            const data = await resp.json();

            if (data.success) {
                this.currentDocId = data.docId;
                window.App.showToast(data.message || 'PDF compilado com sucesso!', 'success');

                // Show prominent buttons in top header
                const btnHDown = document.getElementById('btnHeaderDownloadImagesPdf');
                if (btnHDown) btnHDown.style.display = 'inline-flex';
                const btnHOpen = document.getElementById('btnHeaderOpenImagesStudio');
                if (btnHOpen) btnHOpen.style.display = 'inline-flex';

                if (this.resultCard) {
                    this.resultCard.style.display = 'block';
                    const rightPanel = document.querySelector('.img-right-panel');
                    if (rightPanel) {
                        rightPanel.scrollTop = rightPanel.scrollHeight;
                    }
                }

                const detailsHtml = `
                    <div><strong>Arquivo:</strong> ${data.docInfo.originalName}</div>
                    <div><strong>Total de Páginas:</strong> ${data.totalPages}</div>
                    <div><strong>Configuração:</strong> ${pageSize === 'A4' ? 'Padrão A4' : 'Tamanho da Imagem'} (Margem: ${margin}pt)</div>
                `;

                if (this.resultDetails) this.resultDetails.innerHTML = detailsHtml;
                if (this.modalDetails) this.modalDetails.innerHTML = detailsHtml;

                // Open prominent Success Modal
                if (this.successModal) this.successModal.style.display = 'flex';

                // Automatically trigger direct download
                try {
                    const dlLink = document.createElement('a');
                    dlLink.href = data.downloadUrl;
                    dlLink.download = data.docInfo.originalName;
                    document.body.appendChild(dlLink);
                    dlLink.click();
                    document.body.removeChild(dlLink);
                } catch (e) {
                    console.warn('Auto download triggered fallback', e);
                }

                // Render page 1 preview in both modal and card canvas
                if (window.pdfjsLib) {
                    try {
                        const loadingTask = window.pdfjsLib.getDocument(data.fileUrl);
                        const pdf = await loadingTask.promise;
                        const page = await pdf.getPage(1);
                        
                        // Card canvas
                        if (this.previewCanvas) {
                            const viewport = page.getViewport({ scale: 0.6 });
                            this.previewCanvas.width = viewport.width;
                            this.previewCanvas.height = viewport.height;
                            const ctx = this.previewCanvas.getContext('2d');
                            await page.render({ canvasContext: ctx, viewport }).promise;
                        }

                        // Modal canvas
                        if (this.modalCanvas) {
                            const modalViewport = page.getViewport({ scale: 0.6 });
                            this.modalCanvas.width = modalViewport.width;
                            this.modalCanvas.height = modalViewport.height;
                            const mCtx = this.modalCanvas.getContext('2d');
                            await page.render({ canvasContext: mCtx, viewport: modalViewport }).promise;
                        }
                    } catch (renderErr) {
                        console.warn('Preview render error:', renderErr);
                    }
                }
            } else {
                window.App.showToast(data.error || 'Falha ao compilar imagens para PDF.', 'error');
            }
        } catch (err) {
            window.App.showToast(`Erro na requisição: ${err.message}`, 'error');
        } finally {
            if (this.btnCompile) {
                this.btnCompile.disabled = false;
                this.btnCompile.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Compilar em PDF';
            }
        }
    }
}

window.ImagesToPdfStudio = new ImagesToPdfStudio();
