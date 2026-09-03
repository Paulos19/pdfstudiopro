/* ==========================================================================
   Prompt Document & Contract Studio Module - PDF Studio Pro
   ========================================================================== */

class PromptDocStudio {
    constructor() {
        this.templates = [];
        this.currentDocData = null;
        this.currentDocId = null;
        this.pdfDoc = null;
        this.scale = 1.05;
        this.selectedTone = 'Jurídico Formal e Equilibrado';
        this.selectedTemplateType = 'Contrato de Prestação de Serviços';

        this.initElements();
        this.initEvents();
        this.loadTemplates();
    }

    initElements() {
        // Preset cards container
        this.presetContainer = document.getElementById('promptPresetCards');

        // Form Inputs
        this.inputPrompt = document.getElementById('promptDocInput');
        this.inputForum = document.getElementById('inputDocForum');
        this.partyContratanteName = document.getElementById('partyContratanteName');
        this.partyContratanteDoc = document.getElementById('partyContratanteDoc');
        this.partyContratadaName = document.getElementById('partyContratadaName');
        this.partyContratadaDoc = document.getElementById('partyContratadaDoc');

        this.optIncludeLgpd = document.getElementById('optDocLgpd');
        this.optIncludeIp = document.getElementById('optDocIp');

        // Action Buttons
        this.btnGenerate = document.getElementById('btnGeneratePromptDoc');
        this.btnRecompile = document.getElementById('btnRecompilePromptPdf');
        this.btnDownload = document.getElementById('btnDownloadPromptPdf');
        this.btnOpenInStudio = document.getElementById('btnOpenPromptDocInStudio');
        this.btnAddClause = document.getElementById('btnAddDocClause');

        // Accordion and Preview
        this.clausesContainer = document.getElementById('clausesAccordionContainer');
        this.previewCanvasContainer = document.getElementById('promptPdfCanvasContainer');
        this.docMetaTitle = document.getElementById('promptDocMetaTitle');
        this.docMetaClausesCount = document.getElementById('promptDocMetaClausesCount');
    }

    initEvents() {
        // Generate Button
        if (this.btnGenerate) {
            this.btnGenerate.addEventListener('click', () => this.generateDocument());
        }

        // Recompile PDF Button
        if (this.btnRecompile) {
            this.btnRecompile.addEventListener('click', () => this.recompilePdf());
        }

        // Download Button
        if (this.btnDownload) {
            this.btnDownload.addEventListener('click', () => {
                if (this.currentDocId) {
                    window.location.href = `/api/document/${this.currentDocId}/download`;
                } else {
                    window.App.showToast('Gere o documento antes de realizar o download.', 'error');
                }
            });
        }

        // Open in C++ Studio
        if (this.btnOpenInStudio) {
            this.btnOpenInStudio.addEventListener('click', () => {
                if (this.currentDocId && window.App) {
                    window.App.navigateTo('studio');
                    window.App.showToast('Documento carregado no Editor Nativo C++!', 'success');
                }
            });
        }

        // Add Clause
        if (this.btnAddClause) {
            this.btnAddClause.addEventListener('click', () => this.addCustomClause());
        }

        // Tone Selector Pills
        document.querySelectorAll('.tone-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.tone-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.selectedTone = pill.dataset.tone;
            });
        });

        // Tabs in Left Panel of Prompt Doc
        document.querySelectorAll('.prompt-nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.prompt-nav-tab').forEach(t => {
            if (t.dataset.tab === tabName) t.classList.add('active');
            else t.classList.remove('active');
        });
        document.querySelectorAll('.prompt-tab-content').forEach(c => {
            c.classList.remove('active');
        });
        const targetContent = document.getElementById(`promptTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
        if (targetContent) targetContent.classList.add('active');
    }

    async loadTemplates() {
        try {
            const resp = await fetch('/api/prompt-doc/templates');
            const data = await resp.json();
            if (data.success && data.templates) {
                this.templates = data.templates;
                this.renderPresetCards(this.templates);

                // Load first template as default
                if (this.templates.length > 0) {
                    this.applyTemplate(this.templates[0], false);
                }
            }
        } catch (e) {
            console.warn('Could not load prompt templates:', e);
        }
    }

    renderPresetCards(templates) {
        if (!this.presetContainer) return;
        this.presetContainer.innerHTML = '';

        templates.forEach(tpl => {
            const card = document.createElement('div');
            card.className = 'prompt-preset-card';
            card.innerHTML = `
                <div class="preset-card-header">
                    <div class="preset-icon"><i class="fa-solid ${tpl.icon || 'fa-file-lines'}"></i></div>
                    <span class="preset-badge">${tpl.badge || 'Modelo'}</span>
                </div>
                <div class="preset-title">${tpl.title}</div>
                <div class="preset-desc">${tpl.defaultPrompt.substring(0, 85)}...</div>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.prompt-preset-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.applyTemplate(tpl, true);
            });

            this.presetContainer.appendChild(card);
        });

        if (this.presetContainer.firstChild) {
            this.presetContainer.firstChild.classList.add('active');
        }
    }

    applyTemplate(tpl, showToast = true) {
        this.selectedTemplateType = tpl.title;
        if (this.inputPrompt) this.inputPrompt.value = tpl.defaultPrompt;

        if (tpl.parties) {
            if (this.partyContratanteName) this.partyContratanteName.value = tpl.parties.contratante || '';
            if (this.partyContratadaName) this.partyContratadaName.value = tpl.parties.contratada || '';
        }

        // Set tone pill
        if (tpl.tone) {
            this.selectedTone = tpl.tone;
            document.querySelectorAll('.tone-pill').forEach(pill => {
                if (pill.dataset.tone === tpl.tone) pill.classList.add('active');
                else pill.classList.remove('active');
            });
        }

        if (showToast) {
            window.App.showToast(`Modelo carregado: ${tpl.title}`, 'info');
        }
    }

    async generateDocument() {
        const promptText = this.inputPrompt?.value?.trim();
        if (!promptText) {
            window.App.showToast('Por favor, digite a instrução ou selecione um modelo para gerar.', 'error');
            return;
        }

        const parties = [
            {
                role: "CONTRATANTE",
                name: this.partyContratanteName?.value?.trim() || "EMPRESA CONTRATANTE LTDA",
                document: this.partyContratanteDoc?.value?.trim() || "CNPJ nº 00.000.000/0001-00",
                address: "São Paulo - SP",
                representative: "representada na forma de seus atos constitutivos"
            },
            {
                role: "CONTRATADA",
                name: this.partyContratadaName?.value?.trim() || "PRESTADOR DE SERVIÇOS TECH ME",
                document: this.partyContratadaDoc?.value?.trim() || "CNPJ nº 11.111.111/0001-11",
                address: "Campinas - SP",
                representative: "representada por seu titular"
            }
        ];

        const options = {
            forum: this.inputForum?.value?.trim() || 'Comarca de São Paulo/SP',
            includeLgpd: this.optIncludeLgpd ? this.optIncludeLgpd.checked : true,
            includeIp: this.optIncludeIp ? this.optIncludeIp.checked : true
        };

        window.App.showToast('Enviando prompt ao Gemini para redação do documento...', 'info');

        try {
            const resp = await fetch('/api/prompt-doc/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptText,
                    templateType: this.selectedTemplateType,
                    tone: this.selectedTone,
                    parties: parties,
                    options: options
                })
            });

            const result = await resp.json();
            if (result.success && result.docData) {
                this.currentDocData = result.docData;
                this.currentDocId = result.docId;
                
                this.renderClausesAccordion(this.currentDocData.clauses || []);
                this.updateMetaHeader(this.currentDocData);
                await this.renderPdfPreview(result.fileUrl);

                window.App.showToast('Documento oficial gerado e compilado com sucesso!', 'success');
            } else {
                window.App.showToast(result.error || 'Erro ao gerar documento com IA.', 'error');
            }
        } catch (err) {
            window.App.showToast(`Erro na requisição: ${err.message}`, 'error');
        }
    }

    updateMetaHeader(docData) {
        if (this.docMetaTitle) {
            this.docMetaTitle.textContent = docData.title || 'Documento Oficial';
        }
        if (this.docMetaClausesCount) {
            const count = (docData.clauses || []).length;
            this.docMetaClausesCount.textContent = `${count} Cláusulas Redigidas`;
        }
    }

    renderClausesAccordion(clauses) {
        if (!this.clausesContainer) return;
        this.clausesContainer.innerHTML = '';

        if (!clauses || clauses.length === 0) {
            this.clausesContainer.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted); padding: 12px 0;">Nenhuma cláusula redigida ainda. Gere um documento acima.</div>';
            return;
        }

        clauses.forEach((clause, idx) => {
            const item = document.createElement('div');
            item.className = 'prompt-clause-card';
            item.innerHTML = `
                <div class="clause-card-header">
                    <div class="clause-title-box">
                        <span class="clause-num-badge">${clause.number || `CLÁUSULA ${idx + 1}`}</span>
                        <input type="text" class="form-input clause-title-input" value="${clause.title || ''}" placeholder="Título da Cláusula">
                    </div>
                    <div class="clause-actions">
                        <button type="button" class="mini-btn btn-refine-clause" title="Pedir para IA refinar esta cláusula">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Refinar com IA
                        </button>
                        <button type="button" class="mini-btn btn-remove-clause" style="color: var(--accent-red);" title="Excluir cláusula">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="clause-card-body">
                    <div class="form-group">
                        <label class="form-label">Texto Principal da Cláusula</label>
                        <textarea class="form-textarea clause-content-textarea" rows="3">${clause.content || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Subitens / Parágrafos (1 por linha)</label>
                        <textarea class="form-textarea clause-subitems-textarea" rows="2" placeholder="1.1. Subitem...">${Array.isArray(clause.subitems) ? clause.subitems.join('\n') : (clause.subitems || '')}</textarea>
                    </div>
                </div>
            `;

            // Remove clause
            item.querySelector('.btn-remove-clause').addEventListener('click', () => {
                item.remove();
                this.recompilePdf();
            });

            // Refine clause with AI
            item.querySelector('.btn-refine-clause').addEventListener('click', async () => {
                const instruction = prompt('Como deseja que a IA refine esta cláusula? (Ex: Aumentar a multa, simplificar termos, detalhar prazos):');
                if (instruction) {
                    await this.refineSpecificClause(item, clause, instruction);
                }
            });

            this.clausesContainer.appendChild(item);
        });
    }

    async refineSpecificClause(domItem, clause, instruction) {
        window.App.showToast('Refinando cláusula com Gemini...', 'info');

        const currentClause = {
            number: domItem.querySelector('.clause-num-badge')?.textContent || clause.number,
            title: domItem.querySelector('.clause-title-input')?.value || clause.title,
            content: domItem.querySelector('.clause-content-textarea')?.value || clause.content,
            subitems: domItem.querySelector('.clause-subitems-textarea')?.value.split('\n').filter(Boolean) || []
        };

        try {
            const resp = await fetch('/api/prompt-doc/refine-clause', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clause: currentClause,
                    instruction: instruction
                })
            });

            const result = await resp.json();
            if (result.success && result.clause) {
                domItem.querySelector('.clause-title-input').value = result.clause.title || currentClause.title;
                domItem.querySelector('.clause-content-textarea').value = result.clause.content || currentClause.content;
                domItem.querySelector('.clause-subitems-textarea').value = Array.isArray(result.clause.subitems) ? result.clause.subitems.join('\n') : '';

                window.App.showToast('Cláusula refinada! Atualizando PDF...', 'success');
                await this.recompilePdf();
            }
        } catch (e) {
            window.App.showToast(`Erro no refinamento: ${e.message}`, 'error');
        }
    }

    addCustomClause() {
        const count = document.querySelectorAll('.prompt-clause-card').length + 1;
        const item = document.createElement('div');
        item.className = 'prompt-clause-card';
        item.innerHTML = `
            <div class="clause-card-header">
                <div class="clause-title-box">
                    <span class="clause-num-badge">CLÁUSULA ${count}</span>
                    <input type="text" class="form-input clause-title-input" value="NOVA CLÁUSULA" placeholder="Título da Cláusula">
                </div>
                <div class="clause-actions">
                    <button type="button" class="mini-btn btn-remove-clause" style="color: var(--accent-red);"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="clause-card-body">
                <div class="form-group">
                    <label class="form-label">Texto Principal da Cláusula</label>
                    <textarea class="form-textarea clause-content-textarea" rows="3" placeholder="Digite o texto da nova cláusula..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Subitens (1 por linha)</label>
                    <textarea class="form-textarea clause-subitems-textarea" rows="2" placeholder="1.1. Subitem..."></textarea>
                </div>
            </div>
        `;

        item.querySelector('.btn-remove-clause').addEventListener('click', () => {
            item.remove();
            this.recompilePdf();
        });

        this.clausesContainer.appendChild(item);
    }

    collectDocumentData() {
        const clauses = [];
        document.querySelectorAll('.prompt-clause-card').forEach((el, idx) => {
            const number = el.querySelector('.clause-num-badge')?.textContent?.trim() || `CLÁUSULA ${idx + 1}`;
            const title = el.querySelector('.clause-title-input')?.value?.trim() || 'DO OBJETO';
            const content = el.querySelector('.clause-content-textarea')?.value?.trim() || '';
            const subitemsRaw = el.querySelector('.clause-subitems-textarea')?.value?.trim() || '';
            const subitems = subitemsRaw.split('\n').map(s => s.trim()).filter(Boolean);

            if (content || title) {
                clauses.push({ number, title, content, subitems });
            }
        });

        const parties = [
            {
                role: "CONTRATANTE",
                name: this.partyContratanteName?.value?.trim() || "EMPRESA CONTRATANTE LTDA",
                document: this.partyContratanteDoc?.value?.trim() || "CNPJ nº 00.000.000/0001-00",
                address: "São Paulo - SP",
                representative: "representada na forma de seus atos constitutivos"
            },
            {
                role: "CONTRATADA",
                name: this.partyContratadaName?.value?.trim() || "PRESTADOR DE SERVIÇOS TECH ME",
                document: this.partyContratadaDoc?.value?.trim() || "CNPJ nº 11.111.111/0001-11",
                address: "Campinas - SP",
                representative: "representada por seu titular"
            }
        ];

        return {
            title: this.currentDocData?.title || 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS',
            category: this.currentDocData?.category || 'Contrato',
            parties: parties,
            preamble: this.currentDocData?.preamble || 'Pelo presente instrumento particular e na melhor forma de direito, as partes têm entre si justo e contratado:',
            clauses: clauses,
            closing: this.currentDocData?.closing || {
                city: "São Paulo",
                state: "SP",
                text: "E, por estarem assim justas e contratadas, as partes assinam o presente instrumento."
            },
            signatories: [
                { role: "CONTRATANTE", name: parties[0].name, doc: parties[0].document },
                { role: "CONTRATADA", name: parties[1].name, doc: parties[1].document }
            ]
        };
    }

    async recompilePdf() {
        const docData = this.collectDocumentData();
        window.App.showToast('Recompilando PDF com alterações...', 'info');

        try {
            const resp = await fetch('/api/prompt-doc/compile-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docData })
            });

            const result = await resp.json();
            if (result.success) {
                this.currentDocId = result.docId;
                this.currentDocData = docData;
                this.updateMetaHeader(docData);
                await this.renderPdfPreview(result.fileUrl);
                window.App.showToast('PDF atualizado!', 'success');
            }
        } catch (e) {
            console.error('Recompile error:', e);
        }
    }

    async renderPdfPreview(pdfUrl) {
        if (!this.previewCanvasContainer) return;
        this.previewCanvasContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; margin-top: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Renderizando documento...</div>';

        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            this.pdfDoc = await loadingTask.promise;
            this.previewCanvasContainer.innerHTML = '';

            const wrapper = document.getElementById('promptPdfPreviewWrapper');
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
            console.error('PDF Preview error:', e);
            this.previewCanvasContainer.innerHTML = `<div style="color: var(--accent-red); font-size: 12px;">Falha na renderização do PDF: ${e.message}</div>`;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.PromptDocStudio = new PromptDocStudio();
});
