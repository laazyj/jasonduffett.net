---
title: "Windows 2008 R2 Service Pack 1 won't install!"
date: 2011-05-04
summary: "Error code 800f0818 installing Windows 2008 R2 Service Pack 1?"
originalUrl: "https://jasonduffett.net/post/5189439239/windows-2008-r2-service-pack-1-error"
originalId: "5189439239"
---

Error code **800f0818** installing Windows 2008 R2 Service Pack 1?

We rolled out Service Pack 1 to about 10 servers without any issues until today. A brand new installation of Windows 2008 R2 which failed with error code 800f0818. I had trouble finding a definitive guide on how to resolve it so here are steps I took…

![Windows Update Error Message](http://i55.tinypic.com/5lxz87.png)

**Install System Update Readiness Tool for Windows Server 2009 R2**

This can be [downloaded from Microsoft](http://www.microsoft.com/downloads/en/details.aspx?FamilyId=c4b0f52c-d0e4-4c18-aa4b-93a477456336&displaylang=en). After you’ve installed it, try the service pack again. Some people have reported this was all that was necessary to fix the problem. But for me it was more difficult…

_I referenced this [Microsoft Technet article](http://technet.microsoft.com/en-us/library/ee619779%28WS.10%29.aspx) to debug this problem._

**Check the System Update Readiness Tool log**

Check the SUR log at **%windir%\logs\cbs\checksur.log** and see what files caused problems. eg.

```
Unavailable repair files:
                 servicing\packages\Package_for_KB2446709_RTM~31bf3856ad364e35~amd64~~6.1.1.2.mum
                 servicing\packages\Package_for_KB2446709_RTM~31bf3856ad364e35~amd64~~6.1.1.2.cat
```

Backup these files. eg.

```
C:\> copy %windir%\servicing\packages\Package_for_KB2446709_RTM~31bf3856ad364e35~amd64~~6.1.1.2.cat C:\backup
```

Take ownership of the files (so you can modify permissions)

```
C:\>  takeown /f c:\windows\servicing\packages\Package_for_KB2446709_RTM~31bf3856ad364e35~amd64~~6.1.1.2.cat
```

Grant Administrators permissions to overwrite the files. eg.

```
C:\> icacls c:\Windows\servicing\Packages\Package_for_KB2446709_RTM~31bf3856ad364e35~amd64~~6.1.1.2.mum /grant administrators:F
```

Copy the files from another, working, Windows 2008 R2 machine

```
C:\> copy \\myworkingpc\c$\windows\servicing\packages\Package_for_KB2446709_RTM~31bf3856ad364e35~amd64~~6.1.1.2.mum "%windir%\servicing\packages\"
```

If you’re unlucky, like me, then you’ll find that you don’t have another PC with the correct files available on it. Check out the [Technet article](http://technet.microsoft.com/en-us/library/ee619779%28WS.10%29.aspx), under _Options for obtaining files_, it details how you can download the update package and extract the files to a temporary directory.

Once you replaced the files, re-run the System Update Readiness Tool, then re-install the service pack.
