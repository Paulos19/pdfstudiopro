#pragma once
#include "pdf_types.hpp"
#include "pdf_flate.hpp"
#include <vector>
#include <string>
#include <sstream>
#include <iomanip>
#include <fstream>
#include <map>

namespace pdf {

class Writer {
public:
    static std::string serializeObject(ObjectPtr obj) {
        if (!obj) return "null";
        switch (obj->type) {
            case ObjectType::Null: return "null";
            case ObjectType::Boolean: return obj->boolValue ? "true" : "false";
            case ObjectType::Number: {
                std::ostringstream ss;
                if (std::floor(obj->numValue) == obj->numValue) {
                    ss << (long long)obj->numValue;
                } else {
                    ss << std::fixed << std::setprecision(4) << obj->numValue;
                }
                return ss.str();
            }
            case ObjectType::String: {
                std::string s = "(";
                for (char c : obj->strValue) {
                    if (c == '(' || c == ')' || c == '\\') s += '\\';
                    s += c;
                }
                s += ")";
                return s;
            }
            case ObjectType::HexString: {
                std::ostringstream ss;
                ss << "<";
                for (unsigned char c : obj->strValue) {
                    ss << std::hex << std::setw(2) << std::setfill('0') << (int)c;
                }
                ss << ">";
                return ss.str();
            }
            case ObjectType::Name: {
                return "/" + obj->strValue;
            }
            case ObjectType::Array: {
                std::string s = "[ ";
                for (auto& item : obj->arrayValue) {
                    s += serializeObject(item) + " ";
                }
                s += "]";
                return s;
            }
            case ObjectType::Dictionary: {
                std::string s = "<<\n";
                for (auto& pair : obj->dictValue) {
                    s += "  /" + pair.first + " " + serializeObject(pair.second) + "\n";
                }
                s += ">>";
                return s;
            }
            case ObjectType::Reference: {
                return std::to_string(obj->refValue.objNum) + " " + std::to_string(obj->refValue.genNum) + " R";
            }
            case ObjectType::Stream: {
                // Return just dictionary part for stream formatting
                std::string s = "<<\n";
                for (auto& pair : obj->dictValue) {
                    s += "  /" + pair.first + " " + serializeObject(pair.second) + "\n";
                }
                s += ">>";
                return s;
            }
        }
        return "null";
    }

    static bool writePdf(const std::string& outputPath,
                        std::map<int, IndirectObject>& objects,
                        ObjectPtr rootCatalog,
                        ObjectPtr infoDict = nullptr) {
        std::ofstream out(outputPath, std::ios::binary);
        if (!out.is_open()) return false;

        std::string header = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
        out.write(header.c_str(), header.size());

        std::map<int, size_t> xrefOffsets;
        int maxObjNum = 0;

        for (auto& pair : objects) {
            int num = pair.first;
            if (num > maxObjNum) maxObjNum = num;
            auto& ind = pair.second;
            
            size_t offset = (size_t)out.tellp();
            xrefOffsets[num] = offset;

            std::string objHeader = std::to_string(num) + " " + std::to_string(ind.genNum) + " obj\n";
            out.write(objHeader.c_str(), objHeader.size());

            if (ind.object->type == ObjectType::Stream) {
                // Ensure Length and Filter are correct
                auto streamDict = ind.object;
                std::vector<uint8_t> compressed;
                bool isFlate = true;
                
                if (streamDict->dictValue.count("Filter") && 
                    (streamDict->dictValue["Filter"]->strValue == "FlateDecode" || 
                     streamDict->dictValue["Filter"]->strValue == "/FlateDecode")) {
                    Flate::compress(ind.object->streamData, compressed);
                } else {
                    compressed = ind.object->streamData;
                    isFlate = false;
                }

                streamDict->dictValue["Length"] = Object::createNumber((double)compressed.size());
                if (isFlate) streamDict->dictValue["Filter"] = Object::createName("FlateDecode");

                std::string dictStr = serializeObject(streamDict) + "\nstream\r\n";
                out.write(dictStr.c_str(), dictStr.size());
                out.write((char*)compressed.data(), compressed.size());
                std::string streamEnd = "\r\nendstream\n";
                out.write(streamEnd.c_str(), streamEnd.size());
            } else {
                std::string objBody = serializeObject(ind.object) + "\n";
                out.write(objBody.c_str(), objBody.size());
            }

            std::string objFooter = "endobj\n";
            out.write(objFooter.c_str(), objFooter.size());
        }

        // Write XRef table
        size_t xrefStart = (size_t)out.tellp();
        std::ostringstream xref;
        xref << "xref\n";
        xref << "0 " << (maxObjNum + 1) << "\n";
        xref << "0000000000 65535 f \n";

        for (int i = 1; i <= maxObjNum; ++i) {
            if (xrefOffsets.count(i)) {
                xref << std::setw(10) << std::setfill('0') << xrefOffsets[i] << " 00000 n \n";
            } else {
                xref << "0000000000 00000 f \n";
            }
        }

        // Trailer
        xref << "trailer\n<<\n";
        xref << "  /Size " << (maxObjNum + 1) << "\n";
        if (rootCatalog) {
            // Find root objNum
            int rootNum = 1;
            for (auto& pair : objects) {
                if (pair.second.object == rootCatalog) {
                    rootNum = pair.first;
                    break;
                }
            }
            xref << "  /Root " << rootNum << " 0 R\n";
        }
        if (infoDict) {
            for (auto& pair : objects) {
                if (pair.second.object == infoDict) {
                    xref << "  /Info " << pair.first << " 0 R\n";
                    break;
                }
            }
        }
        xref << ">>\n";
        xref << "startxref\n" << xrefStart << "\n%%EOF\n";

        std::string xrefStr = xref.str();
        out.write(xrefStr.c_str(), xrefStr.size());
        out.close();

        return true;
    }

    static bool writePdfMemory(std::map<int, IndirectObject>& objects,
                               ObjectPtr rootCatalog,
                               std::vector<uint8_t>& outBuffer,
                               ObjectPtr infoDict = nullptr) {
        std::ostringstream out;
        std::string header = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
        out.write(header.c_str(), header.size());

        std::map<int, size_t> xrefOffsets;
        int maxObjNum = 0;

        for (auto& pair : objects) {
            int num = pair.first;
            if (num > maxObjNum) maxObjNum = num;
            auto& ind = pair.second;
            
            size_t offset = (size_t)out.tellp();
            xrefOffsets[num] = offset;

            std::string objHeader = std::to_string(num) + " " + std::to_string(ind.genNum) + " obj\n";
            out.write(objHeader.c_str(), objHeader.size());

            if (ind.object && ind.object->type == ObjectType::Stream) {
                std::vector<uint8_t> compressed;
                bool isFlate = false;
                if (ind.object->dictValue.count("Filter")) {
                    auto f = ind.object->dictValue["Filter"];
                    if (f->type == ObjectType::Name && (f->strValue == "FlateDecode" || f->strValue == "/FlateDecode")) {
                        isFlate = true;
                    }
                }

                if (isFlate && !ind.object->streamData.empty()) {
                    Flate::compress(ind.object->streamData, compressed);
                } else {
                    compressed = ind.object->streamData;
                }

                ind.object->dictValue["Length"] = Object::createNumber((double)compressed.size());

                std::string dictStr = serializeObject(ind.object) + "\nstream\r\n";
                out.write(dictStr.c_str(), dictStr.size());

                if (!compressed.empty()) {
                    out.write((char*)compressed.data(), compressed.size());
                }

                std::string streamEnd = "\r\nendstream\n";
                out.write(streamEnd.c_str(), streamEnd.size());
            } else {
                std::string objBody = serializeObject(ind.object) + "\n";
                out.write(objBody.c_str(), objBody.size());
            }

            std::string objFooter = "endobj\n";
            out.write(objFooter.c_str(), objFooter.size());
        }

        // Write XRef table
        size_t xrefStart = (size_t)out.tellp();
        std::ostringstream xref;
        xref << "xref\n";
        xref << "0 " << (maxObjNum + 1) << "\n";
        xref << "0000000000 65535 f \n";

        for (int i = 1; i <= maxObjNum; ++i) {
            if (xrefOffsets.count(i)) {
                xref << std::setw(10) << std::setfill('0') << xrefOffsets[i] << " 00000 n \n";
            } else {
                xref << "0000000000 00000 f \n";
            }
        }

        // Trailer
        xref << "trailer\n<<\n";
        xref << "  /Size " << (maxObjNum + 1) << "\n";
        if (rootCatalog) {
            int rootNum = 1;
            for (auto& pair : objects) {
                if (pair.second.object == rootCatalog) {
                    rootNum = pair.first;
                    break;
                }
            }
            xref << "  /Root " << rootNum << " 0 R\n";
        }
        if (infoDict) {
            for (auto& pair : objects) {
                if (pair.second.object == infoDict) {
                    xref << "  /Info " << pair.first << " 0 R\n";
                    break;
                }
            }
        }
        xref << ">>\n";
        xref << "startxref\n" << xrefStart << "\n%%EOF\n";

        std::string xrefStr = xref.str();
        out.write(xrefStr.c_str(), xrefStr.size());

        std::string resStr = out.str();
        outBuffer.assign(resStr.begin(), resStr.end());
        return true;
    }
};

} // namespace pdf
