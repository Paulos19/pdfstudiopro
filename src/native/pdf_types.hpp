#pragma once
#include <string>
#include <vector>
#include <map>
#include <memory>
#include <sstream>
#include <iomanip>
#include <iostream>
#include <cstdint>
#include <algorithm>

namespace pdf {

enum class ObjectType {
    Null,
    Boolean,
    Number,
    String,
    HexString,
    Name,
    Array,
    Dictionary,
    Stream,
    Reference
};

struct Object;
using ObjectPtr = std::shared_ptr<Object>;

struct Reference {
    int objNum = 0;
    int genNum = 0;
};

struct Object {
    ObjectType type = ObjectType::Null;
    bool boolValue = false;
    double numValue = 0.0;
    std::string strValue; // for String, HexString, Name
    std::vector<ObjectPtr> arrayValue;
    std::map<std::string, ObjectPtr> dictValue;
    std::vector<uint8_t> streamData;
    Reference refValue;

    static ObjectPtr createNull() {
        auto obj = std::make_shared<Object>();
        obj->type = ObjectType::Null;
        return obj;
    }

    static ObjectPtr createBool(bool v) {
        auto obj = std::make_shared<Object>();
        obj->type = ObjectType::Boolean;
        obj->boolValue = v;
        return obj;
    }

    static ObjectPtr createNumber(double v) {
        auto obj = std::make_shared<Object>();
        obj->type = ObjectType::Number;
        obj->numValue = v;
        return obj;
    }

    static ObjectPtr createString(const std::string& v) {
        auto obj = std::make_shared<Object>();
        obj->type = ObjectType::String;
        obj->strValue = v;
        return obj;
    }

    static ObjectPtr createName(const std::string& v) {
        auto obj = std::make_shared<Object>();
        obj->type = ObjectType::Name;
        obj->strValue = v;
        return obj;
    }

    static ObjectPtr createArray() {
        auto obj = std::make_shared<Object>();
        obj->type = ObjectType::Array;
        return obj;
    }

    static ObjectPtr createDict() {
        auto obj = std::make_shared<Object>();
        obj->type = ObjectType::Dictionary;
        return obj;
    }

    static ObjectPtr createRef(int num, int gen = 0) {
        auto obj = std::make_shared<Object>();
        obj->type = ObjectType::Reference;
        obj->refValue = {num, gen};
        return obj;
    }

    // JSON serialization helper for UI Inspector
    std::string toJson() const {
        std::ostringstream ss;
        switch (type) {
            case ObjectType::Null:
                ss << "null";
                break;
            case ObjectType::Boolean:
                ss << (boolValue ? "true" : "false");
                break;
            case ObjectType::Number:
                ss << numValue;
                break;
            case ObjectType::String:
            case ObjectType::HexString: {
                ss << "\"";
                for (char c : strValue) {
                    if (c == '"') ss << "\\\"";
                    else if (c == '\\') ss << "\\\\";
                    else if (c == '\n') ss << "\\n";
                    else if (c == '\r') ss << "\\r";
                    else if (c == '\t') ss << "\\t";
                    else if ((unsigned char)c < 32 || (unsigned char)c > 126) {
                        ss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)(unsigned char)c;
                    } else {
                        ss << c;
                    }
                }
                ss << "\"";
                break;
            }
            case ObjectType::Name: {
                ss << "\"/";
                for (char c : strValue) {
                    if (c == '"') ss << "\\\"";
                    else if (c == '\\') ss << "\\\\";
                    else ss << c;
                }
                ss << "\"";
                break;
            }
            case ObjectType::Array: {
                ss << "[";
                for (size_t i = 0; i < arrayValue.size(); ++i) {
                    if (i > 0) ss << ", ";
                    ss << (arrayValue[i] ? arrayValue[i]->toJson() : "null");
                }
                ss << "]";
                break;
            }
            case ObjectType::Dictionary: {
                ss << "{";
                size_t count = 0;
                for (const auto& pair : dictValue) {
                    if (count > 0) ss << ", ";
                    ss << "\"" << pair.first << "\": " << (pair.second ? pair.second->toJson() : "null");
                    count++;
                }
                ss << "}";
                break;
            }
            case ObjectType::Stream: {
                ss << "{\"_type\": \"Stream\", \"length\": " << streamData.size() << ", \"dict\": ";
                Object d;
                d.type = ObjectType::Dictionary;
                d.dictValue = dictValue;
                ss << d.toJson() << "}";
                break;
            }
            case ObjectType::Reference:
                ss << "{\"_ref\": " << refValue.objNum << ", \"gen\": " << refValue.genNum << "}";
                break;
        }
        return ss.str();
    }
};

struct IndirectObject {
    int objNum = 0;
    int genNum = 0;
    ObjectPtr object;
    size_t offset = 0;
    bool isFree = false;
};

struct TextBlock {
    int id = 0;
    int pageIndex = 0;
    std::string text;
    std::string fontName = "Helvetica";
    double fontSize = 12.0;
    double x = 0.0;
    double y = 0.0;
    double width = 0.0;
    double height = 0.0;
    double r = 0.0, g = 0.0, b = 0.0; // Color
    std::string rawOperator;
    size_t streamOffset = 0;

    std::string toJson() const {
        std::ostringstream ss;
        ss << "{"
           << "\"id\":" << id << ","
           << "\"page\":" << pageIndex << ","
           << "\"text\":\"";
        for (char c : text) {
            if (c == '"') ss << "\\\"";
            else if (c == '\\') ss << "\\\\";
            else if (c == '\n') ss << "\\n";
            else if (c == '\r') ss << "\\r";
            else if (c == '\t') ss << "\\t";
            else ss << c;
        }
        ss << "\","
           << "\"font\":\"" << fontName << "\","
           << "\"fontSize\":" << fontSize << ","
           << "\"x\":" << x << ","
           << "\"y\":" << y << ","
           << "\"width\":" << width << ","
           << "\"height\":" << height << ","
           << "\"color\":{\"r\":" << r << ",\"g\":" << g << ",\"b\":" << b << "}"
           << "}";
        return ss.str();
    }
};

struct RedactionBox {
    int pageIndex = 0;
    double x = 0.0;
    double y = 0.0;
    double width = 0.0;
    double height = 0.0;
    std::string overlayText = "";
    double r = 0.0, g = 0.0, b = 0.0;
};

struct PageInfo {
    int pageNumber = 1;
    int objNum = 0;
    double width = 595.28;  // A4 standard points default
    double height = 841.89;
    int rotation = 0;
    std::vector<TextBlock> textBlocks;
};

} // namespace pdf
