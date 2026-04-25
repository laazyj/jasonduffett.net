---
title: "Using 7zip from PowerShell"
date: 2011-05-01
summary: "Although it is possible to invoke the Shell’s zip functions from within PowerShell to unzip a file, I’ve found that it is slow and problematic for automated…"
originalUrl: "https://jasonduffett.net/post/5103879646/using-7zip-from-powershell"
originalId: "5103879646"
tags:
  - powershell
---

Although it is possible to invoke the Shell’s zip functions from within PowerShell to unzip a file, I’ve found that it is slow and problematic for automated scripts since it will show confirmation dialogues when it encounters a problem.

One solution is to use the excellent [7-zip](http://www.7-zip.org/) command line utility instead.

This PowerShell function neatly wraps the 7-zip command making it easier to use in your scripts…

```powershell
$ZipCommand = Join-Path -Path (Split-Path -parent $MyInvocation.MyCommand.Definition) -ChildPath "7z.exe"
if (!(Test-Path $ZipCommand)) {
        throw "7z.exe was not found at $ZipCommand."
}
set-alias zip $ZipCommand

function Unzip-File {
        param (
                [string] $ZipFile = $(throw "ZipFile must be specified."),
                [string] $OutputDir = $(throw "OutputDir must be specified.")
        )

        if (!(Test-Path($ZipFile))) {
                throw "Zip filename does not exist: $ZipFile"
                return
        }

        zip x -y "-o$OutputDir" $ZipFile

        if (!$?) {
                throw "7-zip returned an error unzipping the file."
        }
}
```

The script relies on **7z.exe** and **7z.dll** being in the same directory as the script.

Using it is as simple as…

```powershell
# Import 7zip module
. (Join-Path -Path (Split-Path -parent $MyInvocation.MyCommand.Definition) -ChildPath ".\7-zip.ps1")
# Unzip a file
Unzip-File "c:\myzipfile.zip" "c:\destination-folder"
```
