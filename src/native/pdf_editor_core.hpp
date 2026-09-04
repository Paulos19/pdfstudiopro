#pragma once
#include "pdf_parser.hpp"
#include "pdf_writer.hpp"
#include "pdf_content.hpp"
#include <string>
#include <vector>
#include <set>
#include <iostream>
#include <sstream>
#include <algorithm>

namespace pdf {

struct TextEditOp {
    int pageIndex = 0;
    std::string originalText;
    std::string newText;
    std::string fontName = "Helvetica";
    double fontSize = 12.0;
    double colorR = 0, colorG = 0, colorB = 0;
};

struct AnnotationOp {
    int pageIndex = 0;
    std::string type; // "highlight", "draw", "rect", "note", "signature", "stamp"
    double x = 0, y = 0, width = 0, height = 0;
    double colorR = 1, colorG = 0.8, colorB = 0;
    double opacity = 0.5;
    std::string textContent;
    std::vector<std::pair<double, double>> pathPoints; // for draw
};

struct RedactionResult {
    bool success = false;
    int purgedChars = 0;
    int purgedBlocks = 0;
    bool metadataScrubbed = false;
};

struct OptimizationResult {
    bool success = false;
    size_t originalBytes = 0;
    size_t optimizedBytes = 0;
    int removedObjects = 0;
    int recompressedStreams = 0;
    double reductionPercent = 0.0;
    std::string profile = "balanced";
};

class EditorCore {
public:
    static bool applyTextEdits(Parser& parser, const std::vector<TextEditOp>& edits, const std::string& outputPath) {
        for (const auto& edit : edits) {
            if (edit.pageIndex < 0 || edit.pageIndex >= (int)parser.pages.size()) continue;
            int pageObjNum = parser.pages[edit.pageIndex].objNum;
            if (!parser.objects.count(pageObjNum)) continue;

            auto pageObj = parser.objects[pageObjNum].object;
            if (!pageObj || !pageObj->dictValue.count("Contents")) continue;

            auto contentsObj = parser.resolveObject(pageObj->dictValue["Contents"]);
            if (!contentsObj) continue;

            std::vector<uint8_t> uncompressed = parser.getPageContentStream(edit.pageIndex);
            std::string contentStr(uncompressed.begin(), uncompressed.end());

            // Search for literal (originalText) or replace
            std::string target1 = "(" + edit.originalText + ")";
            std::string rep1 = "(" + edit.newText + ")";

            size_t pos = 0;
            bool replaced = false;
            while ((pos = contentStr.find(target1, pos)) != std::string::npos) {
                contentStr.replace(pos, target1.length(), rep1);
                pos += rep1.length();
                replaced = true;
            }

            if (!replaced) {
                // Try without parentheses if target was partial
                pos = 0;
                while ((pos = contentStr.find(edit.originalText, pos)) != std::string::npos) {
                    contentStr.replace(pos, edit.originalText.length(), edit.newText);
                    pos += edit.newText.length();
                }
            }

            // Update stream content
            contentsObj->streamData.assign(contentStr.begin(), contentStr.end());
            // Filter set to FlateDecode
            contentsObj->dictValue["Filter"] = Object::createName("FlateDecode");
        }

        return Writer::writePdf(outputPath, parser.objects, parser.catalog);
    }

    static RedactionResult applyRedactions(
        Parser& parser,
        const std::vector<RedactionBox>& redactions,
        const std::string& outputPath,
        const std::vector<std::string>& keywords = {}
    ) {
        RedactionResult res;

        // Group redactions by page
        std::map<int, std::vector<RedactionBox>> redsByPage;
        for (const auto& red : redactions) {
            redsByPage[red.pageIndex].push_back(red);
        }

        for (const auto& pair : redsByPage) {
            int pageIndex = pair.first;
            const auto& pageReds = pair.second;

            if (pageIndex < 0 || pageIndex >= (int)parser.pages.size()) continue;
            int pageObjNum = parser.pages[pageIndex].objNum;
            if (!parser.objects.count(pageObjNum)) continue;

            auto pageObj = parser.objects[pageObjNum].object;
            if (!pageObj || !pageObj->dictValue.count("Contents")) continue;

            auto contentsObj = parser.resolveObject(pageObj->dictValue["Contents"]);
            if (!contentsObj) continue;

            double pageHeight = parser.pages[pageIndex].height;

            // 1. Get raw decompressed content stream
            std::vector<uint8_t> uncompressed = parser.getPageContentStream(pageIndex);

            // 2. Perform True Physical Stream Sanitization (C++ Token/Glyph purge)
            SanitizeResult sRes = ContentStreamSanitizer::sanitizeStream(uncompressed, pageReds, pageHeight, keywords);
            res.purgedBlocks += sRes.purgedBlocks;
            res.purgedChars += sRes.purgedChars;

            std::string sanitizedContentStr = sRes.sanitizedStream;

            // 3. Append solid opaque visual redaction boxes and labels
            std::ostringstream visualCmd;
            visualCmd << "\n% --- PERMANENT VISUAL REDACTION MASK (STREAM PURGED) ---\n";
            for (const auto& red : pageReds) {
                double pdfY = pageHeight - red.y - red.height; // convert top-left to PDF bottom-left
                visualCmd << "q\n";
                visualCmd << red.r << " " << red.g << " " << red.b << " rg\n"; // Fill color
                visualCmd << red.r << " " << red.g << " " << red.b << " RG\n"; // Stroke color
                visualCmd << red.x << " " << pdfY << " " << red.width << " " << red.height << " re f\n";

                if (!red.overlayText.empty()) {
                    visualCmd << "BT\n";
                    visualCmd << "/Helvetica-Bold 9 Tf\n";
                    visualCmd << "1 1 1 rg\n"; // White text
                    visualCmd << (red.x + 4) << " " << (pdfY + red.height / 2 - 3) << " Td\n";
                    visualCmd << "(" << escapePdfString(red.overlayText) << ") Tj\n";
                    visualCmd << "ET\n";
                }
                visualCmd << "Q\n";
            }

            sanitizedContentStr += visualCmd.str();

            // 4. Update stream object
            contentsObj->streamData.assign(sanitizedContentStr.begin(), sanitizedContentStr.end());
            contentsObj->dictValue["Filter"] = Object::createName("FlateDecode");
        }

        // 5. Scrub global XMP Metadata
        if (parser.catalog && parser.catalog->dictValue.count("Metadata")) {
            parser.catalog->dictValue.erase("Metadata");
            res.metadataScrubbed = true;
        }

        // 6. Scrub Info dictionary
        for (auto& p : parser.objects) {
            auto obj = p.second.object;
            if (obj && obj->type == ObjectType::Dictionary) {
                if (obj->dictValue.count("Title") || obj->dictValue.count("Author") || obj->dictValue.count("Subject")) {
                    for (const auto& kw : keywords) {
                        if (!kw.empty()) {
                            for (const auto& field : {"Title", "Author", "Subject", "Keywords"}) {
                                if (obj->dictValue.count(field)) {
                                    auto strObj = obj->dictValue[field];
                                    if (strObj && strObj->strValue.find(kw) != std::string::npos) {
                                        strObj->strValue = "[REDIGIDO]";
                                        res.metadataScrubbed = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        res.success = Writer::writePdf(outputPath, parser.objects, parser.catalog);
        return res;
    }

    static bool applyAnnotations(Parser& parser, const std::vector<AnnotationOp>& annots, const std::string& outputPath) {
        for (const auto& ann : annots) {
            if (ann.pageIndex < 0 || ann.pageIndex >= (int)parser.pages.size()) continue;
            int pageObjNum = parser.pages[ann.pageIndex].objNum;
            if (!parser.objects.count(pageObjNum)) continue;

            auto pageObj = parser.objects[pageObjNum].object;
            auto contentsObj = parser.resolveObject(pageObj->dictValue["Contents"]);
            if (!contentsObj) continue;

            double pageHeight = parser.pages[ann.pageIndex].height;
            double pdfY = pageHeight - ann.y - ann.height;

            std::vector<uint8_t> uncompressed = parser.getPageContentStream(ann.pageIndex);
            std::string contentStr(uncompressed.begin(), uncompressed.end());

            std::ostringstream cmd;
            cmd << "\n% --- ANNOTATION: " << ann.type << " ---\n";
            cmd << "q\n";

            if (ann.type == "highlight") {
                cmd << ann.colorR << " " << ann.colorG << " " << ann.colorB << " rg\n";
                cmd << ann.x << " " << pdfY << " " << ann.width << " " << ann.height << " re f\n";
            } else if (ann.type == "rect") {
                cmd << ann.colorR << " " << ann.colorG << " " << ann.colorB << " RG\n";
                cmd << "2 w\n";
                cmd << ann.x << " " << pdfY << " " << ann.width << " " << ann.height << " re S\n";
            } else if (ann.type == "draw" && !ann.pathPoints.empty()) {
                cmd << ann.colorR << " " << ann.colorG << " " << ann.colorB << " RG\n";
                cmd << "2.5 w 1 J 1 j\n";
                double startY = pageHeight - ann.pathPoints[0].second;
                cmd << ann.pathPoints[0].first << " " << startY << " m\n";
                for (size_t p = 1; p < ann.pathPoints.size(); ++p) {
                    double ptY = pageHeight - ann.pathPoints[p].second;
                    cmd << ann.pathPoints[p].first << " " << ptY << " l\n";
                }
                cmd << "S\n";
            } else if (ann.type == "signature" || ann.type == "stamp") {
                // Official digital seal block
                cmd << "0.1 0.3 0.8 RG 0.95 0.97 1.0 rg\n";
                cmd << "1.5 w\n";
                cmd << ann.x << " " << pdfY << " " << ann.width << " " << ann.height << " re B\n";
                cmd << "BT\n";
                cmd << "/Helvetica-Bold 10 Tf\n";
                cmd << "0.1 0.25 0.7 rg\n";
                cmd << (ann.x + 8) << " " << (pdfY + ann.height - 16) << " Td\n";
                cmd << "(DIGITALLY SIGNED / APPROVED) Tj\n";
                cmd << "ET\n";
                if (!ann.textContent.empty()) {
                    cmd << "BT\n";
                    cmd << "/Helvetica 8 Tf\n";
                    cmd << "0.2 0.2 0.2 rg\n";
                    cmd << (ann.x + 8) << " " << (pdfY + 12) << " Td\n";
                    cmd << "(" << ann.textContent << ") Tj\n";
                    cmd << "ET\n";
                }
            } else if (ann.type == "text" && !ann.textContent.empty()) {
                cmd << "BT\n";
                cmd << "/Helvetica 12 Tf\n";
                cmd << ann.colorR << " " << ann.colorG << " " << ann.colorB << " rg\n";
                cmd << ann.x << " " << pdfY << " Td\n";
                cmd << "(" << ann.textContent << ") Tj\n";
                cmd << "ET\n";
            }

            cmd << "Q\n";
            contentStr += cmd.str();
            contentsObj->streamData.assign(contentStr.begin(), contentStr.end());
            contentsObj->dictValue["Filter"] = Object::createName("FlateDecode");
        }

        return Writer::writePdf(outputPath, parser.objects, parser.catalog);
    }

    static bool rotatePage(Parser& parser, int pageIndex, int angleDelta, const std::string& outputPath) {
        if (pageIndex < 0 || pageIndex >= (int)parser.pages.size()) return false;
        int pageObjNum = parser.pages[pageIndex].objNum;
        if (!parser.objects.count(pageObjNum)) return false;

        auto pageObj = parser.objects[pageObjNum].object;
        int currentRot = parser.pages[pageIndex].rotation;
        int newRot = (currentRot + angleDelta + 360) % 360;

        pageObj->dictValue["Rotate"] = Object::createNumber((double)newRot);
        parser.pages[pageIndex].rotation = newRot;

        return Writer::writePdf(outputPath, parser.objects, parser.catalog);
    }

    static void markReachable(ObjectPtr obj, std::set<int>& visited, Parser& parser) {
        if (!obj) return;
        if (obj->type == ObjectType::Reference) {
            int num = obj->refValue.objNum;
            if (num > 0 && !visited.count(num)) {
                visited.insert(num);
                if (parser.objects.count(num)) {
                    markReachable(parser.objects[num].object, visited, parser);
                }
            }
            return;
        }
        if (obj->type == ObjectType::Dictionary || obj->type == ObjectType::Stream) {
            for (const auto& pair : obj->dictValue) {
                markReachable(pair.second, visited, parser);
            }
            return;
        }
        if (obj->type == ObjectType::Array) {
            for (const auto& item : obj->arrayValue) {
                markReachable(item, visited, parser);
            }
            return;
        }
    }

    static OptimizationResult optimizePdf(
        Parser& parser,
        const std::string& outputPath,
        const std::string& profile = "balanced"
    ) {
        OptimizationResult res;
        res.profile = profile;

        size_t origSize = parser.buffer.size();
        res.originalBytes = origSize;

        // 1. Profile-based pre-cleaning (Extreme / Balanced metadata stripping)
        if (profile == "extreme") {
            if (parser.catalog) {
                if (parser.catalog->dictValue.count("Metadata")) parser.catalog->dictValue.erase("Metadata");
                if (parser.catalog->dictValue.count("PieceInfo")) parser.catalog->dictValue.erase("PieceInfo");
                if (parser.catalog->dictValue.count("StructTreeRoot")) parser.catalog->dictValue.erase("StructTreeRoot");
                if (parser.catalog->dictValue.count("OCProperties")) parser.catalog->dictValue.erase("OCProperties");
            }
            for (auto& page : parser.pages) {
                if (parser.objects.count(page.objNum)) {
                    auto pObj = parser.objects[page.objNum].object;
                    if (pObj) {
                        if (pObj->dictValue.count("Metadata")) pObj->dictValue.erase("Metadata");
                        if (pObj->dictValue.count("PieceInfo")) pObj->dictValue.erase("PieceInfo");
                        if (pObj->dictValue.count("Thumb")) pObj->dictValue.erase("Thumb");
                    }
                }
            }
        } else if (profile == "balanced") {
            if (parser.catalog) {
                if (parser.catalog->dictValue.count("PieceInfo")) parser.catalog->dictValue.erase("PieceInfo");
            }
            for (auto& page : parser.pages) {
                if (parser.objects.count(page.objNum)) {
                    auto pObj = parser.objects[page.objNum].object;
                    if (pObj) {
                        if (pObj->dictValue.count("PieceInfo")) pObj->dictValue.erase("PieceInfo");
                        if (pObj->dictValue.count("Thumb")) pObj->dictValue.erase("Thumb");
                    }
                }
            }
        }

        // 2. Mark & Sweep Garbage Collection for Cos Objects
        std::set<int> reachable;
        
        // Find catalog object number
        int catalogObjNum = 0;
        for (const auto& pair : parser.objects) {
            if (pair.second.object == parser.catalog) {
                catalogObjNum = pair.first;
                break;
            }
        }
        if (catalogObjNum > 0) {
            reachable.insert(catalogObjNum);
        }
        if (parser.catalog) {
            markReachable(parser.catalog, reachable, parser);
        }

        // Ensure all registered pages and trailer are marked
        if (parser.trailer) {
            markReachable(parser.trailer, reachable, parser);
        }
        for (const auto& p : parser.pages) {
            if (p.objNum > 0) {
                reachable.insert(p.objNum);
                if (parser.objects.count(p.objNum)) {
                    markReachable(parser.objects[p.objNum].object, reachable, parser);
                }
            }
        }

        // Purge unreachable / orphaned objects
        int removedCount = 0;
        for (auto it = parser.objects.begin(); it != parser.objects.end(); ) {
            if (!reachable.count(it->first)) {
                it = parser.objects.erase(it);
                removedCount++;
            } else {
                ++it;
            }
        }
        res.removedObjects = removedCount;

        // 3. Stream Recompression & Normalization
        int recompressedCount = 0;
        for (auto& pair : parser.objects) {
            auto obj = pair.second.object;
            if (!obj || obj->type != ObjectType::Stream) continue;

            bool isFlate = false;
            if (obj->dictValue.count("Filter")) {
                auto filter = obj->dictValue["Filter"];
                if (filter->type == ObjectType::Name && 
                    (filter->strValue == "FlateDecode" || filter->strValue == "/FlateDecode")) {
                    isFlate = true;
                }
            }

            if (isFlate) {
                std::vector<uint8_t> uncompressed;
                if (Flate::decompress(obj->streamData, uncompressed)) {
                    std::vector<uint8_t> recompressed;
                    if (Flate::compress(uncompressed, recompressed)) {
                        if (recompressed.size() < obj->streamData.size()) {
                            obj->streamData = std::move(recompressed);
                            obj->dictValue["Length"] = Object::createNumber((double)obj->streamData.size());
                            recompressedCount++;
                        }
                    }
                }
            } else if (!obj->dictValue.count("Filter") && !obj->streamData.empty()) {
                // Compress uncompressed raw stream
                std::vector<uint8_t> compressed;
                if (Flate::compress(obj->streamData, compressed)) {
                    if (compressed.size() < obj->streamData.size()) {
                        obj->streamData = std::move(compressed);
                        obj->dictValue["Filter"] = Object::createName("FlateDecode");
                        obj->dictValue["Length"] = Object::createNumber((double)obj->streamData.size());
                        recompressedCount++;
                    }
                }
            }
        }
        res.recompressedStreams = recompressedCount;

        // 4. Write optimized output
        bool ok = Writer::writePdf(outputPath, parser.objects, parser.catalog);
        if (!ok) {
            res.success = false;
            return res;
        }

        std::ifstream check(outputPath, std::ios::binary | std::ios::ate);
        if (check.is_open()) {
            res.optimizedBytes = (size_t)check.tellg();
        } else {
            res.optimizedBytes = origSize;
        }

        res.success = true;
        if (res.originalBytes > 0 && res.originalBytes >= res.optimizedBytes) {
            res.reductionPercent = (1.0 - (double)res.optimizedBytes / (double)res.originalBytes) * 100.0;
        } else {
            res.reductionPercent = 0.0;
        }

        return res;
    }
};

} // namespace pdf
