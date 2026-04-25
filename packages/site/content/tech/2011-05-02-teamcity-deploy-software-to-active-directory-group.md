---
title: "Using TeamCity to deploy software to an Active Directory group"
date: 2011-05-02
summary: "One of the goals we’re trying to achieve in our environment is simple, one-touch, deployment of our software to all environments. One of the applications we…"
originalUrl: "https://jasonduffett.net/post/5127948500/teamcity-deploy-software-to-active-directory-group"
originalId: "5127948500"
tags:
  - powershell
  - active-directory
  - teamcity
---

One of the goals we’re trying to achieve in our environment is simple, one-touch, deployment of our software to all environments. One of the applications we have is a small service that runs on each of the workstations in our warehouse (approximately 13 PCs at the moment).

The main piece of work here is the PowerShell script that does all the work. But it relies on some infrastructure to make it all work..

1. Active Directory security group containing each of the computers that run the application.
2. A Group Policy Object that applies only to this security group. This GPO adds the TeamCity Build Agent domain account to the local Administrators group so that it has the right to stop & start the service when deploying the application.
3. A TeamCity build for building & packaging the application as a zip file. The zip file should be published as an artifact of the build.

**PowerShell Script**

I include this script in a deployment tools folder in our source repository.

```powershell
param (
        [string] $PackageFilename = (Read-Host "Package filename to deploy"),
        [string] $ADGroupDistinguishedName = (Read-Host "Distinguished Name of Active Directory group to deploy to"),
        [string] $DestinationUNCPath = (Read-Host "UNC path for installation on each computer"),
        [string] $ServiceName = (Read-Host "Name of the service being deployed")
)

# Import Utilities
. (Join-Path -Path (Split-Path -parent $MyInvocation.MyCommand.Definition) -ChildPath ".\7-zip.ps1")
```

First we define the parameters for the script, and import the 7-zip function we’ll use for extracting the zip files later on. See my [previous post](http://jasonduffett.net/post/5103879646/using-7zip-from-powershell) for this function.

```powershell
### Check package file exists
Write-Host "Checking package file..."
if (!(Test-Path $PackageFilename)) {
        Write-Error "Package file [$PackageFilename] could not be found or accessed."
        exit 1
}
```

Check that the package file exists.

```powershell
### Get Active Directory group
Write-Host "Looking up group in active directory..."
$adRoot = ([ADSI]"").distinguishedName
$ADGroupDistinguishedName = "$ADGroupDistinguishedName,$adRoot"
$adGroup = [ADSI]("LDAP://$ADGroupDistinguishedName")
if ($adGroup -eq $null -or $adGroup.distinguishedName -eq $null) {
        Write-Error "Group was not found in directory: [$ADGroupDistinguishedName]"
        exit 1
}
Write-Host "Active directory group found: [" $adGroup.distinguishedName "]."

### Get computer members of group
Write-Host "Looking up members of group..."
$filter = "(&(objectCategory=computer)(memberOf=" + $adGroup.distinguishedName + "))"
$search = New-Object System.DirectoryServices.DirectorySearcher($filter)
[void]$search.PropertiesToLoad.Add("dNSHostName")
$members = $search.FindAll()
# Error handling is a bit odd since FindAll() is not executed until comparing the result with $null
try {
        $error.Clear()
        if ($members -eq $null -or $members.Count -eq 0) { Write-Error "No computers found in group." }
        $memberCount = $members.Count
} catch {
        Write-Error $error[0]
        exit 1
}
Write-Host $memberCount "computers found in group."
```

We use ADSI to look up the Active Directory group by its Distinguished Name then, using the [System.DirectoryServices.DirectorySearcher](http://msdn.microsoft.com/en-us/library/system.directoryservices.directorysearcher.aspx), enumerate the FQDN of all the computers in the group.

```powershell
### Deploy to each member
$deployedCount = 0
foreach ($member in $members) {
        $computerFQDN = $member.Properties.Item("dNSHostName")
        Write-Host "Starting deploy to $computerFQDN..."

        ### Test connection to computer
        Write-Host "Testing connection..."
        if (!(Test-Connection $computerFQDN -quiet)) {
                Write-Error "Unable to deploy to $computerFQDN. Computer is not reachable."
                continue
        }

        ### Get the remote service
        Write-Host "Getting service: [$ServiceName]"
        $service = Get-Service -DisplayName $ServiceName -ComputerName $computerFQDN -ErrorAction SilentlyContinue
        if ($service -eq $null) {
                Write-Error "Service [$ServiceName] was not found, or there are insufficient permissions to query the service on $computerFQDN."
                continue
        }

        ### Stop service
        if ($service.Status -eq "Running") {
                Write-Host "Stopping service..."
                $error.Clear()
                Stop-Service -InputObject $service -ErrorAction SilentlyContinue
                if (!$?) {
                        Write-Error $error[0]
                        continue
                }

                Write-Host "Waiting for service to stop..."
                Sleep 5
        } else {
                Write-Warning "Service [$ServiceName] is already stopped on [$computerFQDN]."
        }

        ### Check service has stopped
        if ($service.Status -ne "Stopped") {
                Write-Error "Service has not responded to stop request, cannot continue deployment to $computerFQDN."
                continue
        }

        ### Unzip and overwrite existing files
        $error.Clear()
        try {
                $destinationPath = "\\" + (Join-Path $computerFQDN $DestinationUNCPath)
                Write-Host "Testing destination path..."
                if (Test-Path $destinationPath) {
                        Write-Host "Unzipping $PackageFilename to $destinationPath..."
                        Unzip-File $PackageFilename $destinationPath
                } else {
                        throw "Could not access destination path [$destinationPath]. Unable to deploy to $computerFQDN."
                }
        } catch {
                Write-Error $error[0]
                continue
        } finally {
                ### Start service
                Write-Host "Starting service..."
                $error.Clear()
                Start-Service -InputObject $service -ErrorAction SilentlyContinue
                if (!$?) {
                        Write-Error $error[0]
                        continue
                }
        }

        Write-Host -ForegroundColor green "Deployed successfully to $computerFQDN"
        $deployedCount++
}

### Check final results
if ($deployedCount -eq $memberCount) {
        Write-Host -ForegroundColor green "Successfully deployed to all clients."
        exit 0
} else {
        Write-Warning ([string]::Format("Deployed to {0} of {1} computers.", $deployedCount, $memberCount))
        exit 1
}
```

For each computer we identified, do the following:

1. Check that the computer is contactable using [Test-Connection](http://technet.microsoft.com/en-us/library/dd315259.aspx).
2. Get the service on the remote computer using [Get-Service](http://technet.microsoft.com/en-us/library/ee176858.aspx).
3. Check the service status and stop it if necessary.
4. Unzip the package file using [7-zip](http://jasonduffett.net/post/5103879646/using-7zip-from-powershell).
5. Restart the service on the remote computer.

This script can now be used in a TeamCity build configuration to deploy from an artifact of a previous successful build.

You can download the full PowerShell script at GitHub: [deploy_updated_service.ps1](https://github.com/laazyj/blogAttachments/raw/master/deploy_updated_service.ps1)
