---
title: ".NET Development with source code on a network share"
date: 2012-09-17
summary: "1st thing. Disable UAC. I know it’s bad but I was never able to get EnableLinkedConnections to work with an elevated Powershell prompt. This was a show-stopp…"
originalUrl: "https://jasonduffett.net/post/31733957930/net-development-with-source-code-on-a-network-share"
originalId: "31733957930"
---

1st thing. Disable UAC. I know it’s bad but I was never able to get EnableLinkedConnections to work with an elevated Powershell prompt. This was a show-stopper for me as I need to deploy sites to IIS, manage MSMQ queues, and stop/start/deploy windows services as part of my development.

[http://www.tekrevue.com/tip/how-to-disable-user-account-control-in-windows-8/](http://www.tekrevue.com/tip/how-to-disable-user-account-control-in-windows-8/)

loadFromRemoteSources enabled=true, either in each application + test project + R# task runners + NServiceBus.host.exe.config for each application + test, or fuck it, just put in machine.config…

(Link to fav stack overflows)

Great so far… except…

System.ConfigurationManager static methods. In particular if you use a linked configuration file (sample UnicastBus.config)…

Link to hotfix: http://support.microsoft.com/hotfix/KBHotfix.aspx?kbnum=2580188&kbln=en-us

[http://support.microsoft.com/kb/2580188](http://support.microsoft.com/kb/2580188)

Error example: http://social.msdn.microsoft.com/Forums/en-AU/netfxbcl/thread/cfe1f43b-eaf3-4698-a6d1-35b9214f70c9

This then worked great except for T4MVC which still crapped out an error about being unable to include the settings file (see below). This was solved by adding “file://psf” to trusted sites in Internet Properties.

Error 34 Failed to resolve include text for file:The path ‘Y:\Repositories\levity\Applications\BackOffice\BackOffice\T4MVC.tt.settings.t4’ must be either local to this computer or part of your trusted zone. If you have downloaded this template, you may need to 'Unblock’ it using the properties page for the template file in Windows Explorer. Y:\Repositories\levity\Applications\BackOffice\BackOffice\T4MVC.tt 0 0

Scratch that. Adding the path to Trusted zone fucks up everything else. Leave it in Intranet zone and try and work out why the fuck T4MVC.tt needs it to be in trusted zone…

.NET 2 (eg. PowerShell, NUnit). CasPol (link to script + Hanselman)

Of course you could try setting FullTrust on the Trusted zone but that doesn’t work (fucking stupid shit):
caspol.exe -machine -chggroup 1.5. FullTrust

to checkout the policies that apply to an assembly
CasPol.exe -rsg path-to-assembly

to remove groups, find the group numbers using -rsg and then
caspol.exe -remgroup 1.2.3.

Right. Screw all the old CasPol stuff.. Just trust the zone. It’s a VM right? You know what you’re doing with it.

Also, apply the change to ALL frameworks as you never know which framework something is going to use. ie. NAnt uses .NET 4 (x64) on my machine…

So..

1. Add the server hosting your repo to the trusted zone in Internet Options. For Parallels this is “file://psf”. T4 Templates require it in the trusted zone as they don’t work on intranet zone (I couldn’t find what permissions they specifically need).

2. Grant FullTrust to the Trusted zone (I couldn’t make caspol groups with urls work for whatever reason):
   caspol.exe -machine -chggroup 1.5. FullTrust

3. Run this caspol under Framework\v2, Framework\v4, Framework64\v2, Framework64\v4

Sweet (for now).

Add example exception trace from Nant.
