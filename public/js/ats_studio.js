/* ==========================================================================
   ATS Resume Studio Module - Intelligent Job Matching & ATS Score Optimization
   ========================================================================== */

class AtsStudio {
    constructor() {
        this.resumeData = null;
        this.optimizationResult = null;
        this.currentDocId = null;
        this.pdfDoc = null;
        this.scale = 1.1;

        this.initElements();
        this.initEvents();
        this.loadInitialSample();
    }

    initElements() {
        // Form Inputs
        this.inputName = document.getElementById('atsInputName');
        this.inputTitle = document.getElementById('atsInputTitle');
        this.inputLocation = document.getElementById('atsInputLocation');
        this.inputEmail = document.getElementById('atsInputEmail');
        this.inputPhone = document.getElementById('atsInputPhone');
        this.inputLinkedin = document.getElementById('atsInputLinkedin');
        this.inputGithub = document.getElementById('atsInputGithub');
        this.inputPortfolio = document.getElementById('atsInputPortfolio');
        this.textareaSummary = document.getElementById('atsTextareaSummary');
        
        // Job Description Inputs
        this.inputTargetRole = document.getElementById('atsTargetRole');
        this.textareaJobDesc = document.getElementById('atsJobDescription');

        // Score & Keyword Elements
        this.scoreCircle = document.getElementById('atsScoreCircle');
        this.scoreStatusTag = document.getElementById('atsScoreStatusTag');
        this.scoreSummaryText = document.getElementById('atsScoreSummaryText');
        this.matchedKeywordsContainer = document.getElementById('atsMatchedKeywords');
        this.missingKeywordsContainer = document.getElementById('atsMissingKeywords');
        this.suggestionsList = document.getElementById('atsSuggestionsList');

        // Preview & Action Buttons
        this.previewCanvasContainer = document.getElementById('atsCanvasContainer');
        this.btnOptimize = document.getElementById('btnAtsOptimize');
        this.btnGeneratePdf = document.getElementById('btnAtsGeneratePdf');
        this.btnDownloadPdf = document.getElementById('btnAtsDownloadPdf');
        this.btnImportPdf = document.getElementById('btnAtsImportPdf');
        this.fileInput = document.getElementById('atsFileInput');
    }

    initEvents() {
        // Tab Switching inside ATS Left Panel
        document.querySelectorAll('.ats-nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Optimize Button
        if (this.btnOptimize) {
            this.btnOptimize.addEventListener('click', () => this.optimizeWithAi());
        }

        // Generate PDF Button
        if (this.btnGeneratePdf) {
            this.btnGeneratePdf.addEventListener('click', () => this.generateAtsPdf(true));
        }

        // Download Button
        if (this.btnDownloadPdf) {
            this.btnDownloadPdf.addEventListener('click', () => {
                if (this.currentDocId) {
                    window.location.href = `/api/document/${this.currentDocId}/download`;
                } else {
                    window.App.showToast('Gere o currículo ATS antes de baixar.', 'error');
                }
            });
        }

        // Import Resume PDF
        if (this.btnImportPdf && this.fileInput) {
            this.btnImportPdf.addEventListener('click', () => {
                this.fileInput.value = ''; // Always clear to allow re-importing the same file
                this.fileInput.click();
            });
            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.importResumePdf(e.target.files[0]);
                }
            });
        }

        // Add Experience Item Button
        const btnAddExp = document.getElementById('btnAddExperience');
        if (btnAddExp) {
            btnAddExp.addEventListener('click', () => this.addExperienceItem());
        }

        // Add Skill Category Button
        const btnAddSkill = document.getElementById('btnAddSkill');
        if (btnAddSkill) {
            btnAddSkill.addEventListener('click', () => this.addSkillCategory());
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.ats-nav-tab').forEach(t => {
            if (t.dataset.tab === tabName) t.classList.add('active');
            else t.classList.remove('active');
        });
        document.querySelectorAll('.ats-tab-content').forEach(c => {
            c.classList.remove('active');
        });
        const targetContent = document.getElementById(`atsTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
        if (targetContent) targetContent.classList.add('active');
    }

    async loadInitialSample() {
        try {
            const resp = await fetch('/api/ats/sample');
            const data = await resp.json();
            if (data.success && data.sample) {
                this.resumeData = data.sample;
                this.populateForm(this.resumeData);
                await this.generateAtsPdf(false);
            }
        } catch (e) {
            console.warn('Could not load ATS sample:', e);
        }
    }

    populateForm(data) {
        if (!data) return;
        this.resumeData = data;

        if (this.inputName) this.inputName.value = data.name || '';
        if (this.inputTitle) this.inputTitle.value = data.title || '';
        if (this.inputTargetRole && !this.inputTargetRole.value) this.inputTargetRole.value = data.title || '';
        
        if (data.contacts) {
            if (this.inputLocation) this.inputLocation.value = data.contacts.location || '';
            if (this.inputEmail) this.inputEmail.value = data.contacts.email || '';
            if (this.inputPhone) this.inputPhone.value = data.contacts.phone || '';
            if (this.inputLinkedin) this.inputLinkedin.value = data.contacts.linkedin || '';
            if (this.inputGithub) this.inputGithub.value = data.contacts.github || '';
            if (this.inputPortfolio) this.inputPortfolio.value = data.contacts.portfolio || '';
        }

        if (this.textareaSummary) this.textareaSummary.value = data.summary || '';

        // Render Experience Items
        this.renderExperienceForm(data.experience || []);

        // Render Skills Form
        this.renderSkillsForm(data.skills || []);

        // Render Education Form
        this.renderEducationForm(data.education || []);
    }

    collectFormData() {
        const data = {
            name: this.inputName?.value?.trim() || this.resumeData?.name || 'Candidato',
            title: this.inputTitle?.value?.trim() || this.resumeData?.title || 'Especialista',
            contacts: {
                location: this.inputLocation?.value?.trim() || '',
                email: this.inputEmail?.value?.trim() || '',
                phone: this.inputPhone?.value?.trim() || '',
                linkedin: this.inputLinkedin?.value?.trim() || '',
                github: this.inputGithub?.value?.trim() || '',
                portfolio: this.inputPortfolio?.value?.trim() || ''
            },
            summary: this.textareaSummary?.value?.trim() || '',
            skills: [],
            experience: [],
            education: [],
            certifications: this.resumeData?.certifications || [],
            languages: this.resumeData?.languages || [{ language: "Português", level: "Nativo" }, { language: "Inglês", level: "Avançado" }]
        };

        // Collect Experience from DOM
        document.querySelectorAll('.exp-form-item').forEach(el => {
            const company = el.querySelector('.exp-company')?.value.trim() || '';
            const role = el.querySelector('.exp-role')?.value.trim() || '';
            const period = el.querySelector('.exp-period')?.value.trim() || '';
            const stack = el.querySelector('.exp-stack')?.value.trim() || '';
            const bulletsText = el.querySelector('.exp-bullets')?.value.trim() || '';
            
            const bullets = bulletsText.split('\n').map(b => b.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);

            if (company || role || bullets.length > 0) {
                data.experience.push({ company, role, period, stack, bullets });
            }
        });

        // Collect Skills from DOM
        document.querySelectorAll('.skill-form-item').forEach(el => {
            const category = el.querySelector('.skill-cat')?.value.trim() || '';
            const items = el.querySelector('.skill-items')?.value.trim() || '';
            if (category || items) {
                data.skills.push({ category: category || 'Habilidades', items });
            }
        });

        // Collect Education from DOM
        document.querySelectorAll('.edu-form-item').forEach(el => {
            const degree = el.querySelector('.edu-degree')?.value.trim() || '';
            const institution = el.querySelector('.edu-inst')?.value.trim() || '';
            const year = el.querySelector('.edu-year')?.value.trim() || '';
            if (degree || institution) {
                data.education.push({ degree, institution, status: "Concluído", year });
            }
        });

        // Fallback to resumeData if DOM lists were empty
        if (data.skills.length === 0 && this.resumeData?.skills?.length > 0) {
            data.skills = this.resumeData.skills;
        }
        if (data.experience.length === 0 && this.resumeData?.experience?.length > 0) {
            data.experience = this.resumeData.experience;
        }
        if (data.education.length === 0 && this.resumeData?.education?.length > 0) {
            data.education = this.resumeData.education;
        }

        this.resumeData = data;
        return data;
    }

    renderExperienceForm(experiences) {
        const container = document.getElementById('experienceListContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!experiences || experiences.length === 0) {
            container.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px 0;">Nenhuma experiência cadastrada. Clique no botão acima para adicionar.</div>';
            return;
        }

        experiences.forEach((exp, idx) => {
            const item = document.createElement('div');
            item.className = 'ats-accordion-item exp-form-item';
            item.innerHTML = `
                <div class="ats-accordion-header">
                    <span><i class="fa-solid fa-briefcase"></i> ${exp.company || 'Experiência'} — ${exp.role || 'Cargo'}</span>
                    <button type="button" class="mini-btn btn-remove-exp" style="color: var(--accent-red);"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="ats-accordion-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Empresa</label>
                            <input type="text" class="form-input exp-company" value="${exp.company || ''}" placeholder="Ex: Google, Nubank...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Cargo / Função</label>
                            <input type="text" class="form-input exp-role" value="${exp.role || ''}" placeholder="Ex: Desenvolvedor Sênior">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Período</label>
                            <input type="text" class="form-input exp-period" value="${exp.period || ''}" placeholder="Ex: Jan 2022 - Presente">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Stack / Tecnologias</label>
                            <input type="text" class="form-input exp-stack" value="${exp.stack || ''}" placeholder="Ex: React, Node.js, AWS">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <span>Realizações (Formato STAR / Google XYZ)</span>
                            <small>1 por linha</small>
                        </label>
                        <textarea class="form-textarea exp-bullets" rows="3" placeholder="• Conquistei [X], medido por [Y], realizando [Z]...">${Array.isArray(exp.bullets) ? exp.bullets.join('\n') : (exp.bullets || '')}</textarea>
                    </div>
                </div>
            `;

            item.querySelector('.btn-remove-exp').addEventListener('click', (e) => {
                e.stopPropagation();
                item.remove();
            });

            container.appendChild(item);
        });
    }

    addExperienceItem() {
        const container = document.getElementById('experienceListContainer');
        const item = document.createElement('div');
        item.className = 'ats-accordion-item exp-form-item';
        item.innerHTML = `
            <div class="ats-accordion-header">
                <span><i class="fa-solid fa-briefcase"></i> Nova Experiência Profissional</span>
                <button type="button" class="mini-btn btn-remove-exp" style="color: var(--accent-red);"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="ats-accordion-body">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Empresa</label>
                        <input type="text" class="form-input exp-company" placeholder="Ex: Empresa Tech">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cargo / Função</label>
                        <input type="text" class="form-input exp-role" placeholder="Ex: Engenheiro de Software">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Período</label>
                        <input type="text" class="form-input exp-period" placeholder="Ex: Mar 2023 - Presente">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Stack / Tecnologias</label>
                        <input type="text" class="form-input exp-stack" placeholder="Ex: TypeScript, PostgreSQL">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Realizações (1 por linha)</label>
                    <textarea class="form-textarea exp-bullets" rows="3" placeholder="• Otimizou o processo X alcançando ganho de Y%..."></textarea>
                </div>
            </div>
        `;
        item.querySelector('.btn-remove-exp').addEventListener('click', () => item.remove());
        container.appendChild(item);
    }

    renderSkillsForm(skills) {
        const container = document.getElementById('skillsListContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!skills || skills.length === 0) {
            container.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px 0;">Nenhuma competência cadastrada. Clique no botão acima para adicionar.</div>';
            return;
        }

        skills.forEach(skill => {
            const item = document.createElement('div');
            item.className = 'form-row skill-form-item';
            item.style.marginBottom = '8px';
            item.innerHTML = `
                <div class="form-group" style="flex: 0.4;">
                    <input type="text" class="form-input skill-cat" value="${skill.category || ''}" placeholder="Categoria (ex: Backend)">
                </div>
                <div class="form-group" style="flex: 0.6;">
                    <input type="text" class="form-input skill-items" value="${skill.items || ''}" placeholder="Itens separados por vírgula">
                </div>
                <button type="button" class="mini-btn btn-remove-skill" style="align-self: center; color: var(--accent-red);"><i class="fa-solid fa-xmark"></i></button>
            `;
            item.querySelector('.btn-remove-skill').addEventListener('click', () => item.remove());
            container.appendChild(item);
        });
    }

    addSkillCategory() {
        const container = document.getElementById('skillsListContainer');
        const item = document.createElement('div');
        item.className = 'form-row skill-form-item';
        item.style.marginBottom = '8px';
        item.innerHTML = `
            <div class="form-group" style="flex: 0.4;">
                <input type="text" class="form-input skill-cat" placeholder="Nova Categoria">
            </div>
            <div class="form-group" style="flex: 0.6;">
                <input type="text" class="form-input skill-items" placeholder="Tecnologias...">
            </div>
            <button type="button" class="mini-btn btn-remove-skill" style="align-self: center; color: var(--accent-red);"><i class="fa-solid fa-xmark"></i></button>
        `;
        item.querySelector('.btn-remove-skill').addEventListener('click', () => item.remove());
        container.appendChild(item);
    }

    renderEducationForm(education) {
        const container = document.getElementById('educationListContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!education || education.length === 0) {
            container.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px 0;">Nenhuma formação cadastrada.</div>';
            return;
        }

        education.forEach(edu => {
            const item = document.createElement('div');
            item.className = 'form-row edu-form-item';
            item.style.marginBottom = '8px';
            item.innerHTML = `
                <div class="form-group" style="flex: 0.5;">
                    <input type="text" class="form-input edu-degree" value="${edu.degree || ''}" placeholder="Curso / Grau">
                </div>
                <div class="form-group" style="flex: 0.35;">
                    <input type="text" class="form-input edu-inst" value="${edu.institution || ''}" placeholder="Instituição">
                </div>
                <div class="form-group" style="flex: 0.15;">
                    <input type="text" class="form-input edu-year" value="${edu.year || ''}" placeholder="Ano">
                </div>
            `;
            container.appendChild(item);
        });
    }

    async optimizeWithAi() {
        const jobDesc = this.textareaJobDesc.value.trim();
        const targetRole = this.inputTargetRole.value.trim();

        if (!jobDesc) {
            window.App.showToast('Por favor, cole a descrição da vaga de emprego para análise.', 'error');
            return;
        }

        const currentData = this.collectFormData();
        window.App.showToast('IA analisando requisitos e otimizando para ATS...', 'info');

        try {
            const resp = await fetch('/api/ats/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resumeData: currentData,
                    jobDescription: jobDesc,
                    targetRole: targetRole
                })
            });

            const result = await resp.json();
            if (result.success) {
                this.optimizationResult = result;
                this.renderScoreDashboard(result);
                
                if (result.optimizedResume) {
                    this.populateForm(result.optimizedResume);
                }

                await this.generateAtsPdf(false);
                window.App.showToast(`Otimização concluída! Score ATS: ${result.score}%`, 'success');
            } else {
                window.App.showToast(result.error || 'Erro na otimização com IA.', 'error');
            }
        } catch (err) {
            window.App.showToast(`Erro de conexão com IA: ${err.message}`, 'error');
        }
    }

    renderScoreDashboard(result) {
        const score = result.score || 0;
        this.scoreCircle.textContent = `${score}%`;

        // Update score color and status
        this.scoreCircle.className = 'score-circle';
        if (score >= 85) {
            this.scoreStatusTag.textContent = 'Excelente Compatibilidade com Bots ATS';
            this.scoreStatusTag.style.color = 'var(--accent-green)';
        } else if (score >= 65) {
            this.scoreCircle.classList.add('medium');
            this.scoreStatusTag.textContent = 'Compatibilidade Moderada — Termos sugeridos aplicados';
            this.scoreStatusTag.style.color = 'var(--accent-amber)';
        } else {
            this.scoreCircle.classList.add('low');
            this.scoreStatusTag.textContent = 'Baixa Compatibilidade — Requer adequação';
            this.scoreStatusTag.style.color = 'var(--accent-red)';
        }

        this.scoreSummaryText.textContent = result.summaryAnalysis || 'Análise completa dos termos da vaga efetuada com sucesso.';

        // Matched Keywords
        this.matchedKeywordsContainer.innerHTML = '';
        (result.matchedKeywords || []).forEach(kw => {
            const chip = document.createElement('span');
            chip.className = 'chip chip-match';
            chip.innerHTML = `<i class="fa-solid fa-check"></i> ${kw}`;
            this.matchedKeywordsContainer.appendChild(chip);
        });

        // Missing Keywords
        this.missingKeywordsContainer.innerHTML = '';
        (result.missingKeywords || []).forEach(kw => {
            const chip = document.createElement('span');
            chip.className = 'chip chip-missing';
            chip.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${kw}`;
            this.missingKeywordsContainer.appendChild(chip);
        });

        // Suggestions List
        this.suggestionsList.innerHTML = '';
        (result.suggestions || []).forEach(sug => {
            const li = document.createElement('li');
            li.style.fontSize = '11.5px';
            li.style.color = 'var(--text-secondary)';
            li.style.marginBottom = '4px';
            li.innerHTML = `<i class="fa-solid fa-lightbulb" style="color: var(--accent-amber); margin-right: 6px;"></i> ${sug}`;
            this.suggestionsList.appendChild(li);
        });
    }

    async generateAtsPdf(showToastMsg = true) {
        const currentData = this.collectFormData();
        if (showToastMsg) window.App.showToast('Compilando PDF diagramado no padrão ATS...', 'info');

        try {
            const resp = await fetch('/api/ats/generate-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resumeData: currentData,
                    style: 'executive'
                })
            });

            const result = await resp.json();
            if (result.success) {
                this.currentDocId = result.docId;
                await this.renderPdfPreview(result.fileUrl);
                if (showToastMsg) window.App.showToast('PDF ATS gerado com sucesso!', 'success');
            } else {
                if (showToastMsg) window.App.showToast(result.error || 'Erro ao gerar PDF.', 'error');
            }
        } catch (err) {
            console.error('Error generating ATS PDF:', err);
        }
    }

    async renderPdfPreview(pdfUrl) {
        if (!this.previewCanvasContainer) return;
        this.previewCanvasContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; margin-top: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Renderizando documento...</div>';

        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            this.pdfDoc = await loadingTask.promise;
            this.previewCanvasContainer.innerHTML = '';

            const wrapper = document.getElementById('atsPreviewWrapper');
            const wrapperWidth = wrapper ? wrapper.clientWidth - 48 : 500;
            const samplePage = await this.pdfDoc.getPage(1);
            const unscaledViewport = samplePage.getViewport({ scale: 1.0 });
            const fitScale = Math.min(Math.max(wrapperWidth / unscaledViewport.width, 0.65), 1.15);
            this.scale = fitScale;

            for (let p = 1; p <= this.pdfDoc.numPages; p++) {
                const page = await this.pdfDoc.getPage(p);
                const viewport = page.getViewport({ scale: this.scale });

                const card = document.createElement('div');
                card.className = 'ats-preview-card';
                card.style.marginBottom = '16px';

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

    /**
     * Fast & Resilient Client-Side Text Extraction + Server AI Processing
     */
    async extractTextFromPdfClient(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
            return fullText;
        } catch (e) {
            console.warn('Client-side PDF text extraction fallback:', e);
            return '';
        }
    }

    /**
     * Heuristic parser to extract key resume fields from raw text in milliseconds
     */
    parseResumeFromRawText(rawText, filename) {
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        const name = lines[0] ? lines[0].substring(0, 40) : (filename.replace('.pdf', '') || 'Candidato');

        // Find email
        const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const email = emailMatch ? emailMatch[0] : '';

        // Find phone
        const phoneMatch = rawText.match(/(?:\+55\s?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0] : '';

        // Find LinkedIn
        const linkedinMatch = rawText.match(/(?:linkedin\.com\/in\/[\w-]+)/i);
        const linkedin = linkedinMatch ? linkedinMatch[0] : '';

        // Find GitHub
        const githubMatch = rawText.match(/(?:github\.com\/[\w-]+)/i);
        const github = githubMatch ? githubMatch[0] : '';

        return {
            name: name,
            title: lines[1] ? lines[1].substring(0, 50) : 'Profissional Especialista',
            contacts: {
                location: 'Brasil',
                email: email,
                phone: phone,
                linkedin: linkedin,
                github: github,
                portfolio: ''
            },
            summary: rawText.substring(0, 300).replace(/\s+/g, ' ') + '...',
            skills: [
                { category: "Competências & Tecnologias", items: "TypeScript, JavaScript, React, Node.js, SQL, Git, Docker" }
            ],
            experience: [
                {
                    company: "Experiência Profissional",
                    role: lines[1] || "Desenvolvedor / Especialista",
                    period: "Recente",
                    location: "Remoto / Híbrido",
                    stack: "Stack Técnica",
                    bullets: [
                        "Atuação em projetos de alto impacto com foco em qualidade e escalabilidade.",
                        "Otimização de processos operacionais e integração de novas tecnologias."
                    ]
                }
            ],
            education: [
                { degree: "Graduação / Especialização", institution: "Instituição de Ensino", status: "Concluído", year: "2023" }
            ],
            certifications: [],
            languages: [{ language: "Português", level: "Nativo" }]
        };
    }

    async importResumePdf(file) {
        window.App.showToast(`Importando e processando ${file.name}...`, 'info');
        
        // 1. Instantly extract text on client side with PDF.js
        const rawText = await this.extractTextFromPdfClient(file);
        
        // 2. Prepare heuristic initial parse so the UI NEVER stalls
        if (rawText && rawText.length > 20) {
            const fastData = this.parseResumeFromRawText(rawText, file.name);
            this.populateForm(fastData);
            this.switchTab('personal'); // Switch to Personal Data tab so user sees the update immediately!
            await this.generateAtsPdf(false);
        }

        // 3. Send to Server & Gemini AI for semantic structuring
        const formData = new FormData();
        formData.append('file', file);
        if (rawText) formData.append('rawText', rawText);

        try {
            const resp = await fetch('/api/ats/extract-from-pdf', {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();
            if (data.success && data.resumeData) {
                this.populateForm(data.resumeData);
                this.switchTab('personal');
                await this.generateAtsPdf(false);
                window.App.showToast('Currículo importado e estruturado com sucesso!', 'success');
            }
        } catch (err) {
            console.warn('AI structure error, using client-extracted data:', err.message);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.AtsStudio = new AtsStudio();
});
