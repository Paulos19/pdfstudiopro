/**
 * PAdES / ICP-Brasil A1 Digital Signature Manager
 * PDF Studio Pro
 */

class PadesManager {
    constructor() {
        this.selectedMode = 'demo'; // 'demo' or 'upload'
        this.isSigning = false;
        this.lastSignResult = null;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        // Toolbar Button
        const btnOpen = document.getElementById('btnOpenPadesModal');
        if (btnOpen) {
            btnOpen.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openModal();
            });
        }

        // Close Buttons
        const btnClose = document.getElementById('btnClosePadesModal');
        const btnCancel = document.getElementById('btnCancelPades');
        if (btnClose) btnClose.addEventListener('click', () => this.closeModal());
        if (btnCancel) btnCancel.addEventListener('click', () => this.closeModal());

        // Mode Tabs (Demo ICP-Brasil vs Upload .pfx/.p12)
        const tabDemo = document.getElementById('tabPadesDemo');
        const tabUpload = document.getElementById('tabPadesUpload');
        const paneDemo = document.getElementById('panePadesDemo');
        const paneUpload = document.getElementById('panePadesUpload');

        if (tabDemo && tabUpload) {
            tabDemo.addEventListener('click', () => {
                tabDemo.classList.add('active');
                tabUpload.classList.remove('active');
                if (paneDemo) paneDemo.style.display = 'block';
                if (paneUpload) paneUpload.style.display = 'none';
                this.selectedMode = 'demo';
            });

            tabUpload.addEventListener('click', () => {
                tabUpload.classList.add('active');
                tabDemo.classList.remove('active');
                if (paneDemo) paneDemo.style.display = 'none';
                if (paneUpload) paneUpload.style.display = 'block';
                this.selectedMode = 'upload';
            });
        }

        // Generate Demo Cert Button
        const btnGenDemo = document.getElementById('btnGenDemoCert');
        if (btnGenDemo) {
            btnGenDemo.addEventListener('click', () => this.generateDemoCert());
        }

        // Submit Sign Button
        const btnSign = document.getElementById('btnExecutePadesSign');
        if (btnSign) {
            btnSign.addEventListener('click', () => this.executeSigning());
        }

        // Download signed button in result view
        const btnDownload = document.getElementById('btnDownloadPadesSigned');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => this.downloadSigned());
        }
    }

    getApp() {
        return window.App || window.app || {};
    }

    openModal() {
        const app = this.getApp();
        const modal = document.getElementById('padesSignModal');
        if (!modal) return;

        if (!app.currentDocId) {
            app.showToast?.('Nenhum documento aberto para assinatura digital.', 'warning');
            return;
        }

        const formView = document.getElementById('padesFormView');
        const loadingView = document.getElementById('padesLoadingView');
        const resultView = document.getElementById('padesResultView');

        if (formView) formView.style.display = 'block';
        if (loadingView) loadingView.style.display = 'none';
        if (resultView) resultView.style.display = 'none';

        // Set default page
        const pageInput = document.getElementById('padesPageNum');
        if (pageInput) {
            pageInput.value = window.pdfViewer?.currentPage || 1;
            pageInput.max = window.pdfViewer?.pdfDoc?.numPages || 1;
        }

        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    closeModal() {
        const modal = document.getElementById('padesSignModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }

    async generateDemoCert() {
        const app = this.getApp();
        const nameInput = document.getElementById('padesSignerName');
        const emailInput = document.getElementById('padesSignerEmail');
        const infoBadge = document.getElementById('padesCertInfoBadge');

        const signerName = (nameInput?.value?.trim()) || 'DRA. CAMILA ROCHA:98765432100';
        const email = (emailInput?.value?.trim()) || 'camila.rocha@adv.oab.br';

        try {
            const resp = await fetch('/api/generate-demo-cert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signerName, email })
            });

            const data = await resp.json();
            if (data.success && infoBadge) {
                infoBadge.style.display = 'block';
                infoBadge.innerHTML = `
                    <div style="font-size: 0.8rem; line-height: 1.4;">
                        <strong style="color: #10b981;"><i class="fa-solid fa-circle-check"></i> Certificado ICP-Brasil A1 Emitido:</strong><br>
                        <strong>Titular:</strong> ${data.subject}<br>
                        <strong>Emissor:</strong> ${data.issuer}<br>
                        <strong>Serial:</strong> <code>${data.serialNumber}</code><br>
                        <strong>Validade:</strong> ${new Date(data.validFrom).toLocaleDateString('pt-BR')} até ${new Date(data.validTo).toLocaleDateString('pt-BR')}
                    </div>
                `;
                if (app.showToast) {
                    app.showToast('Certificado Digital A1 gerado com sucesso!', 'success');
                }
            }
        } catch (err) {
            console.error('Demo cert generation failed:', err);
        }
    }

    async executeSigning() {
        const app = this.getApp();
        if (this.isSigning || !app.currentDocId) return;

        const formView = document.getElementById('padesFormView');
        const loadingView = document.getElementById('padesLoadingView');
        const resultView = document.getElementById('padesResultView');

        if (formView) formView.style.display = 'none';
        if (loadingView) loadingView.style.display = 'flex';
        if (resultView) resultView.style.display = 'none';

        this.isSigning = true;

        try {
            const formData = new FormData();
            
            const reason = document.getElementById('padesReason')?.value || 'Assinatura Digital com Validade Jurídica (ICP-Brasil)';
            const location = document.getElementById('padesLocation')?.value || 'São Paulo - SP, Brasil';
            const pageNum = parseInt(document.getElementById('padesPageNum')?.value, 10) || 1;
            const visualStamp = document.getElementById('padesVisualStamp')?.checked !== false;

            formData.append('reason', reason);
            formData.append('location', location);
            formData.append('pageIndex', String(pageNum - 1));
            formData.append('visualStamp', String(visualStamp));
            formData.append('replaceCurrent', 'true');

            if (this.selectedMode === 'upload') {
                const certFileInput = document.getElementById('padesCertFile');
                const passwordInput = document.getElementById('padesCertPassword');

                if (certFileInput?.files?.length > 0) {
                    formData.append('certificate', certFileInput.files[0]);
                } else {
                    throw new Error('Por favor selecione um arquivo de certificado .pfx ou .p12');
                }
                if (passwordInput?.value) {
                    formData.append('password', passwordInput.value);
                }
            } else {
                const signerName = document.getElementById('padesSignerName')?.value || 'JOÃO DA SILVA:12345678900';
                const email = document.getElementById('padesSignerEmail')?.value || 'assinante@icp-brasil.gov.br';
                formData.append('signerName', signerName);
                formData.append('email', email);
            }

            const resp = await fetch(`/api/document/${app.currentDocId}/sign-digital`, {
                method: 'POST',
                body: formData
            });

            const data = await resp.json();
            if (!data.success) {
                throw new Error(data.error || 'Falha ao assinar digitalmente o PDF');
            }

            this.lastSignResult = data;
            this.renderResults(data);

            if (app.showToast) {
                app.showToast('Documento assinado com envelope criptográfico PAdES / ICP-Brasil A1!', 'success');
            }

            // Reload viewer with signed document
            if (window.pdfViewer && typeof window.pdfViewer.loadDocument === 'function') {
                await window.pdfViewer.loadDocument(`/api/document/${app.currentDocId}/file?t=${Date.now()}`);
            }

        } catch (err) {
            console.error('PAdES signing failed:', err);
            if (app.showToast) {
                app.showToast(`Erro na assinatura: ${err.message}`, 'error');
            }
            if (formView) formView.style.display = 'block';
        } finally {
            this.isSigning = false;
            if (loadingView) loadingView.style.display = 'none';
        }
    }

    renderResults(data) {
        const resultView = document.getElementById('padesResultView');
        if (!resultView) return;

        resultView.style.display = 'block';

        const elSigner = document.getElementById('resPadesSigner');
        const elIssuer = document.getElementById('resPadesIssuer');
        const elSerial = document.getElementById('resPadesSerial');
        const elHash = document.getElementById('resPadesHash');
        const elValidTo = document.getElementById('resPadesValidTo');

        if (elSigner) elSigner.textContent = data.subject || 'Signatário';
        if (elIssuer) elIssuer.textContent = data.issuer || 'ICP-Brasil';
        if (elSerial) elSerial.textContent = data.serialNumber || 'N/A';
        if (elHash) elHash.textContent = (data.digestSha256 || '').substring(0, 32) + '...';
        if (elValidTo && data.validTo) elValidTo.textContent = new Date(data.validTo).toLocaleDateString('pt-BR');
    }

    downloadSigned() {
        const app = this.getApp();
        if (!app.currentDocId) return;
        const link = document.createElement('a');
        link.href = `/api/document/${app.currentDocId}/file?t=${Date.now()}`;
        link.download = `assinado_pades_${app.currentDocName || 'documento.pdf'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

window.padesManager = new PadesManager();
