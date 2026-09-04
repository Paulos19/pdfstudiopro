@echo off
echo ========================================================
echo  Building PDF Studio C++ WebAssembly (WASM) Module
echo ========================================================

where emcc >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Emscripten (emcc) not found in local PATH.
    echo To compile WASM using Docker, run: docker build -f Dockerfile.wasm -t pdf-studio-wasm .
    echo Or install emsdk from https://github.com/emscripten-core/emsdk
) else (
    if not exist public\wasm mkdir public\wasm
    echo Compiling C++ to WebAssembly (.wasm)...
    emcc src\native\wasm_entry.cpp src\native\miniz.c src\native\miniz_tdef.c src\native\miniz_tinfl.c ^
        -I src\native ^
        -O3 -std=c++17 ^
        -s WASM=1 ^
        -s ALLOW_MEMORY_GROWTH=1 ^
        -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap','getValue','setValue','UTF8ToString','stringToUTF8','_malloc','_free']" ^
        -s EXPORTED_FUNCTIONS="['_wasm_get_version','_wasm_inspect_pdf','_wasm_compress_pdf','_wasm_redact_pdf','_wasm_rotate_page','_wasm_free_buffer','_wasm_free_string','_malloc','_free']" ^
        -s MODULARIZE=1 ^
        -s EXPORT_NAME="PdfEngineWasmModule" ^
        -o public\wasm\pdf_engine.js

    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] WebAssembly module built successfully: public\wasm\pdf_engine.wasm
    ) else (
        echo [ERROR] WebAssembly compilation failed.
    )
)
