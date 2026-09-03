const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function getBinaryPath() {
    const isWin = process.platform === 'win32';
    const binName = isWin ? 'pdf_engine.exe' : 'pdf_engine';
    const altBinName = isWin ? 'pdf_engine' : 'pdf_engine.exe';

    const paths = [
        path.join(__dirname, '..', '..', 'bin', binName),
        path.join(process.resourcesPath || '', 'bin', binName),
        path.join(process.cwd(), 'bin', binName),
        path.join(__dirname, '..', '..', 'bin', altBinName),
        path.join(process.cwd(), 'bin', altBinName)
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return paths[0];
}

class CppEngineBridge {
    static isAvailable() {
        return fs.existsSync(getBinaryPath());
    }

    static runCommand(args) {
        return new Promise((resolve, reject) => {
            const binPath = getBinaryPath();
            if (!fs.existsSync(binPath)) {
                return reject(new Error(`Native engine binary not found at ${binPath}. Please run build_native.bat first.`));
            }

            const proc = spawn(binPath, args);
            let stdoutData = '';
            let stderrData = '';

            proc.stdout.on('data', (chunk) => {
                stdoutData += chunk.toString();
            });

            proc.stderr.on('data', (chunk) => {
                stderrData += chunk.toString();
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    try {
                        const parsed = JSON.parse(stdoutData);
                        return reject(new Error(parsed.error || `Process exited with code ${code}`));
                    } catch (e) {
                        return reject(new Error(stderrData || stdoutData || `Process exited with code ${code}`));
                    }
                }

                try {
                    const parsed = JSON.parse(stdoutData);
                    resolve(parsed);
                } catch (e) {
                    resolve({ raw: stdoutData });
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });
        });
    }

    static async inspectPdf(pdfPath) {
        return this.runCommand(['--inspect', pdfPath]);
    }

    static async createSample(type, outputPath) {
        return this.runCommand(['--create-sample', type, outputPath]);
    }

    static async editText(inputPath, outputPath, pageIndex, oldText, newText) {
        return this.runCommand(['--edit-text', inputPath, outputPath, String(pageIndex), oldText, newText]);
    }

    static async redact(inputPath, outputPath, pageIndex, x, y, width, height, overlayText = '[REDACTED]') {
        return this.runCommand(['--redact', inputPath, outputPath, String(pageIndex), String(x), String(y), String(width), String(height), overlayText]);
    }

    static async annotate(inputPath, outputPath, pageIndex, type, x, y, width, height, text = '') {
        return this.runCommand(['--annotate', inputPath, outputPath, String(pageIndex), type, String(x), String(y), String(width), String(height), text]);
    }

    static async rotatePage(inputPath, outputPath, pageIndex, angleDelta) {
        return this.runCommand(['--rotate-page', inputPath, outputPath, String(pageIndex), String(angleDelta)]);
    }
}

module.exports = CppEngineBridge;
