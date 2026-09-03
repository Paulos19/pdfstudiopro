/* ==========================================================================
   LGPD Scanner & Automated Sensitive Data Redactor - PDF Studio Pro
   ========================================================================== */

class LgpdScanner {
    constructor() {
        this.scanResult = null;
        this.currentDocId = null;
        this.currentDocName = 'contract_modelo.pdf';
        this.selectedFilter = 'all';
        this.redactionStyle = 'black_bar';
        this.scale = 1.05;
        this.pdfDoc = null;
        this.extractedText = '';

        this.initElements();
        this.initEvents();
        this.loadInitialSample();
    }

    initElements() {
        // Metric Counters
        this.metricTotal = document.getElementById('lgpdMetricTotal');
        this.metricHigh = document.getElementById('lgpdMetricHigh');
        this.metricMed = document.getElementById('lgpdMetricMed');
        this.metricCategories = document.getElementById('lgpdMetricCategories');

        // Buttons
        this.btnStartScan = document.getElementById('btnStartLgpdScan');
        this.btnUpload = document.getElementById('btnLgpdUpload');
        this.fileInput = document.getElementById('lgpdFileInput');
        this.btnApplyRedaction = document.getElementById('btnApplyLgpdRedaction');
        this.btnComplianceReport = document.getElementById('btnLgpdComplianceReport');
        this.btnDownloadRedacted = document.getElementById('btnDownloadRedactedPdf');
        this.btnSelectAll = document.getElementById('btnLgpdSelectAll');

        // Style Selector
        this.selectRedactionMode = document.getElementById('selectLgpdMode');

        // Table and Canvas Containers
        this.tableBody = document.getElementById('lgpdEntitiesTableBody');
        this.previewCanvasContainer = document.getElementById('lgpdPdfCanvasContainer');
        this.docNameLabel = document.getElementById('lgpdCurrentDocName');
    }

    initEvents() {
        // Start Scan
        if (this.btnStartScan) {
            this.btnStartScan.addEventListener('click', () => this.runScan());
        }

        // Upload PDF
        if (this.btnUpload && this.fileInput) {
            this.btnUpload.addEventListener('click', () => {
                this.fileInput.value = '';
                this.fileInput.click();
            });
            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.uploadAndScanFile(e.target.files[0]);
                }
            });
        }

        // Apply Redaction
        if (this.btnApplyRedaction) {
            this.btnApplyRedaction.addEventListener('click', () => this.applyRedactions());
        }

        // Generate Compliance Report
        if (this.btnComplianceReport) {
            this.btnComplianceReport.addEventListener('click', () => this.generateComplianceReport());
        }

        // Download Redacted PDF
        if (this.btnDownloadRedacted) {
            this.btnDownloadRedacted.addEventListener('click', () => {
                if (this.currentDocId) {
                    window.location.href = `/api/document/${this.currentDocId}/download`;
                } else {
                    window.App.showToast('Nenhum documento redigido disponível para download.', 'error');
                }
            });
        }

        // Select All Toggle
        if (this.btnSelectAll) {
            this.btnSelectAll.addEventListener('click', () => {
                if (!this.scanResult?.entities) return;
                const allSelected = this.scanResult.entities.every(e => e.selected);
                this.scanResult.entities.forEach(e => e.selected = !allSelected);
                this.renderEntitiesTable();
            });
        }

        // Category Filter Pills
        document.querySelectorAll('.lgpd-filter-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.lgpd-filter-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.selectedFilter = pill.dataset.filter;
                this.renderEntitiesTable();
            });
        });

        // Mode Selector
        if (this.selectRedactionMode) {
            this.selectRedactionMode.addEventListener('change', (e) => {
                this.redactionStyle = e.target.value;
            });
        }
    }

    async loadInitialSample() {
        try {
            const resp = await fetch('/api/templates/contract/load', { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                this.currentDocId = data.docId;
                this.currentDocName = data.docInfo.originalName || 'contract_modelo.pdf';
                if (this.docNameLabel) this.docNameLabel.textContent = this.currentDocName;
                await this.renderPdfPreview(`/api/document/${data.docId}/file`);
            }
        } catch (e) {
            console.warn('Could not load initial contract for LGPD audit:', e);
        }
    }

    async extractCurrentPdfText() {
        if (!this.pdfDoc) return '';
        let fullText = '';
        try {
            for (let p = 1; p <= this.pdfDoc.numPages; p++) {
                const page = await this.pdfDoc.getPage(p);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
        } catch (e) {
            console.warn('Client-side text extraction warning:', e);
        }
        this.extractedText = fullText;
        return fullText;
    }

    async uploadAndScanFile(file) {
        window.App.showToast(`Carregando ${file.name} para auditoria LGPD...`, 'info');
        const formData = new FormData();
        formData.append('file', file);

        try {
            const resp = await fetch('/api/lgpd/scan', {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();
            if (data.success) {
                this.currentDocId = data.docId;
                this.currentDocName = file.name;
                if (this.docNameLabel) this.docNameLabel.textContent = this.currentDocName;
                if (data.fileUrl) await this.renderPdfPreview(data.fileUrl);
                await this.runScan();
            }
        } catch (err) {
            window.App.showToast(`Erro no upload: ${err.message}`, 'error');
        }
    }

    async runScan() {
        window.App.showToast('Extraindo conteúdo e iniciando auditoria LGPD com Gemini...', 'info');

        // Extract real text from the currently loaded PDF
        const realText = await this.extractCurrentPdfText();

        try {
            const resp = await fetch('/api/lgpd/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docId: this.currentDocId,
                    rawText: realText
                })
            });

            const data = await resp.json();
            if (data.success && data.scanResult) {
                this.scanResult = data.scanResult;
                this.updateMetrics(this.scanResult);
                this.renderEntitiesTable();
                window.App.showToast(`Auditoria concluída! ${this.scanResult.totalFound} vulnerabilidades LGPD identificadas.`, 'success');
            } else {
                window.App.showToast(data.error || 'Erro na varredura.', 'error');
            }
        } catch (e) {
            window.App.showToast(`Erro na conexão: ${e.message}`, 'error');
        }
    }

    updateMetrics(result) {
        if (this.metricTotal) this.metricTotal.textContent = result.totalFound || 0;
        if (this.metricHigh) this.metricHigh.textContent = result.highSeverityCount || 0;
        if (this.metricMed) this.metricMed.textContent = result.medSeverityCount || 0;

        const distinctCats = new Set((result.entities || []).map(e => e.category)).size;
        if (this.metricCategories) this.metricCategories.textContent = distinctCats;
    }

    renderEntitiesTable() {
        if (!this.tableBody) return;
        this.tableBody.innerHTML = '';

        if (!this.scanResult?.entities || this.scanResult.entities.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px;">
                        Nenhuma vulnerabilidade ou dado sensível pendente. Clique em "Iniciar Varredura com IA".
                    </td>
                </tr>
            `;
            return;
        }

        const filtered = this.scanResult.entities.filter(ent => {
            if (this.selectedFilter === 'all') return true;
            return ent.category === this.selectedFilter;
        });

        if (filtered.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 18px; color: var(--text-muted); font-size: 12px;">
                        Nenhuma ocorrência encontrada para o filtro selecionado.
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach(ent => {
            const tr = document.createElement('tr');
            tr.className = ent.selected ? 'selected-row' : '';

            const sevClass = ent.severity === 'ALTA' ? 'severity-high' : (ent.severity === 'MÉDIA' ? 'severity-med' : 'severity-low');

            tr.innerHTML = `
                <td style="width: 36px; text-align: center;">
                    <input type="checkbox" class="ent-checkbox" ${ent.selected ? 'checked' : ''}>
                </td>
                <td style="width: 130px;">
                    <span class="lgpd-category-badge">${this.escapeHtml(ent.category || 'Dado Pessoal')}</span>
                    <small style="display: block; color: var(--text-muted); font-size: 10px; margin-top: 2px;">${this.escapeHtml(ent.type || '')}</small>
                </td>
                <td style="max-width: 140px; word-break: break-all;">
                    <code class="raw-sensitive-text">${this.escapeHtml(ent.text)}</code>
                </td>
                <td style="font-size: 11px; color: #FCA5A5; line-height: 1.35; max-width: 180px;">
                    <strong><i class="fa-solid fa-triangle-exclamation"></i> Risco:</strong> ${this.escapeHtml(ent.vulnerability || 'Exposição não autorizada de dado confidencial.')}
                </td>
                <td style="font-size: 11px; line-height: 1.35; max-width: 200px;">
                    <div style="color: var(--text-secondary); margin-bottom: 4px;">
                        <i class="fa-solid fa-lightbulb" style="color: var(--accent-yellow);"></i> ${this.escapeHtml(ent.recommendation || 'Anonimizar dado')}
                    </div>
                    <span class="masked-preview-tag">${this.escapeHtml(ent.suggestedFix || ent.masked || '***')}</span>
                </td>
                <td style="width: 70px; text-align: center;">
                    <span class="severity-badge ${sevClass}">${this.escapeHtml(ent.severity || 'MÉDIA')}</span>
                </td>
            `;

            tr.querySelector('.ent-checkbox').addEventListener('change', (e) => {
                ent.selected = e.target.checked;
                tr.className = ent.selected ? 'selected-row' : '';
            });

            this.tableBody.appendChild(tr);
        });
    }

    async applyRedactions() {
        if (!this.scanResult?.entities) {
            window.App.showToast('Execute a varredura antes de aplicar a redação.', 'error');
            return;
        }

        const toRedact = this.scanResult.entities.filter(e => e.selected);
        if (toRedact.length === 0) {
            window.App.showToast('Selecione ao menos um item para aplicar a correção/redação.', 'error');
            return;
        }

        window.App.showToast(`Gerando documento corrigido e expurgando ${toRedact.length} dados críticos...`, 'info');

        try {
            const resp = await fetch('/api/lgpd/apply-redactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docId: this.currentDocId,
                    entities: toRedact,
                    mode: this.redactionStyle
                })
            });

            const data = await resp.json();
            if (data.success) {
                this.currentDocId = data.docId;
                await this.renderPdfPreview(data.fileUrl);
                window.App.showToast('Documento corrigido e gerado com sucesso, preservando 100% da formatação original!', 'success');
            } else {
                window.App.showToast(data.error || 'Erro na redação.', 'error');
            }
        } catch (e) {
            window.App.showToast(`Erro na aplicação de redação: ${e.message}`, 'error');
        }
    }

    async generateComplianceReport() {
        if (!this.scanResult) {
            window.App.showToast('Execute a varredura antes de gerar o relatório.', 'error');
            return;
        }

        window.App.showToast('Gerando Relatório de Auditoria e Conformidade DPO...', 'info');

        try {
            const resp = await fetch('/api/lgpd/compliance-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scanResult: this.scanResult,
                    docName: this.currentDocName
                })
            });

            const data = await resp.json();
            if (data.success) {
                window.location.href = data.downloadUrl;
                window.App.showToast('Relatório de Conformidade LGPD baixado com sucesso!', 'success');
            }
        } catch (e) {
            window.App.showToast(`Erro ao gerar relatório: ${e.message}`, 'error');
        }
    }

    async renderPdfPreview(pdfUrl) {
        if (!this.previewCanvasContainer) return;
        this.previewCanvasContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; margin-top: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Renderizando documento...</div>';

        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            this.pdfDoc = await loadingTask.promise;
            this.previewCanvasContainer.innerHTML = '';

            const wrapper = document.getElementById('lgpdPdfPreviewWrapper');
            const wrapperWidth = wrapper ? wrapper.clientWidth - 48 : 520;
            const samplePage = await this.pdfDoc.getPage(1);
            const unscaledViewport = samplePage.getViewport({ scale: 1.0 });
            const fitScale = Math.min(Math.max(wrapperWidth / unscaledViewport.width, 0.65), 1.15);
            this.scale = fitScale;

            for (let p = 1; p <= this.pdfDoc.numPages; p++) {
                const page = await this.pdfDoc.getPage(p);
                const viewport = page.getViewport({ scale: this.scale });

                const card = document.createElement('div');
                card.className = 'lgpd-pdf-preview-card';
                card.style.marginBottom = '18px';

                const canvas = document.createElement('canvas');
                const outputScale = window.devicePixelRatio || 1;
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;

                const ctx = canvas.getContext('2d');
                const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

                card.appendChild(canvas);
                this.previewCanvasContainer.appendChild(card);

                await page.render({
                    canvasContext: ctx,
                    transform: transform,
                    viewport: viewport
                }).promise;
            }
        } catch (e) {
            console.error('LGPD PDF preview error:', e);
            this.previewCanvasContainer.innerHTML = `<div style="color: var(--accent-red); font-size: 12px;">Falha na renderização: ${e.message}</div>`;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.LgpdScanner = new LgpdScanner();
});
