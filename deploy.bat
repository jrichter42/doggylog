@echo off
setlocal

set "SRC=%~dp0web"
set "DEST=X:\doggylog"
set "ROBO=robocopy /NDL /NS /NJH /NJS /NP"

if not exist "%SRC%" (
    echo Error: %SRC% does not exist!
    exit /b 1
)

if not exist "%DEST%" (
    echo Error: %DEST% does not exist!
    exit /b 1
)

call :run %ROBO% "%SRC%" "%DEST%" /MIR || exit /b 1

exit /b 0

:run
set "LOG=%TEMP%\doggylog-deploy-%RANDOM%-%RANDOM%.log"
%* > "%LOG%"
set "RC=%ERRORLEVEL%"

findstr /R /V /C:"^[ ]*$" "%LOG%"

if %RC% GEQ 8 (
    echo Robocopy failed with exit code %RC%.
    type "%LOG%"
    del "%LOG%" >nul 2>nul
    exit /b %RC%
)
del "%LOG%" >nul 2>nul
exit /b 0
