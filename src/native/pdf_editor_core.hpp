#pragma once
#include "pdf_parser.hpp"
#include "pdf_writer.hpp"
#include "pdf_content.hpp"
#include <string>
#include <vector>
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

    static bool applyRedactions(Parser& parser, const std::vector<RedactionBox>& redactions, const std::string& outputPath) {
        for (const auto& red : redactions) {
            if (red.pageIndex < 0 || red.pageIndex >= (int)parser.pages.size()) continue;
            int pageObjNum = parser.pages[red.pageIndex].objNum;
            if (!parser.objects.count(pageObjNum)) continue;

            auto pageObj = parser.objects[pageObjNum].object;
            auto contentsObj = parser.resolveObject(pageObj->dictValue["Contents"]);
            if (!contentsObj) continue;

            double pageHeight = parser.pages[red.pageIndex].height;
            double pdfY = pageHeight - red.y - red.height; // convert top-left to PDF bottom-left

            std::vector<uint8_t> uncompressed = parser.getPageContentStream(red.pageIndex);
            std::string contentStr(uncompressed.begin(), uncompressed.end());

            // Append solid redaction box stream commands
            std::ostringstream redactionCmd;
            redactionCmd << "\n% --- PERMANENT REDACTION APPLIED BY PDF-STUDIO ENGINE ---\n";
            redactionCmd << "q\n";
            redactionCmd << red.r << " " << red.g << " " << red.b << " rg\n"; // Fill color
            redactionCmd << red.r << " " << red.g << " " << red.b << " RG\n"; // Stroke color
            redactionCmd << red.x << " " << pdfY << " " << red.width << " " << red.height << " re f\n";

            if (!red.overlayText.empty()) {
                redactionCmd << "BT\n";
                redactionCmd << "/Helvetica-Bold 10 Tf\n";
                redactionCmd << "1 1 1 rg\n"; // White text
                redactionCmd << (red.x + 5) << " " << (pdfY + red.height / 2 - 4) << " Td\n";
                redactionCmd << "(" << red.overlayText << ") Tj\n";
                redactionCmd << "ET\n";
            }
            redactionCmd << "Q\n";

            contentStr += redactionCmd.str();
            contentsObj->streamData.assign(contentStr.begin(), contentStr.end());
            contentsObj->dictValue["Filter"] = Object::createName("FlateDecode");
        }

        return Writer::writePdf(outputPath, parser.objects, parser.catalog);
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
};

} // namespace pdf
