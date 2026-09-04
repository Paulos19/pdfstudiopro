/**
 * Compressor & Optimizer Manager (C++17 Native Engine)
 * PDF Studio Pro
 */

class CompressorManager {
    constructor() {
        this.selectedProfile = 'balanced';
        this.isCompressing = false;
        this.lastResult = null;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        // Toolbar Button
        const btnOpen = document.getElementById('btnOpenCompressModal');
        if (btnOpen) {
            btnOpen.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openModal();
            });
        }

        // Close Buttons
        const btnClose = document.getElementById('btnCloseCompressModal');
        const btnCancel = document.getElementById('btnCancelCompress');
        if (btnClose) btnClose.addEventListener('click', () => this.closeModal());
        if (btnCancel) btnCancel.addEventListener('click', () => this.closeModal());

        // Profile Cards
        const cards = document.querySelectorAll('.compress-profile-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                cards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedProfile = card.dataset.profile || 'balanced';
            });
        });

        // Run Button
        const btnRun = document.getElementById('btnRunCompress');
        if (btnRun) {
            btnRun.addEventListener('click', () => this.executeCompression());
        }

        // Apply / Download Buttons in Result View
        const btnDownload = document.getElementById('btnDownloadCompressed');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => this.downloadOptimized());
        }
    }

    getApp() {
        return window.App || window.app || {};
    }

    openModal() {
        const app = this.getApp();
        const modal = document.getElementById('compressModal');
        if (!modal) return;

        if (!app.currentDocId) {
            app.showToast?.('Nenhum documento aberto para otimização.', 'warning');
            return;
        }

        // Reset views
        const setupView = document.getElementById('compressSetupView');
        const resultView = document.getElementById('compressResultView');
        const loadingView = document.getElementById('compressLoadingView');

        if (setupView) setupView.style.display = 'block';
        if (resultView) resultView.style.display = 'none';
        if (loadingView) loadingView.style.display = 'none';

        // Populate doc stats
        const docNameEl = document.getElementById('compressDocName');
        const docSizeEl = document.getElementById('compressDocSize');
        const docPagesEl = document.getElementById('compressDocPages');

        if (docNameEl) docNameEl.textContent = app.currentDocName || 'documento.pdf';
        if (docSizeEl) docSizeEl.textContent = 'Calculando...';

        const totalPgs = window.pdfViewer?.pdfDoc?.numPages || 1;
        if (docPagesEl) docPagesEl.textContent = `${totalPgs} pág${totalPgs > 1 ? 's' : ''}`;

        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    closeModal() {
        const modal = document.getElementById('compressModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }

    async executeCompression() {
        const app = this.getApp();
        if (this.isCompressing || !app.currentDocId) return;

        const setupView = document.getElementById('compressSetupView');
        const loadingView = document.getElementById('compressLoadingView');
        const resultView = document.getElementById('compressResultView');

        if (setupView) setupView.style.display = 'none';
        if (loadingView) loadingView.style.display = 'flex';
        if (resultView) resultView.style.display = 'none';

        this.isCompressing = true;

        try {
            const resp = await fetch(`/api/document/${app.currentDocId}/compress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profile: this.selectedProfile,
                    replaceCurrent: true
                })
            });

            const data = await resp.json();
            if (!data.success) {
                throw new Error(data.error || 'Falha na otimização do PDF');
            }

            this.lastResult = data;
            this.renderResults(data);

            if (app.showToast) {
                app.showToast(data.message, 'success');
            }

            // Reload viewer with compressed document
            if (window.pdfViewer && typeof window.pdfViewer.loadDocument === 'function') {
                await window.pdfViewer.loadDocument(`/api/document/${app.currentDocId}/file?t=${Date.now()}`);
            }

        } catch (err) {
            console.error('Compress execution failed:', err);
            if (app.showToast) {
                app.showToast(`Erro na compressão: ${err.message}`, 'error');
            }
            if (setupView) setupView.style.display = 'block';
        } finally {
            this.isCompressing = false;
            if (loadingView) loadingView.style.display = 'none';
        }
    }

    renderResults(data) {
        const resultView = document.getElementById('compressResultView');
        if (!resultView) return;

        resultView.style.display = 'block';

        const origKb = (data.originalSize / 1024).toFixed(1);
        const compKb = (data.compressedSize / 1024).toFixed(1);
        const savedKb = (data.bytesSaved / 1024).toFixed(1);
        const ratio = (data.ratio || 0).toFixed(1);

        const elOrig = document.getElementById('resOriginalSize');
        const elComp = document.getElementById('resCompressedSize');
        const elSaved = document.getElementById('resSavedSize');
        const elRatio = document.getElementById('resRatioPercent');
        const elBar = document.getElementById('resSavingsBar');
        const elObjects = document.getElementById('resRemovedObjects');
        const elStreams = document.getElementById('resRecompressedStreams');

        if (elOrig) elOrig.textContent = `${origKb} KB`;
        if (elComp) elComp.textContent = `${compKb} KB`;
        if (elSaved) elSaved.textContent = `-${savedKb} KB`;
        if (elRatio) elRatio.textContent = `${ratio}%`;
        if (elBar) elBar.style.width = `${Math.min(100, Math.max(5, ratio))}%`;
        if (elObjects) elObjects.textContent = data.removedObjects || 0;
        if (elStreams) elStreams.textContent = data.recompressedStreams || 0;
    }

    downloadOptimized() {
        const app = this.getApp();
        if (!app.currentDocId) return;
        const link = document.createElement('a');
        link.href = `/api/document/${app.currentDocId}/file?t=${Date.now()}`;
        link.download = `otimizado_${app.currentDocName || 'documento.pdf'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

window.compressorManager = new CompressorManager();
