/**
 * AcroForm & AI Auto-Fill Copilot Manager
 * PDF Studio Pro
 */

class AcroFormManager {
    constructor() {
        this.fields = [];
        this.selectedPersona = 'candidate';
        this.isLoading = false;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        // Toolbar Button
        const btnOpen = document.getElementById('btnOpenAcroFormModal');
        if (btnOpen) {
            btnOpen.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openModal();
            });
        }

        // Close Buttons
        const btnClose = document.getElementById('btnCloseAcroFormModal');
        const btnCancel = document.getElementById('btnCancelAcroForm');
        if (btnClose) btnClose.addEventListener('click', () => this.closeModal());
        if (btnCancel) btnCancel.addEventListener('click', () => this.closeModal());

        // Persona Selection
        const personaBtns = document.querySelectorAll('.persona-pill');
        personaBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                personaBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedPersona = btn.dataset.persona || 'candidate';

                // Preset context hint in textarea if empty
                const ctxInput = document.getElementById('acroFormCustomPrompt');
                if (ctxInput && !ctxInput.value.trim()) {
                    if (this.selectedPersona === 'candidate') {
                        ctxInput.placeholder = 'Ex: Preencha como Engenheiro de Software Sênior, 10 anos de experiência, residindo em São Paulo...';
                    } else if (this.selectedPersona === 'company') {
                        ctxInput.placeholder = 'Ex: Preencha como Nexus Tecnologia Ltda, CNPJ de Curitiba, contratação em regime PJ...';
                    }
                }
            });
        });

        // AI Auto-Fill Button
        const btnAutoFill = document.getElementById('btnAcroFormAutoFill');
        if (btnAutoFill) {
            btnAutoFill.addEventListener('click', () => this.executeAutoFill());
        }

        // Apply Button
        const btnApply = document.getElementById('btnAcroFormApply');
        if (btnApply) {
            btnApply.addEventListener('click', () => this.applyToPdf());
        }

        // Download Button
        const btnDownload = document.getElementById('btnDownloadAcroFormFilled');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => this.downloadFilled());
        }
    }

    getApp() {
        return window.App || window.app || {};
    }

    async openModal() {
        const app = this.getApp();
        const modal = document.getElementById('acroFormModal');
        if (!modal) return;

        if (!app.currentDocId) {
            app.showToast?.('Nenhum documento aberto para preenchimento de formulário.', 'warning');
            return;
        }

        modal.style.display = 'flex';
        modal.classList.add('active');

        // Load fields
        await this.loadFields();
    }

    closeModal() {
        const modal = document.getElementById('acroFormModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }

    async loadFields() {
        const app = this.getApp();
        const container = document.getElementById('acroFormFieldsContainer');
        const badgeCount = document.getElementById('acroFormFieldCountBadge');
        const emptyNotice = document.getElementById('acroFormEmptyNotice');

        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Identificando campos /AcroForm...</div>';
        }

        try {
            const resp = await fetch(`/api/document/${app.currentDocId}/acroforms`);
            const data = await resp.json();

            this.fields = data.fields || [];

            if (badgeCount) {
                badgeCount.textContent = `${this.fields.length} campos detectados`;
            }

            if (!data.hasAcroForm || this.fields.length === 0) {
                if (container) container.innerHTML = '';
                if (emptyNotice) {
                    emptyNotice.style.display = 'block';
                    emptyNotice.innerHTML = `
                        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 14px; text-align: center;">
                            <i class="fa-solid fa-triangle-exclamation" style="color: #EF4444; font-size: 20px; margin-bottom: 6px;"></i>
                            <div style="font-weight: 600; font-size: 13.5px; color: #EF4444;">Nenhum campo interativo de AcroForm neste PDF</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                Dica: Abra o modelo <strong>"Formulário Interativo (AcroForm & IA)"</strong> em Modelos Prontos para testar todos os tipos de campos.
                            </div>
                        </div>
                    `;
                }
                return;
            }

            if (emptyNotice) emptyNotice.style.display = 'none';
            this.renderFields(this.fields);

        } catch (err) {
            console.error('Failed to load AcroForm fields:', err);
            if (container) {
                container.innerHTML = `<div style="color: #EF4444; padding: 10px;">Erro ao ler campos do formulário: ${err.message}</div>`;
            }
        }
    }

    renderFields(fields) {
        const container = document.getElementById('acroFormFieldsContainer');
        if (!container) return;

        container.innerHTML = '';

        fields.forEach(field => {
            const fieldCard = document.createElement('div');
            fieldCard.className = 'acro-field-card';
            fieldCard.dataset.name = field.name;

            let inputHtml = '';

            if (field.type === 'checkbox') {
                const isChecked = field.value === true || field.value === 'true' || field.value === 'checked';
                inputHtml = `
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 4px;">
                        <input type="checkbox" id="field_${field.name}" name="${field.name}" ${isChecked ? 'checked' : ''} class="acro-input-check">
                        <span style="font-size: 12px; color: var(--text-primary);">${field.label}</span>
                    </label>
                `;
            } else if (field.type === 'dropdown' && Array.isArray(field.options) && field.options.length > 0) {
                const optionsHtml = field.options.map(opt => `
                    <option value="${opt}" ${String(field.value) === String(opt) ? 'selected' : ''}>${opt}</option>
                `).join('');

                inputHtml = `
                    <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">
                        ${field.label} <span class="badge" style="font-size: 9.5px; background: rgba(59,130,246,0.15); color: #60A5FA; margin-left: 4px;">Dropdown</span>
                    </label>
                    <select id="field_${field.name}" name="${field.name}" class="form-input acro-input-select" style="width: 100%; padding: 6px 8px;">
                        ${optionsHtml}
                    </select>
                `;
            } else {
                // Text Field
                inputHtml = `
                    <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 4px;">
                        ${field.label} <span class="badge" style="font-size: 9.5px; background: rgba(16,185,129,0.15); color: #10B981; margin-left: 4px;">Texto</span>
                    </label>
                    <input type="text" id="field_${field.name}" name="${field.name}" value="${field.value || ''}" placeholder="Digite ${field.label}..." class="form-input acro-input-text" style="width: 100%; padding: 6px 10px;">
                `;
            }

            fieldCard.innerHTML = inputHtml;
            container.appendChild(fieldCard);
        });
    }

    async executeAutoFill() {
        const app = this.getApp();
        if (this.isLoading || !app.currentDocId || this.fields.length === 0) return;

        const btnAutoFill = document.getElementById('btnAcroFormAutoFill');
        const customPrompt = document.getElementById('acroFormCustomPrompt')?.value || '';
        const aiSummaryBox = document.getElementById('acroFormAiSummary');

        this.isLoading = true;
        if (btnAutoFill) {
            btnAutoFill.disabled = true;
            btnAutoFill.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gemini Flash Preenchendo...';
        }

        try {
            const resp = await fetch(`/api/document/${app.currentDocId}/acroforms/autofill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: this.selectedPersona,
                    userContext: customPrompt
                })
            });

            const data = await resp.json();
            if (!data.success) {
                throw new Error(data.error || 'Erro ao processar preenchimento com IA');
            }

            const filled = data.filledFields || {};

            // Update inputs on screen with glow effect
            for (const [fieldName, val] of Object.entries(filled)) {
                const inputEl = document.getElementById(`field_${fieldName}`);
                if (inputEl) {
                    if (inputEl.type === 'checkbox') {
                        inputEl.checked = (val === true || val === 'true' || val === 'checked' || val === '1');
                    } else if (inputEl.tagName === 'SELECT') {
                        inputEl.value = String(val);
                    } else {
                        inputEl.value = String(val);
                    }

                    // Animate card
                    const card = inputEl.closest('.acro-field-card');
                    if (card) {
                        card.classList.add('ai-filled');
                        setTimeout(() => card.classList.remove('ai-filled'), 1500);
                    }
                }
            }

            // Display AI summary
            if (aiSummaryBox) {
                aiSummaryBox.style.display = 'block';
                aiSummaryBox.innerHTML = `
                    <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="font-size: 12px; color: var(--text-primary);">
                            <i class="fa-solid fa-wand-magic-sparkles" style="color: #10B981; margin-right: 6px;"></i>
                            <strong>IA Concluída:</strong> ${data.summary || 'Campos preenchidos com precisão semântica.'}
                        </div>
                        <span class="badge" style="background: #10B981; color: white; font-size: 10px;">${data.confidence || 98}% Confiança</span>
                    </div>
                `;
            }

            if (app.showToast) {
                app.showToast(`Gemini Flash preencheu ${Object.keys(filled).length} campos com sucesso!`, 'success');
            }

        } catch (err) {
            console.error('AutoFill failed:', err);
            if (app.showToast) {
                app.showToast(`Erro no preenchimento: ${err.message}`, 'error');
            }
        } finally {
            this.isLoading = false;
            if (btnAutoFill) {
                btnAutoFill.disabled = false;
                btnAutoFill.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Preencher Tudo com Gemini Flash';
            }
        }
    }

    async applyToPdf() {
        const app = this.getApp();
        if (!app.currentDocId) return;

        const btnApply = document.getElementById('btnAcroFormApply');
        const flattenCheck = document.getElementById('acroFormFlattenCheck');
        const flatten = flattenCheck ? flattenCheck.checked : false;

        // Gather all values from the rendered form
        const fieldValues = {};
        this.fields.forEach(field => {
            const inputEl = document.getElementById(`field_${field.name}`);
            if (inputEl) {
                if (inputEl.type === 'checkbox') {
                    fieldValues[field.name] = inputEl.checked;
                } else {
                    fieldValues[field.name] = inputEl.value;
                }
            }
        });

        if (btnApply) {
            btnApply.disabled = true;
            btnApply.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gravando no PDF...';
        }

        try {
            const resp = await fetch(`/api/document/${app.currentDocId}/acroforms/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fieldValues,
                    flatten,
                    replaceCurrent: true
                })
            });

            const data = await resp.json();
            if (!data.success) {
                throw new Error(data.error || 'Falha ao salvar formulário');
            }

            if (app.showToast) {
                app.showToast(data.message, 'success');
            }

            // Reload viewer
            if (window.pdfViewer && typeof window.pdfViewer.loadDocument === 'function') {
                await window.pdfViewer.loadDocument(`/api/document/${app.currentDocId}/file?t=${Date.now()}`);
            }

            this.closeModal();

        } catch (err) {
            console.error('Apply AcroForm failed:', err);
            if (app.showToast) {
                app.showToast(`Erro ao gravar: ${err.message}`, 'error');
            }
        } finally {
            if (btnApply) {
                btnApply.disabled = false;
                btnApply.innerHTML = '<i class="fa-solid fa-check"></i> Salvar &amp; Aplicar ao PDF';
            }
        }
    }

    downloadFilled() {
        const app = this.getApp();
        if (!app.currentDocId) return;
        const link = document.createElement('a');
        link.href = `/api/document/${app.currentDocId}/file?t=${Date.now()}`;
        link.download = `formulario_preenchido_${app.currentDocName || 'documento.pdf'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

window.acroFormManager = new AcroFormManager();
