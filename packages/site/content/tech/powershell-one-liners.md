---
title: "PowerShell one-liners I keep reaching for"
date: 2025-11-09
summary: "A small personal cheatsheet — the commands I type two or three times a week."
---

A small personal cheatsheet — the commands I type two or three times a week and would rather not rediscover every time.

## Find which process is holding a port

```powershell
Get-NetTCPConnection -LocalPort 443 |
  Select-Object LocalAddress, State, OwningProcess,
    @{n="Process";e={(Get-Process -Id $_.OwningProcess).Name}}
```

Nicer than `netstat -ano | findstr` because you get the process name in the same line.

## The last thousand events from one log

```powershell
Get-WinEvent -LogName System -MaxEvents 1000 |
  Where-Object { $_.LevelDisplayName -in 'Error','Warning' } |
  Format-Table TimeCreated, Id, ProviderName, Message -AutoSize
```

I tend to paste this into a fresh window when a box starts misbehaving — quick situational awareness before I go digging.

## Hash a file the same way everywhere

```powershell
Get-FileHash .\installer.msi -Algorithm SHA256 | Select-Object -ExpandProperty Hash
```

Pipes nicely into `| Set-Clipboard` on Windows 11, which is how I paste hashes into change tickets.

None of these are clever. They're just the ones I've given up trying to remember.
