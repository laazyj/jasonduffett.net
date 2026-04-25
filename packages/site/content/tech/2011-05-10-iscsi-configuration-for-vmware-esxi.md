---
title: "Recommended iSCSI configuration for VMware ESXi"
date: 2011-05-10
summary: "I’ve recently been working with a couple of VMware environments using Dell EqualLogic and MD3000i iSCSI SANs, and developed the attached PowerShell script fo…"
originalUrl: "https://jasonduffett.net/post/5356826166/iscsi-configuration-for-vmware-esxi"
originalId: "5356826166"
tags:
  - powershell
  - vmware
---

I’ve recently been working with a couple of VMware environments using Dell EqualLogic and MD3000i iSCSI SANs, and developed the attached PowerShell script for configuring the ESXi hosts to connect to them.

To optimise iSCSI traffic there are many things you should configure in your iSCSI ethernet network but for the ESXi hosts, the important things are:

#### Use Jumbo Frames.

Jumbo frames will give a great performance boost to your iSCSI storage, but they must be supported (and configured) on all devices in the setup (eg. ESXi Host, Switches, SAN).

#### Setup multiple paths between each ESXi Host and the SAN

You’ll need at least 2 switches, 2 NICs dedicated to iSCSI on each ESXi host, and 2 NICs/Controllers on the SAN. Cable the devices so that they are fully redundant - if any single device should fail (host NIC, switch, SAN NIC/Controller) then the host can still communicate with the SAN.

#### Configure ESXi MPIO (Multi-path I/O) correctly.

Once you have the redundant paths configured you need to configure ESXi to make the best use of these paths by configuring round-robin MPIO allowing it to use both paths at once.

### So what about this script?

One problem I found when configuring this is that I couldn’t find anywhere in the vSphere GUI to configure the MTU of the iSCSI vSwitch and pNICs for Jumbo Frames. There are also a lot of bits & pieces to configure so I wrote this PowerShell script to automate it.
The script will configure the following on the specified ESXi host:

- Disables <strong>Disk.UseDeviceReset</strong> as recommended by VMware.
- Lowers the maximum number of LUNs to speed up boot time.
- Create a virtual switch for iSCSI traffic and bind the physical NICs to it.
- Configure the virtual switch to use jumbo frames.
- Create and configure VMkernel ports and NIC bindings for MPIO.

The full script can be downloaded from [here](https://github.com/laazyj/blogAttachments/raw/master/esxi_iscsi_configuration.ps1). The script has been developed and tested with ESXi 4.1 update 1, using PowerCLI 4.1.1.

_Note: If you are using a free version of ESXi then PowerCLI commands are read-only, you should switch your ESXi to use an evaluation license before running the scripts and switch it back to the free license afterwards._

\_\_

```powershell
#load Vmware Module
if ((Get-PSSnapin | Where-Object { $_.Name -eq "VMware.VimAutomation.Core" }) -eq $null) { Add-PSSnapin VMware.VimAutomation.Core }
```

Load up the VMware PowerCLI cmdlets that we’ll require. You’ll need to have VMware PowerCLI installed.

```powershell
### iSCSI Configuration (Configure for your environment) ###
$Script:hostName = "esx01.mynetwork.co.uk"
$iscsiNics = @("vmnic1", "vmnic2")
$iscsiIps = @("192.168.130.101", "192.168.131.101")
$iscsiSwitchName = "vSwitchiSCSI"
$mtu = 9000
### End iSCSI Configuration ###
```

Configure the script for your environment:

- Enter the hostname or IP of the ESXi host being configured
- Enter the NICs that will be dedicated to iSCSI traffic
- Enter the IP addresses for the iSCSI NICs
- The name of the iSCSI virtual switch
- MTU size for jumbo frames, 9000 is usually good but ensure you have configured your switches and SAN with the same value.
- Enable the Software iSCSI adaptor and bind it to the VMkernel ports

```powershell
### Global Script Variables ###
$Global:VIServer = $null
$Global:VMHost = $null
### End Global Script Variables ###

### Functions ###
function Exit-WithError {
	param(
		[string] $ErrorMessage = "An unspecified error occurred."
	)

	Write-Error $ErrorMessage
	Disconnect-VMHost
	exit 1
}

function Disconnect-VMHost {
	if ($VIServer -ne $null) {
		Write-Host "Disconnecting from VIServer: $VIServer"
		Disconnect-VIServer -Server $VIServer -force -confirm:$false
		$Global:VIServer = $null
	}
}

function Connect-VMHost {
	if ($VIServer -eq $null) {
		Write-Host "Connecting to $hostName"
		$Global:VIServer = Connect-VIServer -Server $hostName
		$Global:VMhost = Get-VMHost -Server $VIServer
	}
}

function Set-AdvancedConfigurationValue
{
	param ([string]$Setting, [int]$Value)

	if ((Get-VMHostAdvancedConfiguration -Name $Setting).Item($Setting) -ne $Value) {
		Write-Host -ForegroundColor green "Setting advanced configuration $Setting to $Value"
		$VMhost | Set-VMHostAdvancedConfiguration -Name $Setting -Value $Value
	}
}

# iSCSI port groups are named starting at 1, not 0.
function get-iSCSINameFromIndex
{
	param ([int]$Index)
	"iSCSI" + ($Index + 1)
}
### End Functions ###
```

Variables and functions used internally by the script.

```powershell
Connect-VMHost

Write-Host "Checking advanced Disk configuration"
Set-AdvancedConfigurationValue "Disk.UseDeviceReset" 0
Set-AdvancedConfigurationValue "Disk.UseLunReset" 1
Set-AdvancedConfigurationValue "Disk.MaxLUN" 50
```

Connect to the ESXi host and configure advanced disk configuration options. If you expect to have more than 50 LUNs on a SCSI adaptor then adjust this value accordingly.

```powershell
# Get/Create virtual switch
$iscsiVirtualSwitch = Get-VirtualSwitch -VMHost $VMhost | Where-object { $_.Name -eq $iscsiSwitchName }
if ($iscsiVirtualSwitch -eq $null) {
	Write-Host -ForegroundColor green "Creating new virtual switch for iSCSI: $iscsiSwitchName"
	$iscsiVirtualSwitch = New-VirtualSwitch -VMHost $VMhost -Name $iscsiSwitchName
}
```

Create the new iSCSI virtual switch if it doesn’t exist.

```powershell
# Jumbo Frames
if ($iscsiVirtualSwitch.Mtu -ne $mtu) {
	Write-Host -ForegroundColor green "Enabling Jumbo Frames (MTU:$mtu) on iSCSI switch: $iscsiSwitchName"
	Set-VirtualSwitch -VirtualSwitch $iscsiVirtualSwitch -MTU $mtu -Confirm:$false
}
```

Enable jumbo frames on the virtual switch.

```powershell
# NIC binding
Write-Host "Checking vNIC bindings of vSwitch: $iscsiSwitchName"
$nicsRequireUpdating = $iscsiVirtualSwitch.Nic.Length -ne $iscsiNics.Length
if (!$nicsRequireUpdating) {
	$existingNics = New-Object System.Collections.ArrayList(, $iscsiVirtualSwitch.Nic)
	$iscsiNics | Foreach-object { if (!$existingNics.Contains($_)) { $nicsRequireUpdating = $true } }
}
if ($nicsRequireUpdating)
{
	Write-Host -ForegroundColor green "Binding iSCSI virtual NICs [$iscsiNics] to virtual switch: $iscsiSwitchName"
	Set-VirtualSwitch -VirtualSwitch $iscsiVirtualSwitch -Nic $iscsiNics -Confirm:$false
}
```

Bind the specified physical NICs to the iSCSI virtual switch.

```powershell
# VMKernel ports
Write-Host "Checking VMKernel ports and IP addresses"
# Load existing IP addresses
$existingIPs = ($VMhost | Get-VMHostNetworkAdapter | Where-object { $_.IP -ne "" } | %{ $_.IP })
if ($existingIPs.GetType().FullName -eq "System.String") {
	$existingIPs = New-Object System.Collections.ArrayList(, @($existingIPs))
} else {
	$existingIPs = New-Object System.Collections.ArrayList(, $existingIPs)
}
# Check desired IP addresses
for ($i = 0; $i -lt $iscsiIps.Length; $i++) {
	$ip = $iscsiIps[$i]
	if (!$existingIPs.Contains($ip)) {
		$iscsiName = get-iSCSINameFromIndex($i)
		Write-Host -ForegroundColor green "Creating new VMKernel port $iscsiName with address: $ip"
		$VMhost | New-VMHostNetworkAdapter `
			-PortGroup $iscsiName `
			-IP $ip `
			-SubnetMask 255.255.255.0 `
			-Mtu $mtu `
			-ManagementTrafficEnabled $false `
			-VMotionEnabled $false `
			-VirtualSwitch $iscsiVirtualSwitch
	} else {
		Write-Host "Network adaptor with IP address $ip already exists, checking settings"
		$vmnic = $VMhost | Get-VMHostNetworkAdapter | Where-object { $_.IP -eq $ip }
		if ($vmnic.ManagementTrafficEnabled) {
			Write-Warning ([string]::Format("Disabling Management Traffic on {0}", $vmnic.Name))
			$VMhost | Set-VMHostNetworkAdaptor -VirtualNic -ManagementTrafficEnabled $false
		}
		if ($vmnic.VMotionEnabled) {
			Write-Warning ([string]::Format("Disabling VMotion on {0}", $vmnic.Name))
			$VMhost | Set-VMHostNetworkAdaptor -VirtualNic -VMotionEnabled $false
		}
		if ($vmnic.IPv6Enabled) {
			Write-Warning ([string]::Format("Disabling IPv6 on {0}", $vmnic.Name))
			$VMhost | Set-VMHostNetworkAdaptor -VirtualNic -IPv6Enabled $false
		}
		if ($vmnic.Mtu -ne $mtu) {
			Write-Warning ([string]::Format("Setting MTU to $mtu on {0}", $vmnic.Name))
			$VMhost | Set-VMHostNetworkAdaptor -VirtualNic -Mtu $mtu
		}
	}
}
```

Here we have configured 2 VMKernel ports (1 for each pNIC) for iSCSI traffic.

```powershell
# Nic Teaming Policy
for ($i = 0; $i -lt $iscsiIps.Length; $i++) {
	$iscsiName = get-iSCSINameFromIndex($i)
	$activeNic = $iscsiNics[$i]
	Write-Host "Checking NIC teaming policy for $iscsiName port group"
	$portGroupTeamingPolicy = $VMhost | Get-VirtualPortGroup -VirtualSwitch $iscsiVirtualSwitch -Name $iscsiName | Get-NicTeamingPolicy
	if (($portGroupTeamingPolicy.ActiveNic.Length -ne 1) -or ($portGroupTeamingPolicy.ActiveNic[0] -ne $activeNic)) {
		Write-Host -ForegroundColor green ([string]::Format("Binding port group {0} to NIC {1}", $iscsiName, $activeNic))
		$unusedNics = @()
		for ($j = 0; $j -lt $iscsiNics.Length; $j++) { if ($j -ne $i) { $unusedNics += $iscsiNics[$j] } }
		Set-NicTeamingPolicy -VirtualPortGroup $portGroupTeamingPolicy -MakeNicUnused $unusedNics -MakeNicActive $iscsiNics[$i]
	}
}
```

Configure NIC teaming on each of the VMkernel ports so that they have 1 active adaptor each and no standby. This is the configuration recommended by Dell & VMware for MPIO.

```powershell
# Get Software iSCSI Adaptor HBA number
Write-Host "Checking iSCSI HBA"
$iscsiHba = $VMhost | Get-VMHostHba | Where-object { $_.Type -match "IScsi" } | Where-object { $_.Model -match "iSCSI Software Adapter" }
$iscsiHbaNumber = $iscsiHba | %{$_.Device}
# Get a CLI instance
$esxCli = Get-EsxCli -Server $VIServer

# Check each vmk binding
$iscsiIps | Foreach-object {
	$ip = $_
	$iscsiVmkNumber = $VMhost | Get-VMHostNetworkAdapter | Where-object { $_.IP -match $ip } | %{ $_.Name }
	Write-Host -ForegroundColor green "Binding VMKernel Port $iscsiVmkNumber to $iscsiHbaNumber"
	$esxCli.swiscsi.nic.add($iscsiHbaNumber, $iscsiVmkNumber)
}

Disconnect-VMHost
```

Enable the iSCSI Software Adaptor and bind it to the VMkernel ports. PowerCLI doesn’t include any cmdlets to do this so I use an EsxCli object.

VMware’s iSCSI SAN Configuration documentation can be found [here](http://www.vmware.com/pdf/vsphere4/r40/vsp_40_iscsi_san_cfg.pdf).
