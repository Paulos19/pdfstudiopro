#pragma once
#include "pdf_types.hpp"
#include "pdf_flate.hpp"
#include <fstream>
#include <iostream>
#include <cctype>
#include <cstring>
#include <cmath>

namespace pdf {

class Parser {
public:
    std::vector<uint8_t> buffer;
    size_t pos = 0;
    std::string pdfVersion = "1.7";
    std::map<int, IndirectObject> objects;
    ObjectPtr trailer;
    std::vector<PageInfo> pages;
    ObjectPtr catalog;

    bool loadFromFile(const std::string& filepath) {
        std::ifstream file(filepath, std::ios::binary | std::ios::ate);
        if (!file.is_open()) return false;
        std::streamsize size = file.tellg();
        file.seekg(0, std::ios::beg);
        buffer.resize((size_t)size);
        if (!file.read((char*)buffer.data(), size)) return false;
        pos = 0;
        return parse();
    }

    bool loadFromBuffer(const std::vector<uint8_t>& buf) {
        buffer = buf;
        pos = 0;
        return parse();
    }

private:
    void skipWhitespaceAndComments() {
        while (pos < buffer.size()) {
            uint8_t c = buffer[pos];
            if (c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\f' || c == 0) {
                pos++;
            } else if (c == '%') {
                while (pos < buffer.size() && buffer[pos] != '\r' && buffer[pos] != '\n') {
                    pos++;
                }
            } else {
                break;
            }
        }
    }

    char peek() {
        skipWhitespaceAndComments();
        if (pos >= buffer.size()) return 0;
        return (char)buffer[pos];
    }

    char get() {
        skipWhitespaceAndComments();
        if (pos >= buffer.size()) return 0;
        return (char)buffer[pos++];
    }

    std::string readToken() {
        skipWhitespaceAndComments();
        if (pos >= buffer.size()) return "";

        size_t start = pos;
        while (pos < buffer.size()) {
            char c = (char)buffer[pos];
            if (std::isspace((unsigned char)c) || c == '%' || c == '(' || c == ')' || 
                c == '<' || c == '>' || c == '[' || c == ']' || c == '{' || c == '}' || c == '/') {
                if (pos == start) {
                    pos++;
                    return std::string(1, c);
                }
                break;
            }
            pos++;
        }
        return std::string((char*)&buffer[start], pos - start);
    }

public:
    ObjectPtr parseObject() {
        skipWhitespaceAndComments();
        if (pos >= buffer.size()) return nullptr;

        char c = (char)buffer[pos];
        if (c == '<') {
            if (pos + 1 < buffer.size() && buffer[pos + 1] == '<') {
                // Dictionary
                pos += 2;
                auto dict = Object::createDict();
                while (true) {
                    skipWhitespaceAndComments();
                    if (pos + 1 < buffer.size() && buffer[pos] == '>' && buffer[pos + 1] == '>') {
                        pos += 2;
                        break;
                    }
                    if (pos >= buffer.size()) break;

                    auto keyObj = parseObject();
                    if (!keyObj || keyObj->type != ObjectType::Name) break;
                    
                    auto valObj = parseObject();
                    if (!valObj) break;

                    dict->dictValue[keyObj->strValue] = valObj;
                }

                // Check if followed by stream
                skipWhitespaceAndComments();
                size_t savedPos = pos;
                std::string tok = readToken();
                if (tok == "stream") {
                    // Stream begins after newline
                    if (pos < buffer.size() && buffer[pos] == '\r') pos++;
                    if (pos < buffer.size() && buffer[pos] == '\n') pos++;
                    size_t streamStart = pos;

                    // Find endstream
                    const char* endstreamTag = "endstream";
                    size_t tagLen = 9;
                    size_t streamEnd = streamStart;
                    bool found = false;

                    for (size_t i = streamStart; i + tagLen <= buffer.size(); ++i) {
                        if (std::memcmp(&buffer[i], endstreamTag, tagLen) == 0) {
                            streamEnd = i;
                            // trim trailing \r\n before endstream
                            if (streamEnd > streamStart && buffer[streamEnd - 1] == '\n') streamEnd--;
                            if (streamEnd > streamStart && buffer[streamEnd - 1] == '\r') streamEnd--;
                            pos = i + tagLen;
                            found = true;
                            break;
                        }
                    }

                    if (found) {
                        auto streamObj = std::make_shared<Object>();
                        streamObj->type = ObjectType::Stream;
                        streamObj->dictValue = dict->dictValue;
                        streamObj->streamData.assign(buffer.begin() + streamStart, buffer.begin() + streamEnd);
                        return streamObj;
                    } else {
                        pos = savedPos;
                    }
                } else {
                    pos = savedPos;
                }
                return dict;
            } else {
                // Hex String <48656c6c6f>
                pos++;
                std::string hex;
                while (pos < buffer.size() && buffer[pos] != '>') {
                    if (!std::isspace(buffer[pos])) hex += (char)buffer[pos];
                    pos++;
                }
                if (pos < buffer.size() && buffer[pos] == '>') pos++;
                
                std::string decoded;
                for (size_t i = 0; i < hex.length(); i += 2) {
                    std::string byteString = hex.substr(i, 2);
                    if (byteString.length() == 1) byteString += "0";
                    char byte = (char)strtol(byteString.c_str(), nullptr, 16);
                    decoded += byte;
                }
                auto obj = Object::createString(decoded);
                obj->type = ObjectType::HexString;
                return obj;
            }
        } else if (c == '[') {
            // Array
            pos++;
            auto arr = Object::createArray();
            while (true) {
                skipWhitespaceAndComments();
                if (pos < buffer.size() && buffer[pos] == ']') {
                    pos++;
                    break;
                }
                if (pos >= buffer.size()) break;
                auto item = parseObject();
                if (item) arr->arrayValue.push_back(item);
                else break;
            }
            return arr;
        } else if (c == '(') {
            // Literal String (Hello \(World\))
            pos++;
            std::string str;
            int depth = 1;
            while (pos < buffer.size() && depth > 0) {
                char ch = (char)buffer[pos++];
                if (ch == '\\' && pos < buffer.size()) {
                    char escaped = (char)buffer[pos++];
                    if (escaped == 'n') str += '\n';
                    else if (escaped == 'r') str += '\r';
                    else if (escaped == 't') str += '\t';
                    else if (escaped == 'b') str += '\b';
                    else if (escaped == 'f') str += '\f';
                    else if (escaped == '(' || escaped == ')' || escaped == '\\') str += escaped;
                    else if (std::isdigit((unsigned char)escaped)) {
                        // Octal
                        std::string oct(1, escaped);
                        for (int k = 0; k < 2 && pos < buffer.size() && std::isdigit(buffer[pos]); ++k) {
                            oct += (char)buffer[pos++];
                        }
                        str += (char)strtol(oct.c_str(), nullptr, 8);
                    } else {
                        str += escaped;
                    }
                } else if (ch == '(') {
                    depth++;
                    str += ch;
                } else if (ch == ')') {
                    depth--;
                    if (depth > 0) str += ch;
                } else {
                    str += ch;
                }
            }
            return Object::createString(str);
        } else if (c == '/') {
            // Name /Helvetica
            pos++;
            std::string name;
            while (pos < buffer.size()) {
                char ch = (char)buffer[pos];
                if (std::isspace((unsigned char)ch) || ch == '%' || ch == '(' || ch == ')' || 
                    ch == '<' || ch == '>' || ch == '[' || ch == ']' || ch == '{' || ch == '}' || ch == '/') {
                    break;
                }
                if (ch == '#' && pos + 2 < buffer.size()) {
                    // Hex encoded character in name e.g. #20
                    std::string hex = std::string(1, (char)buffer[pos+1]) + (char)buffer[pos+2];
                    char byte = (char)strtol(hex.c_str(), nullptr, 16);
                    name += byte;
                    pos += 3;
                } else {
                    name += ch;
                    pos++;
                }
            }
            return Object::createName(name);
        } else {
            // Number, Boolean, Null, or Reference
            std::string tok = readToken();
            if (tok == "true") return Object::createBool(true);
            if (tok == "false") return Object::createBool(false);
            if (tok == "null") return Object::createNull();
            
            // Check if it's a number or indirect reference
            char* end = nullptr;
            double num = std::strtod(tok.c_str(), &end);
            if (end != tok.c_str() && *end == '\0') {
                // Peek next token to see if it's "N M R"
                size_t savedPos = pos;
                std::string tok2 = readToken();
                char* end2 = nullptr;
                double gen = std::strtod(tok2.c_str(), &end2);
                if (end2 != tok2.c_str() && *end2 == '\0') {
                    std::string tok3 = readToken();
                    if (tok3 == "R") {
                        return Object::createRef((int)num, (int)gen);
                    }
                }
                // Not a reference, rollback
                pos = savedPos;
                return Object::createNumber(num);
            }
            return Object::createString(tok);
        }
    }

    bool parse() {
        objects.clear();
        pages.clear();

        // Find PDF header
        std::string bufStr(buffer.begin(), buffer.begin() + std::min(buffer.size(), (size_t)1024));
        size_t headerPos = bufStr.find("%PDF-");
        if (headerPos != std::string::npos) {
            pdfVersion = bufStr.substr(headerPos + 5, 3);
        }

        // Scan all indirect objects in file
        pos = 0;
        while (pos < buffer.size()) {
            skipWhitespaceAndComments();
            if (pos >= buffer.size()) break;

            size_t objStart = pos;
            std::string tok1 = readToken();
            if (tok1.empty()) break;

            char* end1 = nullptr;
            long objNum = std::strtol(tok1.c_str(), &end1, 10);
            if (end1 != tok1.c_str() && *end1 == '\0') {
                std::string tok2 = readToken();
                char* end2 = nullptr;
                long genNum = std::strtol(tok2.c_str(), &end2, 10);
                if (end2 != tok2.c_str() && *end2 == '\0') {
                    std::string tok3 = readToken();
                    if (tok3 == "obj") {
                        auto obj = parseObject();
                        if (obj) {
                            IndirectObject ind;
                            ind.objNum = (int)objNum;
                            ind.genNum = (int)genNum;
                            ind.object = obj;
                            ind.offset = objStart;
                            objects[(int)objNum] = ind;
                        }
                        // Skip to endobj
                        skipWhitespaceAndComments();
                        std::string endObjTok = readToken();
                        continue;
                    }
                }
            }

            if (tok1 == "trailer") {
                trailer = parseObject();
            } else if (tok1 == "xref") {
                // Skip traditional xref table block
                while (pos < buffer.size()) {
                    skipWhitespaceAndComments();
                    size_t prevPos = pos;
                    std::string t = readToken();
                    if (t == "trailer" || t.empty()) {
                        pos = prevPos;
                        break;
                    }
                }
            }
        }

        // Find Catalog (/Root)
        ObjectPtr rootObj = nullptr;
        if (trailer && trailer->dictValue.count("Root")) {
            auto rootRef = trailer->dictValue["Root"];
            if (rootRef->type == ObjectType::Reference) {
                if (objects.count(rootRef->refValue.objNum)) {
                    rootObj = objects[rootRef->refValue.objNum].object;
                }
            } else if (rootRef->type == ObjectType::Dictionary) {
                rootObj = rootRef;
            }
        }

        // Fallback: search for dictionary with /Type /Catalog
        if (!rootObj) {
            for (auto& pair : objects) {
                if (pair.second.object && pair.second.object->dictValue.count("Type")) {
                    auto typeObj = pair.second.object->dictValue["Type"];
                    if (typeObj->strValue == "Catalog") {
                        rootObj = pair.second.object;
                        break;
                    }
                }
            }
        }

        catalog = rootObj;

        // Traverse Pages Tree
        if (catalog && catalog->dictValue.count("Pages")) {
            auto pagesRef = catalog->dictValue["Pages"];
            ObjectPtr pagesDict = resolveObject(pagesRef);
            if (pagesDict) {
                collectPages(pagesDict);
            }
        }

        return true;
    }

    ObjectPtr resolveObject(ObjectPtr obj) {
        if (!obj) return nullptr;
        if (obj->type == ObjectType::Reference) {
            if (objects.count(obj->refValue.objNum)) {
                return objects[obj->refValue.objNum].object;
            }
            return nullptr;
        }
        return obj;
    }

    void collectPages(ObjectPtr node) {
        if (!node) return;
        auto type = node->dictValue.count("Type") ? node->dictValue["Type"]->strValue : "";
        
        if (type == "Pages" || node->dictValue.count("Kids")) {
            auto kidsObj = resolveObject(node->dictValue["Kids"]);
            if (kidsObj && kidsObj->type == ObjectType::Array) {
                for (auto& kid : kidsObj->arrayValue) {
                    collectPages(resolveObject(kid));
                }
            }
        } else if (type == "Page" || node->dictValue.count("Contents") || node->dictValue.count("MediaBox")) {
            PageInfo p;
            p.pageNumber = (int)pages.size() + 1;
            
            // Find objNum
            for (auto& pair : objects) {
                if (pair.second.object == node) {
                    p.objNum = pair.first;
                    break;
                }
            }

            // MediaBox
            if (node->dictValue.count("MediaBox")) {
                auto mbox = resolveObject(node->dictValue["MediaBox"]);
                if (mbox && mbox->type == ObjectType::Array && mbox->arrayValue.size() >= 4) {
                    double x1 = mbox->arrayValue[0]->numValue;
                    double y1 = mbox->arrayValue[1]->numValue;
                    double x2 = mbox->arrayValue[2]->numValue;
                    double y2 = mbox->arrayValue[3]->numValue;
                    p.width = std::abs(x2 - x1);
                    p.height = std::abs(y2 - y1);
                }
            }

            // Rotate
            if (node->dictValue.count("Rotate")) {
                auto rot = resolveObject(node->dictValue["Rotate"]);
                if (rot) p.rotation = (int)rot->numValue;
            }

            pages.push_back(p);
        }
    }

    std::vector<uint8_t> getPageContentStream(int pageIndex) {
        if (pageIndex < 0 || pageIndex >= (int)pages.size()) return {};
        int pageObjNum = pages[pageIndex].objNum;
        if (!objects.count(pageObjNum)) return {};

        auto pageObj = objects[pageObjNum].object;
        if (!pageObj || !pageObj->dictValue.count("Contents")) return {};

        auto contentsObj = resolveObject(pageObj->dictValue["Contents"]);
        if (!contentsObj) return {};

        std::vector<uint8_t> rawData;
        if (contentsObj->type == ObjectType::Stream) {
            rawData = contentsObj->streamData;
            // Check filter
            if (contentsObj->dictValue.count("Filter")) {
                auto filter = resolveObject(contentsObj->dictValue["Filter"]);
                if (filter && (filter->strValue == "FlateDecode" || filter->strValue == "/FlateDecode")) {
                    std::vector<uint8_t> uncompressed;
                    Flate::decompress(rawData, uncompressed);
                    return uncompressed;
                }
            }
        } else if (contentsObj->type == ObjectType::Array) {
            for (auto& item : contentsObj->arrayValue) {
                auto streamObj = resolveObject(item);
                if (streamObj && streamObj->type == ObjectType::Stream) {
                    auto data = streamObj->streamData;
                    if (streamObj->dictValue.count("Filter")) {
                        auto filter = resolveObject(streamObj->dictValue["Filter"]);
                        if (filter && (filter->strValue == "FlateDecode" || filter->strValue == "/FlateDecode")) {
                            std::vector<uint8_t> uncomp;
                            Flate::decompress(data, uncomp);
                            rawData.insert(rawData.end(), uncomp.begin(), uncomp.end());
                            continue;
                        }
                    }
                    rawData.insert(rawData.end(), data.begin(), data.end());
                }
            }
        }
        return rawData;
    }
};

} // namespace pdf
