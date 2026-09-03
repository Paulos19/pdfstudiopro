/* ==========================================================================
   Contract Risk Auditor Module - PDF Studio Pro
   ========================================================================== */

class ContractAuditor {
    constructor() {
        this.auditResult = null;
        this.currentDocId = null;
        this.currentDocName = 'contract_modelo.pdf';
        this.selectedFilter = 'all';
        this.scale = 1.05;
        this.pdfDoc = null;

        this.initElements();
        this.initEvents();
        this.loadInitialSample();
    }

    initElements() {
        this.scoreVal = document.getElementById('auditScoreVal');
        this.riskBadge = document.getElementById('auditRiskLevelBadge');
        this.metricTotal = document.getElementById('auditTotalClauses');
        this.metricCritical = document.getElementById('auditCriticalClauses');
        this.metricWarning = document.getElementById('auditWarningClauses');
        this.metricSafe = document.getElementById('auditSafeClauses');

        this.summaryText = document.getElementById('auditExecutiveSummaryText');
        this.alertsList = document.getElementById('auditTopAlertsList');
        this.clausesContainer = document.getElementById('auditClausesList');
        this.docNameLabel = document.getElementById('auditCurrentDocName');

        this.btnStartAudit = document.getElementById('btnStartContractAudit');
        this.btnExportOpinion = document.getElementById('btnExportLegalOpinion');
        this.previewCanvasContainer = document.getElementById('auditPdfCanvasContainer');
    }

    initEvents() {
        if (this.btnStartAudit) {
            this.btnStartAudit.addEventListener('click', () => this.runAudit());
        }

        if (this.btnExportOpinion) {
            this.btnExportOpinion.addEventListener('click', () => this.exportOpinion());
        }

        // Filter Pills
        document.querySelectorAll('.audit-filter-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.audit-filter-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.selectedFilter = pill.dataset.filter;
                this.renderClauses();
            });
        });
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
            console.warn('Could not load initial contract for audit:', e);
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
            console.warn('Text extraction warning:', e);
        }
        return fullText;
    }

    async runAudit() {
        window.App.showToast('Iniciando auditoria jurídica preventiva com Gemini...', 'info');
        const realText = await this.extractCurrentPdfText();

        try {
            const resp = await fetch('/api/audit/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docId: this.currentDocId,
                    pdfText: realText
                })
            });

            const data = await resp.json();
            if (data.success && data.auditResult) {
                this.auditResult = data.auditResult;
                this.renderAuditResults(this.auditResult);
                window.App.showToast('Auditoria contratual concluída!', 'success');
            } else {
                window.App.showToast(data.error || 'Erro na auditoria.', 'error');
            }
        } catch (e) {
            window.App.showToast(`Erro na requisição: ${e.message}`, 'error');
        }
    }

    renderAuditResults(res) {
        // Score & Badge
        if (this.scoreVal) {
            this.scoreVal.textContent = res.riskScore || 50;
            const score = res.riskScore || 50;
            if (score > 60) this.scoreVal.style.color = 'var(--accent-red)';
            else if (score > 35) this.scoreVal.style.color = 'var(--accent-yellow)';
            else this.scoreVal.style.color = 'var(--accent-green)';
        }

        if (this.riskBadge) {
            this.riskBadge.textContent = res.riskLevel || 'ANÁLISE CONCLUÍDA';
            const score = res.riskScore || 50;
            if (score > 60) this.riskBadge.className = 'audit-risk-badge badge-high';
            else if (score > 35) this.riskBadge.className = 'audit-risk-badge badge-med';
            else this.riskBadge.className = 'audit-risk-badge badge-low';
        }

        // Metrics
        if (this.metricTotal) this.metricTotal.textContent = res.metrics?.totalClauses || (res.clauses || []).length;
        if (this.metricCritical) this.metricCritical.textContent = res.metrics?.criticalClauses || 0;
        if (this.metricWarning) this.metricWarning.textContent = res.metrics?.warningClauses || 0;
        if (this.metricSafe) this.metricSafe.textContent = res.metrics?.safeClauses || 0;

        // Executive Summary
        if (this.summaryText) {
            this.summaryText.textContent = res.executiveSummary || 'Parecer de auditoria preventiva elaborado.';
        }

        // Top Alerts
        if (this.alertsList) {
            this.alertsList.innerHTML = '';
            (res.topAlerts || []).forEach(alert => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red);"></i> <span>${this.escapeHtml(alert)}</span>`;
                this.alertsList.appendChild(li);
            });
        }

        this.renderClauses();
    }

    renderClauses() {
        if (!this.clausesContainer) return;
        this.clausesContainer.innerHTML = '';

        if (!this.auditResult?.clauses || this.auditResult.clauses.length === 0) {
            this.clausesContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 16px 0;">Nenhuma cláusula avaliada ou auditoria pendente.</div>';
            return;
        }

        const filtered = this.auditResult.clauses.filter(c => {
            if (this.selectedFilter === 'all') return true;
            return c.status === this.selectedFilter;
        });

        if (filtered.length === 0) {
            this.clausesContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; padding: 16px 0;">Nenhuma cláusula encontrada para este filtro.</div>';
            return;
        }

        filtered.forEach(clause => {
            const card = document.createElement('div');
            card.className = 'audit-clause-card';

            const statusClass = clause.status === 'CRÍTICA' ? 'status-critical' : (clause.status === 'ATENÇÃO' ? 'status-warning' : 'status-safe');

            card.innerHTML = `
                <div class="audit-clause-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="clause-status-tag ${statusClass}">${clause.status || 'ATENÇÃO'}</span>
                        <strong style="font-size: 12.5px; color: var(--text-primary);">${this.escapeHtml(clause.clauseNumber || '')} - ${this.escapeHtml(clause.title || '')}</strong>
                    </div>
                    <span class="audit-category-tag">${this.escapeHtml(clause.category || 'Contrato')}</span>
                </div>
                <div class="audit-clause-body">
                    <div class="audit-block original-snippet">
                        <label><i class="fa-solid fa-quote-left"></i> Trecho Original no Contrato:</label>
                        <p>${this.escapeHtml(clause.originalSnippet || '')}</p>
                    </div>
                    <div class="audit-block risk-analysis">
                        <label><i class="fa-solid fa-scale-balanced" style="color: var(--accent-red);"></i> Parecer de Risco:</label>
                        <p>${this.escapeHtml(clause.riskAnalysis || '')}</p>
                    </div>
                    <div class="audit-block recommended-revision">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label><i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent-green);"></i> Sugestão de Redação Equilibrada:</label>
                            <button type="button" class="mini-btn btn-copy-revision" title="Copiar sugestão de redação">
                                <i class="fa-solid fa-copy"></i> Copiar
                            </button>
                        </div>
                        <p>${this.escapeHtml(clause.recommendedRevision || '')}</p>
                    </div>
                </div>
            `;

            card.querySelector('.btn-copy-revision').addEventListener('click', () => {
                if (clause.recommendedRevision) {
                    navigator.clipboard.writeText(clause.recommendedRevision);
                    window.App.showToast('Sugestão de redação copiada para a área de transferência!', 'success');
                }
            });

            this.clausesContainer.appendChild(card);
        });
    }

    async exportOpinion() {
        if (!this.auditResult) {
            window.App.showToast('Execute a auditoria antes de exportar o parecer.', 'error');
            return;
        }

        window.App.showToast('Gerando Parecer Jurídico em PDF...', 'info');

        try {
            const resp = await fetch('/api/audit/export-opinion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auditResult: this.auditResult,
                    docName: this.currentDocName
                })
            });

            const data = await resp.json();
            if (data.success && data.downloadUrl) {
                window.location.href = data.downloadUrl;
                window.App.showToast('Parecer Jurídico baixado com sucesso!', 'success');
            }
        } catch (e) {
            window.App.showToast(`Erro ao exportar parecer: ${e.message}`, 'error');
        }
    }

    async renderPdfPreview(pdfUrl) {
        if (!this.previewCanvasContainer) return;
        this.previewCanvasContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; margin-top: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Renderizando documento...</div>';

        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            this.pdfDoc = await loadingTask.promise;
            this.previewCanvasContainer.innerHTML = '';

            const wrapper = document.getElementById('auditPdfPreviewWrapper');
            const wrapperWidth = wrapper ? wrapper.clientWidth - 48 : 520;
            const samplePage = await this.pdfDoc.getPage(1);
            const unscaledViewport = samplePage.getViewport({ scale: 1.0 });
            const fitScale = Math.min(Math.max(wrapperWidth / unscaledViewport.width, 0.65), 1.15);
            this.scale = fitScale;

            for (let p = 1; p <= this.pdfDoc.numPages; p++) {
                const page = await this.pdfDoc.getPage(p);
                const viewport = page.getViewport({ scale: this.scale });

                const card = document.createElement('div');
                card.className = 'prompt-pdf-preview-card';
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
            console.error('Audit PDF preview error:', e);
            this.previewCanvasContainer.innerHTML = `<div style="color: var(--accent-red); font-size: 12px;">Falha na renderização: ${e.message}</div>`;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.ContractAuditor = new ContractAuditor();
});
