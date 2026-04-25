---
title: "Could not load type 'Machine.Specifications.Utility.Naming'"
date: 2011-05-20
summary: "Ever seen this error in ReSharper test runner using MSpec?"
originalUrl: "https://jasonduffett.net/post/5663131672/machine-specifications-utility-naming"
originalId: "5663131672"
tags:
  - net
  - mspec
---

Ever seen this error in ReSharper test runner using MSpec?

```
System.TypeLoadException: Could not load type 'Machine.Specifications.Utility.Naming' from assembly 'Machine.Specifications, Version=0.4.12.0, Culture=neutral, PublicKeyToken=null'.
```

Did you recently update the version of MSpec you are using?

Did you forget to update the ReSharper runner?

Sure you did.

Close Visual Studio & re-run the **InstallResharperRunner.X.X - VSXXXX.bat** script that is distributed with Machine.Specifications and all will be well.
