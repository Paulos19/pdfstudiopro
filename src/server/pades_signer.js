const forge = require('node-forge');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, degrees } = require('pdf-lib');

class PadesSigner {
    /**
     * Generates a realistic ICP-Brasil A1 Demo / Test certificate
     */
    static generateDemoCertificate(signerName = 'JOÃO DA SILVA:12345678900', email = 'joao.silva@exemplo.com.br') {
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();
        
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01' + crypto.randomBytes(8).toString('hex');
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

        const attrs = [
            { name: 'commonName', value: signerName },
            { name: 'countryName', value: 'BR' },
            { shortName: 'ST', value: 'Distrito Federal' },
            { name: 'localityName', value: 'Brasilia' },
            { name: 'organizationName', value: 'ICP-Brasil' },
            { shortName: 'OU', value: 'Autoridade Certificadora Raiz Brasileira v5' },
            { shortName: 'OU', value: 'AC SERPRO RFB v5' },
            { shortName: 'OU', value: 'Certificado Digital PF A1' }
        ];

        cert.setSubject(attrs);
        cert.setIssuer(attrs);

        cert.setExtensions([
            { name: 'basicConstraints', cA: false },
            { name: 'keyUsage', keyCertSign: false, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
            { name: 'extKeyUsage', serverAuth: false, clientAuth: true, codeSigning: false, emailProtection: true, timeStamping: true },
            { name: 'nsCertType', client: true, email: true },
            { name: 'subjectAltName', altNames: [{ type: 1, value: email }] }
        ]);

        cert.sign(keys.privateKey, forge.md.sha256.create());

        return {
            certificate: cert,
            privateKey: keys.privateKey,
            publicKey: keys.publicKey,
            serialNumber: cert.serialNumber,
            issuer: 'AC SERPRO RFB v5 (ICP-Brasil)',
            subject: signerName,
            validFrom: cert.validity.notBefore,
            validTo: cert.validity.notAfter
        };
    }

    /**
     * Parse uploaded .pfx / .p12 certificate
     */
    static parseP12(p12Buffer, password = '') {
        const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

        let keyBag = null;
        let certBag = null;

        for (const safeContents of p12.safeContents) {
            for (const safeBag of safeContents.safeBags) {
                if (safeBag.key) {
                    keyBag = safeBag.key;
                }
                if (safeBag.cert) {
                    certBag = safeBag.cert;
                }
            }
        }

        if (!keyBag || !certBag) {
            throw new Error('Não foi possível extrair a Chave Privada e o Certificado do arquivo .p12/.pfx.');
        }

        const commonName = certBag.subject.getField('CN')?.value || 'Signatário';
        const issuerName = certBag.issuer.getField('CN')?.value || certBag.issuer.getField('O')?.value || 'Autoridade Certificadora';

        return {
            certificate: certBag,
            privateKey: keyBag,
            publicKey: certBag.publicKey,
            serialNumber: certBag.serialNumber,
            issuer: issuerName,
            subject: commonName,
            validFrom: certBag.validity.notBefore,
            validTo: certBag.validity.notAfter
        };
    }

    /**
     * Creates visual signature stamp on the PDF
     */
    static async addVisualStamp(pdfDoc, options = {}) {
        const {
            pageIndex = 0,
            x = 50,
            y = 50,
            width = 250,
            height = 70,
            signerName = 'Assinante',
            cpfCnpj = '',
            reason = 'Concordância com o teor do documento',
            location = 'Brasil',
            issuer = 'ICP-Brasil A1',
            serialNumber = '12345678'
        } = options;

        const pages = pdfDoc.getPages();
        const targetPageIndex = Math.min(Math.max(0, pageIndex), pages.length - 1);
        const page = pages[targetPageIndex];
        const pageHeight = page.getHeight();
        const pdfY = pageHeight - y - height;

        // Visual Stamp Box (Green / Blue ICP-Brasil Theme)
        page.drawRectangle({
            x: x,
            y: pdfY,
            width: width,
            height: height,
            borderColor: rgb(0.08, 0.55, 0.35),
            borderWidth: 1.5,
            color: rgb(0.96, 0.99, 0.97),
            opacity: 0.95
        });

        // Left vertical ICP-Brasil green bar
        page.drawRectangle({
            x: x,
            y: pdfY,
            width: 6,
            height: height,
            color: rgb(0.08, 0.62, 0.38)
        });

        const font = await pdfDoc.embedFont('Helvetica');
        const fontBold = await pdfDoc.embedFont('Helvetica-Bold');

        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR') + ' UTC-3';

        // Title Header
        page.drawText('ASSINADO DIGITALMENTE', {
            x: x + 14,
            y: pdfY + height - 14,
            size: 9,
            font: fontBold,
            color: rgb(0.06, 0.48, 0.30)
        });

        page.drawText('ICP-Brasil A1 / PAdES', {
            x: x + width - 95,
            y: pdfY + height - 14,
            size: 7.5,
            font: fontBold,
            color: rgb(0.15, 0.4, 0.7)
        });

        // Signer name
        page.drawText(`Assinante: ${signerName.substring(0, 32)}`, {
            x: x + 14,
            y: pdfY + height - 26,
            size: 8,
            font: fontBold,
            color: rgb(0.12, 0.15, 0.18)
        });

        // Date and Reason
        page.drawText(`Data/Hora: ${dateStr}`, {
            x: x + 14,
            y: pdfY + height - 37,
            size: 7,
            font: font,
            color: rgb(0.25, 0.3, 0.35)
        });

        page.drawText(`Motivo: ${reason.substring(0, 38)}`, {
            x: x + 14,
            y: pdfY + height - 47,
            size: 7,
            font: font,
            color: rgb(0.25, 0.3, 0.35)
        });

        // Hash / Serial
        const shortSerial = (serialNumber || 'A1-ICP').substring(0, 16);
        page.drawText(`Emissor: ${issuer.substring(0, 24)} | Serial: ${shortSerial}`, {
            x: x + 14,
            y: pdfY + 6,
            size: 6.2,
            font: font,
            color: rgb(0.4, 0.45, 0.5)
        });
    }

    /**
     * Signs PDF with cryptographic PAdES PKCS#7 envelope and /ByteRange
     */
    static async signPdf(pdfBytes, signerData, options = {}) {
        const {
            visualStamp = true,
            pageIndex = 0,
            x = 50,
            y = 50,
            width = 250,
            height = 70,
            reason = 'Assinatura Digital com Validade Jurídica (ICP-Brasil)',
            location = 'Brasil'
        } = options;

        // 1. Prepare visual layer if requested
        let baseDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        if (visualStamp) {
            await this.addVisualStamp(baseDoc, {
                pageIndex,
                x,
                y,
                width,
                height,
                signerName: signerData.subject,
                reason,
                location,
                issuer: signerData.issuer,
                serialNumber: signerData.serialNumber
            });
        }

        const modifiedBytes = Buffer.from(await baseDoc.save({ useObjectStreams: false }));

        // 2. Prepare Signature Placeholder
        const SIGNATURE_SIZE = 8192; // 8KB placeholder for DER PKCS#7
        const placeholderHex = '0'.repeat(SIGNATURE_SIZE * 2);

        const sigDict = `
<<
/Type /Sig
/Filter /Adobe.PPKLite
/SubFilter /adbe.pkcs7.detached
/Name (${signerData.subject.replace(/[()]/g, '')})
/Reason (${reason.replace(/[()]/g, '')})
/Location (${location.replace(/[()]/g, '')})
/M (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}+00'00')
/ByteRange [0 0000000000 0000000000 0000000000]
/Contents <${placeholderHex}>
>>`;

        const sigObjNum = 999999;
        const sigObjStr = `\n${sigObjNum} 0 obj\n${sigDict}\nendobj\n`;
        const pdfWithSigObj = Buffer.concat([modifiedBytes, Buffer.from(sigObjStr, 'utf8')]);

        // Find positions of ByteRange and Contents
        const pdfStr = pdfWithSigObj.toString('binary');
        const contentsPos = pdfStr.lastIndexOf('/Contents <');
        const contentsHexStart = contentsPos + '/Contents <'.length;
        const contentsHexEnd = contentsHexStart + placeholderHex.length;

        const byteRangePos = pdfStr.lastIndexOf('/ByteRange [');
        const byteRangeEnd = pdfStr.indexOf(']', byteRangePos) + 1;

        // Calculate actual ByteRange offsets
        // [offset1, length1, offset2, length2]
        const range1Start = 0;
        const range1Length = contentsHexStart - 1; // includes '<'
        const range2Start = contentsHexEnd + 1;
        const range2Length = pdfWithSigObj.length - range2Start;

        const byteRangeStr = `/ByteRange [${range1Start} ${range1Length} ${range2Start} ${range2Length}]`;
        const paddedByteRangeStr = byteRangeStr.padEnd(byteRangeEnd - byteRangePos, ' ');

        // Write ByteRange into buffer
        pdfWithSigObj.write(paddedByteRangeStr, byteRangePos, 'utf8');

        // Extract bytes for SHA-256 Digest (Range 1 + Range 2)
        const range1Bytes = pdfWithSigObj.slice(range1Start, range1Start + range1Length);
        const range2Bytes = pdfWithSigObj.slice(range2Start, range2Start + range2Length);
        const signedDataBuffer = Buffer.concat([range1Bytes, range2Bytes]);

        // Compute SHA-256 Digest of the PDF bytes
        const sha256Hash = crypto.createHash('sha256').update(signedDataBuffer).digest();

        // 3. Generate PKCS#7 Detached Signature
        const p7 = forge.pkcs7.createSignedData();
        p7.content = forge.util.createBuffer(sha256Hash.toString('binary'));
        p7.addCertificate(signerData.certificate);
        
        p7.addSigner({
            key: signerData.privateKey,
            certificate: signerData.certificate,
            digestAlgorithm: forge.pki.oids.sha256,
            authenticatedAttributes: [
                {
                    type: forge.pki.oids.contentType,
                    value: forge.pki.oids.data
                },
                {
                    type: forge.pki.oids.messageDigest,
                    value: forge.util.createBuffer(sha256Hash.toString('binary'))
                },
                {
                    type: forge.pki.oids.signingTime,
                    value: new Date()
                }
            ]
        });

        p7.sign({ detached: true });

        const p7Asn1 = p7.toAsn1();
        const p7Der = forge.asn1.toDer(p7Asn1).getBytes();
        const p7Hex = Buffer.from(p7Der, 'binary').toString('hex');

        if (p7Hex.length > placeholderHex.length) {
            throw new Error(`Envelope PKCS#7 (${p7Hex.length} chars) excedeu o tamanho do buffer alocado (${placeholderHex.length} chars).`);
        }

        const paddedP7Hex = p7Hex.padEnd(placeholderHex.length, '0');

        // Write Hex signature into Contents
        pdfWithSigObj.write(paddedP7Hex, contentsHexStart, 'utf8');

        return {
            signedPdfBuffer: pdfWithSigObj,
            digestSha256: sha256Hash.toString('hex'),
            signatureHexLength: p7Hex.length,
            serialNumber: signerData.serialNumber,
            issuer: signerData.issuer,
            subject: signerData.subject,
            validFrom: signerData.validFrom,
            validTo: signerData.validTo
        };
    }
}

module.exports = PadesSigner;
