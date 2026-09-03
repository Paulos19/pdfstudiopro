/* ==========================================================================
   Main Application Orchestrator - PDF Studio Pro
   ========================================================================== */

class App {
    constructor() {
        this.currentDocId = null;
        this.currentDocName = null;
        this.currentTool = 'select';
        this.currentRoute = 'ats-resume'; // Start directly in the ATS Resume Studio as requested

        this.initSidebarAndRouting();
        this.initEvents();
        this.checkEngineStatus();
        this.loadDefaultTemplate();
    }

    initSidebarAndRouting() {
        const sidebar = document.getElementById('appSidebar');
        const btnToggle = document.getElementById('btnToggleSidebar');

        // Sidebar collapse / expand
        const savedCollapsed = localStorage.getItem('pdf_studio_sidebar_collapsed');
        if (savedCollapsed === 'true' && sidebar) {
            sidebar.classList.add('collapsed');
            const icon = btnToggle?.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-chevron-right';
        }

        if (btnToggle && sidebar) {
            btnToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                localStorage.setItem('pdf_studio_sidebar_collapsed', isCollapsed);
                
                // Update icon direction
                const icon = btnToggle.querySelector('i');
                if (icon) {
                    icon.className = isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
                }
            });
        }

        // Mobile Menu Drawer Toggle & Backdrop
        const btnMobileMenu = document.getElementById('btnMobileMenuToggle');
        const backdrop = document.getElementById('sidebarBackdrop');

        if (btnMobileMenu && sidebar) {
            btnMobileMenu.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
                if (backdrop) backdrop.classList.toggle('active', sidebar.classList.contains('mobile-open'));
            });
        }

        if (backdrop && sidebar) {
            backdrop.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                backdrop.classList.remove('active');
            });
        }

        const btnMobileTheme = document.getElementById('btnMobileThemeToggle');
        if (btnMobileTheme) {
            btnMobileTheme.addEventListener('click', () => {
                document.body.classList.toggle('theme-light');
                const isLight = document.body.classList.contains('theme-light');
                localStorage.setItem('pdf_studio_theme', isLight ? 'light' : 'dark');
                btnMobileTheme.querySelector('i').className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
                if (btnThemeToggle) btnThemeToggle.querySelector('i').className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
            });
        }

        // Navigation Items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = item.dataset.route;
                if (route) this.navigateTo(route);
            });
        });

        // Theme Toggle (Dark Gray vs Light)
        const btnThemeToggle = document.getElementById('btnThemeToggle');
        if (btnThemeToggle) {
            btnThemeToggle.addEventListener('click', () => {
                document.body.classList.toggle('theme-light');
                const isLight = document.body.classList.contains('theme-light');
                localStorage.setItem('pdf_studio_theme', isLight ? 'light' : 'dark');
                btnThemeToggle.querySelector('i').className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
                if (btnMobileTheme) btnMobileTheme.querySelector('i').className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
            });

            if (localStorage.getItem('pdf_studio_theme') === 'light') {
                document.body.classList.add('theme-light');
                btnThemeToggle.querySelector('i').className = 'fa-solid fa-moon';
                if (btnMobileTheme) btnMobileTheme.querySelector('i').className = 'fa-solid fa-moon';
            }
        }

        // Default initial navigation
        this.navigateTo(this.currentRoute);
    }

    navigateTo(route) {
        this.currentRoute = route;

        // Auto-close mobile drawer on route select
        const sidebar = document.getElementById('appSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
            if (backdrop) backdrop.classList.remove('active');
        }

        // Update nav item active state
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.route === route) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update views
        document.querySelectorAll('.route-view').forEach(view => {
            view.classList.remove('active');
        });

        const targetView = document.getElementById(`view${this.capitalize(route.replace(/-([a-z])/g, g => g[1].toUpperCase()))}`);
        if (targetView) {
            targetView.classList.add('active');
        } else {
            // Placeholder fallback
            const placeholderView = document.getElementById('viewPlaceholder');
            if (placeholderView) {
                placeholderView.classList.add('active');
                const titleEl = placeholderView.querySelector('.placeholder-title');
                if (titleEl) titleEl.textContent = `Módulo ${route.toUpperCase()}`;
            }
        }
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    initEvents() {
        // Tool Buttons in Studio
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.setTool(tool);
            });
        });

        // Native Electron open file association
        if (window.electronAPI && window.electronAPI.onOpenExternalPdf) {
            window.electronAPI.onOpenExternalPdf((pdfPath) => {
                this.showToast(`Abrindo PDF associado...`, 'info');
            });
        }

        // Welcome Screen Action Buttons
        const btnWelcomeResume = document.getElementById('btnWelcomeResume');
        if (btnWelcomeResume) {
            btnWelcomeResume.addEventListener('click', () => this.loadTemplate('resume'));
        }
        const btnWelcomeContract = document.getElementById('btnWelcomeContract');
        if (btnWelcomeContract) {
            btnWelcomeContract.addEventListener('click', () => this.loadTemplate('contract'));
        }

        // Drag and Drop PDF support
        const dropzone = document.getElementById('welcomeDropzone');

        ['dragenter', 'dragover'].forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dropzone) dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dropzone) dropzone.classList.remove('dragover');
            });
        });

        window.addEventListener('drop', (e) => {
            const files = e.dataTransfer?.files;
            if (files && files.length > 0 && files[0].type === 'application/pdf') {
                this.uploadFile(files[0]);
            }
        });

        // Template Selector Dropdown
        const btnTemplates = document.getElementById('btnTemplatesMenu');
        const templatesDropdown = document.getElementById('templatesDropdown');
        if (btnTemplates && templatesDropdown) {
            btnTemplates.addEventListener('click', (e) => {
                e.stopPropagation();
                templatesDropdown.classList.toggle('show');
            });
            document.addEventListener('click', () => templatesDropdown.classList.remove('show'));

            document.querySelectorAll('#templatesDropdown .dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const templateType = item.dataset.template;
                    this.loadTemplate(templateType);
                });
            });
        }

        // Custom File Upload
        const fileInput = document.getElementById('fileUploadInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.uploadFile(e.target.files[0]);
                }
            });
        }

        // Reconstruct with AI
        const btnReconstructAi = document.getElementById('btnReconstructAi');
        if (btnReconstructAi) {
            btnReconstructAi.addEventListener('click', () => {
                this.reconstructWithAi();
            });
        }

        // Download PDF
        const btnDownloadPdf = document.getElementById('btnDownloadPdf');
        if (btnDownloadPdf) {
            btnDownloadPdf.addEventListener('click', () => {
                if (this.currentDocId) {
                    window.location.href = `/api/document/${this.currentDocId}/download`;
                } else {
                    this.showToast('Nenhum documento carregado para download.', 'error');
                }
            });
        }

        // Zoom Controls
        const btnZoomIn = document.getElementById('btnZoomIn');
        if (btnZoomIn) btnZoomIn.addEventListener('click', () => window.PdfViewer.zoomIn());
        const btnZoomOut = document.getElementById('btnZoomOut');
        if (btnZoomOut) btnZoomOut.addEventListener('click', () => window.PdfViewer.zoomOut());
        const btnFitWidth = document.getElementById('btnFitWidth');
        if (btnFitWidth) btnFitWidth.addEventListener('click', () => window.PdfViewer.fitWidth());
        const btnFitPage = document.getElementById('btnFitPage');
        if (btnFitPage) btnFitPage.addEventListener('click', () => window.PdfViewer.fitPage());

        // Sidebar Tabs inside Studio View
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                const pane = document.getElementById(`pane${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
                if (pane) pane.classList.add('active');

                if (tab === 'inspector' && this.currentDocId) {
                    window.Inspector.loadInspection(this.currentDocId);
                }
            });
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'v' || e.key === 'V') this.setTool('select');
            else if (e.key === 't' || e.key === 'T') this.setTool('edit-text');
            else if (e.key === 'h' || e.key === 'H') this.setTool('highlight');
            else if (e.key === 'p' || e.key === 'P') this.setTool('draw');
            else if (e.key === 's' || e.key === 'S') this.setTool('signature');
            else if (e.ctrlKey && (e.key === '+' || e.key === '=')) { e.preventDefault(); window.PdfViewer?.zoomIn(); }
            else if (e.ctrlKey && e.key === '-') { e.preventDefault(); window.PdfViewer?.zoomOut(); }
        });
    }

    async checkEngineStatus() {
        try {
            const resp = await fetch('/api/status');
            const data = await resp.json();
            const badge = document.getElementById('engineStatusBadge');
            if (badge) {
                const isReady = data.nativeEngine === 'ready';
                badge.innerHTML = `
                    <span class="status-dot ${isReady ? '' : 'offline'}"></span>
                    <span class="status-label">Motor C++: ${isReady ? 'Ativo' : 'Pendente'}</span>
                    <div class="nav-collapsed-tooltip">
                        <strong>Motor C++ Local</strong>
                        <span>Status: ${isReady ? 'Online & Pronto' : 'Pendente'}</span>
                    </div>
                `;
            }
        } catch (e) {
            console.warn('Status check failed');
        }
    }

    setTool(tool) {
        this.currentTool = tool;
        document.body.dataset.activeTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        const toolNames = {
            'select': 'Mover & Navegar',
            'edit-text': 'Edição de Texto In-Place (C++)',
            'add-text': 'Adicionar Novo Texto',
            'highlight': 'Marca-Texto / Destaque',
            'draw': 'Caneta Livre',
            'rect': 'Retângulo',
            'redact': 'Redação Permanente (Expurgo de Bytes)',
            'signature': 'Assinatura & Selos Digitais',
            'signature-place': 'Clique no PDF para Carimbar / Assinar'
        };
        const labelEl = document.getElementById('currentToolLabel');
        if (labelEl) labelEl.textContent = toolNames[tool] || tool;

        if (tool === 'signature' && window.SignatureStudio) {
            window.SignatureStudio.openModal();
        }
    }

    async loadTemplate(type) {
        this.showToast(`Carregando modelo: ${type}...`, 'info');
        try {
            const resp = await fetch(`/api/templates/${type}/load`, { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                this.currentDocId = data.docId;
                this.currentDocName = data.docInfo.originalName;
                const docTitleEl = document.getElementById('currentDocName');
                if (docTitleEl) docTitleEl.textContent = this.currentDocName;

                if (window.PdfViewer) await window.PdfViewer.loadDocument(data.docId, `/api/document/${data.docId}/file`);
                if (window.PageManager) await window.PageManager.renderThumbnails(window.PdfViewer.pdfDoc);
                if (window.Inspector) window.Inspector.loadInspection(data.docId);

                this.showToast(`Documento ${this.currentDocName} carregado!`, 'success');
            }
        } catch (err) {
            this.showToast(`Erro ao carregar modelo: ${err.message}`, 'error');
        }
    }

    async loadDefaultTemplate() {
        await this.loadTemplate('contract');
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        this.showToast(`Enviando ${file.name}...`, 'info');
        try {
            const resp = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();
            if (data.success) {
                this.currentDocId = data.docId;
                this.currentDocName = data.docInfo.originalName;
                const docTitleEl = document.getElementById('currentDocName');
                if (docTitleEl) docTitleEl.textContent = this.currentDocName;

                if (window.PdfViewer) await window.PdfViewer.loadDocument(data.docId, `/api/document/${data.docId}/file`);
                if (window.PageManager) await window.PageManager.renderThumbnails(window.PdfViewer.pdfDoc);
                if (window.Inspector) window.Inspector.loadInspection(data.docId);

                this.showToast(`PDF carregado com sucesso!`, 'success');
            }
        } catch (err) {
            this.showToast(`Erro no upload: ${err.message}`, 'error');
        }
    }

    async reconstructWithAi() {
        if (!this.currentDocId) {
            this.showToast('Abra ou carregue um PDF antes de remontar com IA.', 'error');
            return;
        }

        this.showToast('Enviando para o Gemini Flash analisar e reconstruir fielmente...', 'info');

        try {
            const resp = await fetch(`/api/document/${this.currentDocId}/reconstruct-ai`, {
                method: 'POST'
            });
            const data = await resp.json();
            if (data.success) {
                this.currentDocId = data.docId;
                this.currentDocName = data.docInfo.originalName;
                const docTitleEl = document.getElementById('currentDocName');
                if (docTitleEl) docTitleEl.textContent = this.currentDocName;

                if (window.PdfViewer) await window.PdfViewer.loadDocument(data.docId, `/api/document/${data.docId}/file`);
                if (window.PageManager) await window.PageManager.renderThumbnails(window.PdfViewer.pdfDoc);
                if (window.Inspector) window.Inspector.loadInspection(data.docId);

                this.showToast('Documento reconstruído com sucesso pelo Gemini!', 'success');
            } else {
                this.showToast(data.error || 'Erro ao reconstruir documento com IA.', 'error');
            }
        } catch (err) {
            this.showToast(`Erro na requisição: ${err.message}`, 'error');
        }
    }

    async reloadCurrentDocument() {
        if (!this.currentDocId) return;
        if (window.PdfViewer) await window.PdfViewer.loadDocument(this.currentDocId, `/api/document/${this.currentDocId}/file?t=${Date.now()}`);
        if (window.PageManager && window.PdfViewer?.pdfDoc) await window.PageManager.renderThumbnails(window.PdfViewer.pdfDoc);
        if (window.Inspector) window.Inspector.loadInspection(this.currentDocId);
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        }, 3500);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.App = new App();
});
