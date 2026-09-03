/* ==========================================================================
   Real-Time WebSocket Client - PDF Studio Pro
   ========================================================================== */

class WsClient {
    constructor() {
        this.socket = null;
        this.reconnectTimer = null;
        this.listeners = new Map();
        this.isConnected = false;

        this.initElements();
        this.connect();
    }

    initElements() {
        this.liveBadge = document.getElementById('wsLiveBadge');
        this.progressBar = document.getElementById('aiLiveProgressBar');
        this.progressTitle = document.getElementById('aiProgressTitle');
        this.progressPercent = document.getElementById('aiProgressPercent');
        this.progressFill = document.getElementById('aiProgressFill');
        this.progressStatusMsg = document.getElementById('aiProgressStatusMsg');
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        try {
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                this.isConnected = true;
                this.updateStatus(true);
                if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.warn('Malformed WS message:', event.data);
                }
            };

            this.socket.onclose = () => {
                this.isConnected = false;
                this.updateStatus(false);
                this.scheduleReconnect();
            };

            this.socket.onerror = (err) => {
                this.isConnected = false;
                this.updateStatus(false);
            };
        } catch (err) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, 3000);
    }

    updateStatus(online) {
        if (this.liveBadge) {
            if (online) {
                this.liveBadge.className = 'ws-live-badge online';
                this.liveBadge.innerHTML = '<span class="status-dot"></span><span>WebSocket IA: Ao Vivo</span>';
            } else {
                this.liveBadge.className = 'ws-live-badge offline';
                this.liveBadge.innerHTML = '<span class="status-dot offline"></span><span>WebSocket: Reconectando...</span>';
            }
        }
    }

    handleMessage(data) {
        // Handle progress broadcasts
        if (data.type === 'ats_optimize' || data.type === 'ats_extract' || data.type === 'pdf_compile' || data.type === 'ai_reconstruct') {
            this.showProgress(data);
        }

        // Fire custom callbacks
        if (this.listeners.has(data.type)) {
            this.listeners.get(data.type).forEach(cb => cb(data));
        }
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(cb => cb(data));
        }
    }

    showProgress(data) {
        if (!this.progressBar) return;

        const percent = Math.min(100, Math.max(0, data.percent || 0));
        const message = data.message || 'Processando com IA...';

        const titles = {
            'ats_optimize': 'Otimização ATS & Matching de Vagas (Gemini)',
            'ats_extract': 'Extração de Currículo com IA',
            'pdf_compile': 'Compilação de PDF no Padrão ATS',
            'ai_reconstruct': 'Remasterização Completa de Documento'
        };

        if (this.progressTitle) {
            this.progressTitle.textContent = titles[data.type] || 'Processamento em Tempo Real';
        }
        if (this.progressPercent) {
            this.progressPercent.textContent = `${percent}%`;
        }
        if (this.progressFill) {
            this.progressFill.style.width = `${percent}%`;
        }
        if (this.progressStatusMsg) {
            this.progressStatusMsg.textContent = message;
        }

        this.progressBar.style.display = 'block';
        this.progressBar.classList.add('visible');

        if (percent >= 100 || data.step === 'done' || data.step === 'error') {
            setTimeout(() => {
                this.progressBar.classList.remove('visible');
                setTimeout(() => {
                    this.progressBar.style.display = 'none';
                    if (this.progressFill) this.progressFill.style.width = '0%';
                }, 400);
            }, 2500);
        }
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(callback);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.WsClient = new WsClient();
});
