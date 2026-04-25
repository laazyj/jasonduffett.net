---
title: "Citrix NetScaler VPX + Safari compatibility"
date: 2015-01-02
summary: "I found an interesting problem while configuring cipher suites on a NetScaler VPX appliance. With the 10.5+ firmware you have access to all of the TLS1.2 cip…"
originalUrl: "https://jasonduffett.net/post/106911092859/citrix-netscaler-vpx-safari-compatibility"
originalId: "106911092859"
tags:
  - netscaler
---

I found an interesting problem while configuring cipher suites on a NetScaler VPX appliance. With the 10.5+ firmware you have access to all of the [TLS1.2 cipher suites](http://support.citrix.com/proddocs/topic/netscaler-traffic-management-10-5-map/ns-ssl-supported-ciphers-list-ref.html) even though they are not compatible with the VPX platform (only MDX/SDX/etc).

We use both MPX & VPX so I wanted to keep the configurations consistent across both platforms. This shouldn’t have been a problem as they just aren’t used, so I configured a cipher group using the following suites in order to enable [Perfect Forward Secrecy](https://community.qualys.com/blogs/securitylabs/2013/06/25/ssl-labs-deploying-forward-secrecy):

1. TLS1.2-ECDHE-RSA-AES128-GCM-SHA256
2. TLS1.2-ECDHE-RSA-AES-128-SHA256
3. TLS1-ECDHE-RSA-AES128-SHA
4. TLS1.2-DHE-RSA-AES128-GCM-SHA256
5. TLS1.2-DHE-RSA-AES-128-SHA256
6. TLS1-DHE-RSA-AES-128-CBC-SHA
7. SSL3-EDH-RSA-DES-CBC3-SHA
8. TLS1.2-AES128-GCM-SHA256
9. TLS1.2-AES-128-SHA256
10. TLS1-AES-128-CBC-SHA
11. SSL3-DES-CBC3-SHA

This worked great with most browsers I tested and [Qualys SSL Labs](https://www.ssllabs.com/ssltest/) showed it compatible with everything but IE6/XP. As expected the TLS1.2 suites were ignored and most browsers negotiated to use TLS-ECDHE-RSA-AES128-SHA.

But Safari, on both OS X Yosemite and iOS 8.1.2, failed to establish a connection. Wireshark showed that although the client + server negotiated to use TLS_ECDHE_RSA_WITH_ARS_128_CBC_SHA256 but the Client Key Exchange failed with TLS Alert 21 (Decryption Failed).
On OS X, both Chrome + Firefox were fine and used the same suite, and IE11 on Windows 8.1 also had no problems. But for whatever reason Safari on both OS X and iOS wouldn’t establish a secure connection…

Anyway, to save you the trouble the fix is quite simple - just remove all the **TLS1.2-\*** cipher suites. Since they don’t work on VPX anyway the only inconvenience is a slightly different configuration between VPX and MPX.
