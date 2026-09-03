@echo off
echo ========================================================
echo  Building PDF Studio C++ Native Engine with MSVC (cl)
echo ========================================================

set VCVARS="C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat"

if exist %VCVARS% (
    call %VCVARS% -no_logo
) else (
    echo Warning: VsDevCmd.bat not found at default path, trying current environment cl.exe...
)

cd /d "%~dp0"

if not exist bin mkdir bin

echo Compiling C++ sources...
cl.exe /nologo /O2 /EHsc /std:c++17 /Fe:bin\pdf_engine.exe src\native\main.cpp src\native\miniz.c src\native\miniz_tdef.c src\native\miniz_tinfl.c /I src\native

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] PDF Studio C++ Native Engine compiled successfully: bin\pdf_engine.exe
    del /f /q *.obj 2>nul
) else (
    echo [ERROR] Failed to compile C++ Native Engine.
    exit /b %ERRORLEVEL%
)
